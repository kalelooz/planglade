import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
let db: typeof import("../src/lib/db").db
let POST: typeof import("../src/app/api/auth/recovery/route").POST
let GET: typeof import("../src/app/api/auth/recovery/route").GET
let hashPassword: typeof import("../src/lib/local-auth-password").hashPassword
let verifyPassword: typeof import("../src/lib/local-auth-password").verifyPassword
let normalizeRecoveryCode: typeof import("../src/lib/self-host-setup/security").normalizeRecoveryCode
let sha256Hex: typeof import("../src/lib/self-host-setup/security").sha256Hex

const headers = {
  origin: "http://localhost:3000",
  "content-type": "application/json",
}

function recoveryRequest(body: unknown) {
  return new Request("http://localhost:3000/api/auth/recovery", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
}

before(async () => {
  process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "true"
  process.env.NEXTAUTH_URL = "http://localhost:3000"
  process.env.NEXTAUTH_SECRET = "local-recovery-test-secret"
  ;({ db } = await import("../src/lib/db"))
  ;({ POST, GET } = await import("../src/app/api/auth/recovery/route"))
  ;({ hashPassword, verifyPassword } = await import("../src/lib/local-auth-password"))
  ;({ normalizeRecoveryCode, sha256Hex } = await import("../src/lib/self-host-setup/security"))
})

after(async () => {
  await db.$disconnect()
  for (const key of ["PLANGLADE_LOCAL_AUTH_ENABLED", "NEXTAUTH_URL", "NEXTAUTH_SECRET"]) {
    delete process.env[key]
  }
  await isolatedDatabase.cleanup()
})

test("a recovery code changes the password once and revokes existing sessions", async () => {
  const email = "recover-owner@example.com"
  const code = "0123-4567-89ab-cdef-0123-4567-89ab-cdef"
  const oldPasswordHash = await hashPassword("old correct horse battery")
  const user = await db.user.create({
    data: {
      email,
      normalizedEmail: email,
      name: "Recover Owner",
      authVersion: 4,
      localCredential: { create: { passwordHash: oldPasswordHash } },
      localRecoveryCodes: {
        create: { codeHash: sha256Hex(normalizeRecoveryCode(code)!) },
      },
    },
  })

  const completion = await POST(recoveryRequest({
    email: email.toUpperCase(),
    recoveryCode: code.toUpperCase(),
    newPassword: "new correct horse battery staple",
  }))

  assert.equal(completion.status, 200)
  assert.deepEqual(await completion.json(), { status: "complete" })
  assert.equal(completion.headers.get("cache-control"), "no-store, max-age=0")
  assert.equal(completion.headers.get("referrer-policy"), "no-referrer")

  const [updatedUser, credential, recovery] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: user.id } }),
    db.localCredential.findUniqueOrThrow({ where: { userId: user.id } }),
    db.localRecoveryCode.findFirstOrThrow({ where: { userId: user.id } }),
  ])
  assert.equal(updatedUser.authVersion, 5)
  assert.ok(recovery.usedAt)
  assert.equal(await verifyPassword("old correct horse battery", credential.passwordHash), false)
  assert.equal(await verifyPassword("new correct horse battery staple", credential.passwordHash), true)

  const replay = await POST(recoveryRequest({
    email,
    recoveryCode: code,
    newPassword: "another correct horse battery",
  }))
  assert.equal(replay.status, 400)
  assert.equal((await replay.json()).error.code, "RECOVERY_FAILED")
})

test("recovery failures do not reveal whether an account exists and are throttled", async () => {
  const body = {
    email: "unknown@example.com",
    recoveryCode: "ffff-ffff-ffff-ffff-ffff-ffff-ffff-ffff",
    newPassword: "new correct horse battery staple",
  }
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failure = await POST(recoveryRequest(body))
    assert.equal(failure.status, 400)
    const payload = JSON.stringify(await failure.json())
    assert.doesNotMatch(payload, /unknown@example|ffff-ffff|battery/i)
  }

  const limited = await POST(recoveryRequest(body))
  assert.equal(limited.status, 429)
  assert.equal((await limited.json()).error.code, "RECOVERY_RATE_LIMITED")
})

test("recovery rejects malformed requests and unsupported methods", async () => {
  const invalid = await POST(recoveryRequest({
    email: "owner@example.com",
    recoveryCode: "not-a-code",
    newPassword: "too short",
  }))
  assert.equal(invalid.status, 400)
  assert.equal((await invalid.json()).error.code, "INVALID_REQUEST")

  const method = GET()
  assert.equal(method.status, 405)
  assert.equal(method.headers.get("allow"), "POST")
})
