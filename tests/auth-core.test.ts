import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { getProviderCapabilities } from "../src/lib/auth-provider-capabilities"
import { normalizeEmail } from "../src/lib/local-auth-email"
import { hashPassword, verifyPassword } from "../src/lib/local-auth-password"
import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
let db: typeof import("../src/lib/db").db
let getAuthOptions: typeof import("../src/lib/auth-options").getAuthOptions
let resolveLegacyNextAuthUser: typeof import("../src/lib/local-auth-identity").resolveLegacyNextAuthUser
let resolveVerifiedApplicationUser: typeof import("../src/lib/local-auth-identity").resolveVerifiedApplicationUser
let originalUserFindUnique: typeof db.user.findUnique
let originalUserFindMany: typeof db.user.findMany
let originalUserUpdate: typeof db.user.update
let originalUserCreate: typeof db.user.create

before(async () => {
  ;({ db } = await import("../src/lib/db"))
  ;({ getAuthOptions } = await import("../src/lib/auth-options"))
  ;({ resolveLegacyNextAuthUser, resolveVerifiedApplicationUser } = await import("../src/lib/local-auth-identity"))
  originalUserFindUnique = db.user.findUnique
  originalUserFindMany = db.user.findMany
  originalUserUpdate = db.user.update
  originalUserCreate = db.user.create
})

after(async () => {
  await db.$disconnect()
  await isolatedDatabase.cleanup()
})

const originalEnv = {
  GITHUB_ID: process.env.GITHUB_ID,
  GITHUB_SECRET: process.env.GITHUB_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  PLANGLADE_LOCAL_AUTH_ENABLED: process.env.PLANGLADE_LOCAL_AUTH_ENABLED,
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

test("provider capabilities include local credentials only when explicitly enabled", () => {
  try {
    delete process.env.GITHUB_ID
    delete process.env.GITHUB_SECRET
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.PLANGLADE_LOCAL_AUTH_ENABLED
    assert.deepEqual(getProviderCapabilities(), {
      localCredentials: false,
      google: false,
      github: false,
      anyConfigured: false,
    })

    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "true"
    assert.deepEqual(getProviderCapabilities(), {
      localCredentials: true,
      google: false,
      github: false,
      anyConfigured: true,
    })

    process.env.GOOGLE_CLIENT_ID = "google-id"
    process.env.GOOGLE_CLIENT_SECRET = "google-secret"
    assert.deepEqual(getProviderCapabilities(), {
      localCredentials: true,
      google: true,
      github: false,
      anyConfigured: true,
    })

    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "yes"
    assert.throws(() => getProviderCapabilities(), /PLANGLADE_LOCAL_AUTH_ENABLED/)
  } finally {
    restoreEnv()
  }
})

test("NextAuth enables local credentials explicitly and derives JWT identity claims server-side", async () => {
  try {
    delete process.env.GITHUB_ID
    delete process.env.GITHUB_SECRET
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.PLANGLADE_LOCAL_AUTH_ENABLED
    assert.equal(getAuthOptions().providers.some((provider) => provider.id === "credentials"), false)

    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "true"
    const options = getAuthOptions()
    assert.equal(options.providers.some((provider) => provider.id === "credentials"), true)

    const jwt = options.callbacks?.jwt
    assert.ok(jwt)
    const token = await jwt({
      token: {},
      user: { id: "user-1", email: "person@example.com", authVersion: 3 },
      account: null,
      trigger: "signIn",
    })
    assert.deepEqual(token, { userId: "user-1", authVersion: 3 })
  } finally {
    restoreEnv()
  }
})

test("email normalization trims and lowercases without provider-specific rewriting", () => {
  assert.equal(normalizeEmail("  Name+tag.Example@Example.COM "), "name+tag.example@example.com")
  assert.equal(normalizeEmail("   "), null)
  assert.equal(normalizeEmail("not-an-email"), null)
})

test("password hashes are salted and verify asynchronously", async () => {
  const first = await hashPassword("correct horse battery staple")
  const second = await hashPassword("correct horse battery staple")

  assert.match(first, /^scrypt\$v1\$32768\$8\$3\$/)
  assert.notEqual(first, second)
  assert.equal(await verifyPassword("correct horse battery staple", first), true)
  assert.equal(await verifyPassword("wrong password", first), false)
  assert.equal(await verifyPassword("correct horse battery staple", "not-a-hash"), false)
  await assert.rejects(hashPassword("x".repeat(1025)), /Password is too long/)
})

test("verified identities use normalized email and backfill one transitional user", async () => {
  try {
    const user = { id: "user-1", email: "person@example.com", name: "Person", authVersion: 0 }
    ;(db.user as typeof db.user).findUnique = ((async () => null) as unknown) as typeof db.user.findUnique
    ;(db.user as typeof db.user).findMany = ((async () => [
      { ...user, email: "Person@Example.com", normalizedEmail: null },
    ]) as unknown) as typeof db.user.findMany
    let updateData: unknown
    ;(db.user as typeof db.user).update = ((async ({ data }) => {
      updateData = data
      return user
    }) as unknown) as typeof db.user.update

    const resolved = await resolveVerifiedApplicationUser({
      email: " person@example.com ",
      name: "Updated name",
    })

    assert.deepEqual(resolved, user)
    assert.deepEqual(updateData, { normalizedEmail: "person@example.com", name: "Updated name" })
  } finally {
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
    ;(db.user as typeof db.user).findMany = originalUserFindMany
    ;(db.user as typeof db.user).update = originalUserUpdate
  }
})

test("ambiguous transitional and legacy identity matches fail closed", async () => {
  try {
    ;(db.user as typeof db.user).findUnique = ((async () => null) as unknown) as typeof db.user.findUnique
    ;(db.user as typeof db.user).findMany = ((async () => [
      { id: "one", email: "person@example.com", normalizedEmail: null, authVersion: 0 },
      { id: "two", email: "PERSON@example.com", normalizedEmail: null, authVersion: 0 },
    ]) as unknown) as typeof db.user.findMany

    assert.equal(await resolveVerifiedApplicationUser({ email: "person@example.com" }), null)
    assert.equal(await resolveLegacyNextAuthUser("person@example.com"), null)
  } finally {
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
    ;(db.user as typeof db.user).findMany = originalUserFindMany
  }
})

test("new verified users are created with canonical email and normalized email", async () => {
  try {
    const created = { id: "user-2", email: "person@example.com", name: "Person", authVersion: 0 }
    ;(db.user as typeof db.user).findUnique = ((async () => null) as unknown) as typeof db.user.findUnique
    ;(db.user as typeof db.user).findMany = ((async () => []) as unknown) as typeof db.user.findMany
    let createData: unknown
    ;(db.user as typeof db.user).create = ((async ({ data }) => {
      createData = data
      return created
    }) as unknown) as typeof db.user.create

    assert.deepEqual(
      await resolveVerifiedApplicationUser({ email: " Person@Example.com ", name: "Person" }),
      created
    )
    assert.deepEqual(createData, {
      email: "Person@Example.com",
      normalizedEmail: "person@example.com",
      name: "Person",
      image: undefined,
    })
  } finally {
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
    ;(db.user as typeof db.user).findMany = originalUserFindMany
    ;(db.user as typeof db.user).create = originalUserCreate
  }
})
