import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { createHmac } from "node:crypto"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { getAuthConfigErrors } from "../src/lib/auth-config"
import { createAttachmentUploadTarget, getStorageConfigErrors } from "../src/lib/storage"

const STRONG_SECRET = "test-secret-with-more-than-thirty-two-characters"
type MutableEnv = Record<string, string | undefined>
const relevantKeys = [
  "NODE_ENV",
  "CI",
  "PLANGLADE_AUTH_MODE",
  "NEXT_PUBLIC_PLANGLADE_AUTH_MODE",
  "PLANGLADE_LOCAL_AUTH_ENABLED",
  "NEXTAUTH_SECRET",
  "NEXTAUTH_URL",
  "PLANGLADE_TRUST_PROXY_HOPS",
  "PLANGLADE_STORAGE_PROVIDER",
  "PLANGLADE_STORAGE_SIGNING_SECRET",
  "PLANGLADE_EMAIL_PROVIDER",
] as const

const originalEnv = Object.fromEntries(relevantKeys.map((key) => [key, process.env[key]]))

function restoreEnv() {
  for (const key of relevantKeys) {
    const value = originalEnv[key]
    if (value === undefined) delete process.env[key]
    else Reflect.set(process.env, key, value)
  }
}

function validatorEnv(overrides: MutableEnv = {}): NodeJS.ProcessEnv {
  const env: MutableEnv = { ...process.env }
  for (const key of relevantKeys) delete env[key]
  return {
    ...env,
    NODE_ENV: "production",
    PLANGLADE_AUTH_MODE: "nextauth",
    NEXT_PUBLIC_PLANGLADE_AUTH_MODE: "nextauth",
    PLANGLADE_LOCAL_AUTH_ENABLED: "true",
    NEXTAUTH_SECRET: STRONG_SECRET,
    NEXTAUTH_URL: "http://localhost:3000",
    PLANGLADE_STORAGE_PROVIDER: "local",
    PLANGLADE_EMAIL_PROVIDER: "disabled",
    ...overrides,
  } as NodeJS.ProcessEnv
}

function runValidator(overrides: MutableEnv = {}) {
  return spawnSync(process.execPath, ["scripts/validate-auth-config.mjs"], {
    cwd: process.cwd(),
    env: validatorEnv(overrides),
    encoding: "utf8",
  })
}

test("production validator rejects template and short NextAuth secrets", () => {
  for (const secret of ["replace-with-a-random-nextauth-secret", "short-secret"]) {
    const result = runValidator({ NEXTAUTH_SECRET: secret })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /NEXTAUTH_SECRET.*(placeholder|at least 32)/i)
    assert.equal(result.stderr.includes(secret), false)
  }
})

test("production validator rejects explicitly reused signing secrets", () => {
  const result = runValidator({ PLANGLADE_STORAGE_SIGNING_SECRET: STRONG_SECRET })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /must not reuse NEXTAUTH_SECRET/i)
  assert.equal(result.stderr.includes(STRONG_SECRET), false)
})

test("production validator rejects console email but permits disabled email", () => {
  assert.equal(runValidator().status, 0)
  const consoleResult = runValidator({ PLANGLADE_EMAIL_PROVIDER: "console" })
  assert.notEqual(consoleResult.status, 0)
  assert.match(consoleResult.stderr, /console.*production/i)
})

test("production validator reports every configuration error in one run", () => {
  const result = runValidator({
    NEXTAUTH_SECRET: "short",
    PLANGLADE_STORAGE_PROVIDER: "unknown",
    PLANGLADE_EMAIL_PROVIDER: "console",
  })

  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /NEXTAUTH_SECRET/i)
  assert.match(result.stderr, /PLANGLADE_STORAGE_PROVIDER/i)
  assert.match(result.stderr, /console.*production/i)
})

test("trusted proxy hop count rejects unsafe or ambiguous values", () => {
  for (const value of ["-1", "1.5", "eleven", "11"]) {
    const result = runValidator({ PLANGLADE_TRUST_PROXY_HOPS: value })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /PLANGLADE_TRUST_PROXY_HOPS.*integer from 0 to 10/i)
  }

  assert.equal(runValidator({ PLANGLADE_TRUST_PROXY_HOPS: "1" }).status, 0)
})

test("production validator rejects placeholder optional provider secrets", () => {
  const result = runValidator({
    GOOGLE_CLIENT_ID: "replace-with-google-client-id",
    GOOGLE_CLIENT_SECRET: "replace-with-google-client-secret",
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /GOOGLE_CLIENT_SECRET.*placeholder/i)
})

test("runtime auth readiness rejects unsafe NextAuth secrets", () => {
  try {
    Reflect.set(process.env, "NODE_ENV", "production")
    process.env.PLANGLADE_AUTH_MODE = "nextauth"
    process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "nextauth"
    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "true"
    process.env.NEXTAUTH_URL = "http://localhost:3000"
    process.env.NEXTAUTH_SECRET = "replace-with-a-random-nextauth-secret"

    assert.match(getAuthConfigErrors().errors.join(" "), /NEXTAUTH_SECRET.*placeholder/i)
  } finally {
    restoreEnv()
  }
})

test("runtime auth readiness rejects invalid trusted proxy configuration", () => {
  try {
    process.env.PLANGLADE_TRUST_PROXY_HOPS = "all"
    assert.match(getAuthConfigErrors().errors.join(" "), /PLANGLADE_TRUST_PROXY_HOPS/i)
  } finally {
    restoreEnv()
  }
})

test("local storage derives a separate signing key from the operator secret", async () => {
  try {
    Reflect.set(process.env, "NODE_ENV", "production")
    process.env.PLANGLADE_STORAGE_PROVIDER = "local"
    process.env.NEXTAUTH_SECRET = STRONG_SECRET
    delete process.env.PLANGLADE_STORAGE_SIGNING_SECRET

    assert.deepEqual(getStorageConfigErrors().errors, [])
    const target = await createAttachmentUploadTarget({
      storageKey: "workspace-1/file.txt",
      mimeType: "text/plain",
      expiresInSeconds: 60,
    })
    const url = new URL(target.uploadUrl, "http://localhost")
    const expires = url.searchParams.get("expires") ?? ""
    const signature = url.searchParams.get("signature") ?? ""
    const rawReuseSignature = createHmac("sha256", STRONG_SECRET)
      .update(`upload|workspace-1/file.txt|text/plain|${expires}`)
      .digest("hex")

    assert.match(signature, /^[a-f0-9]{64}$/)
    assert.notEqual(signature, rawReuseSignature)
  } finally {
    restoreEnv()
  }
})

test("Docker validates runtime secrets before starting the standalone server", async () => {
  const dockerfile = await readFile("Dockerfile", "utf8")
  assert.match(dockerfile, /COPY[^\n]*validate-auth-config\.mjs/)
  assert.match(dockerfile, /COPY[^\n]*production-config\.mjs/)
  assert.match(dockerfile, /COPY[^\n]*production-secret-policy\.mjs/)
  assert.match(
    dockerfile,
    /CMD \["sh", "-c", "node scripts\/validate-auth-config\.mjs && exec node server\.js"\]/
  )
})
