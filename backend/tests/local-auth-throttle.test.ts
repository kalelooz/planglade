import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
let db: typeof import("../src/lib/db").db
let claimLoginVerification: typeof import("../src/lib/local-auth-throttle").claimLoginVerification
let clearLoginAccountThrottle: typeof import("../src/lib/local-auth-throttle").clearLoginAccountThrottle
let hashLoginAccountSubject: typeof import("../src/lib/local-auth-throttle").hashLoginAccountSubject

before(async () => {
  ;({ db } = await import("../src/lib/db"))
  ;({ claimLoginVerification, clearLoginAccountThrottle, hashLoginAccountSubject } =
    await import("../src/lib/local-auth-throttle"))
})

after(async () => {
  await db.$disconnect()
  await isolatedDatabase.cleanup()
})

test("parallel login claims allow at most five expensive verifications per account window", async () => {
  const claims = await Promise.all(
    Array.from({ length: 12 }, () => claimLoginVerification("person@example.com"))
  )

  assert.equal(claims.filter(Boolean).length, 5)
  const account = await db.authThrottle.findUnique({
    where: {
      scope_subjectKey: {
        scope: "LOGIN_ACCOUNT",
        subjectKey: hashLoginAccountSubject("person@example.com"),
      },
    },
  })
  assert.equal(account?.attemptCount, 5)
  assert.ok(account?.blockedUntil)
  assert.equal(account?.subjectKey.includes("person@example.com"), false)
  const global = await db.authThrottle.findUnique({
    where: { scope_subjectKey: { scope: "LOGIN_GLOBAL", subjectKey: "installation" } },
  })
  assert.equal(global?.attemptCount, 5)
})

test("successful authentication can clear only its account bucket", async () => {
  await clearLoginAccountThrottle("person@example.com")

  assert.equal(await db.authThrottle.findFirst({ where: { scope: "LOGIN_ACCOUNT" } }), null)
  assert.ok(await db.authThrottle.findUnique({
    where: { scope_subjectKey: { scope: "LOGIN_GLOBAL", subjectKey: "installation" } },
  }))
})
