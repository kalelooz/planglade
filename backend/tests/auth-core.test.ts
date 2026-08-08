import assert from "node:assert/strict"
import test, { after, before } from "node:test"

import { getProviderCapabilities, getProviderCapabilityResult } from "../src/lib/auth-provider-capabilities"
import { normalizeEmail } from "../src/lib/local-auth-email"
import { getDummyPasswordHash, hashPassword, verifyPassword } from "../src/lib/local-auth-password"
import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
let db: typeof import("../src/lib/db").db
let getAuthOptions: typeof import("../src/lib/auth-options").getAuthOptions
let authorizeLocalCredentials: typeof import("../src/lib/auth-options").authorizeLocalCredentials
let resolveLegacyNextAuthUser: typeof import("../src/lib/local-auth-identity").resolveLegacyNextAuthUser
let resolveVerifiedApplicationUser: typeof import("../src/lib/local-auth-identity").resolveVerifiedApplicationUser
let originalUserFindUnique: typeof db.user.findUnique
let originalUserFindMany: typeof db.user.findMany
let originalUserUpdate: typeof db.user.update
let originalUserCreate: typeof db.user.create
let originalLocalCredentialFindFirst: typeof db.localCredential.findFirst

before(async () => {
  ;({ db } = await import("../src/lib/db"))
  ;({ getAuthOptions, authorizeLocalCredentials } = await import("../src/lib/auth-options"))
  ;({ resolveLegacyNextAuthUser, resolveVerifiedApplicationUser } = await import("../src/lib/local-auth-identity"))
  originalUserFindUnique = db.user.findUnique
  originalUserFindMany = db.user.findMany
  originalUserUpdate = db.user.update
  originalUserCreate = db.user.create
  originalLocalCredentialFindFirst = db.localCredential.findFirst
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
    assert.deepEqual(getProviderCapabilityResult(), {
      capabilities: {
        localCredentials: false,
        google: true,
        github: false,
        anyConfigured: true,
      },
      errors: ["Invalid PLANGLADE_LOCAL_AUTH_ENABLED. Use true or false."],
    })
    assert.equal(getProviderCapabilities().localCredentials, false)
  } finally {
    restoreEnv()
  }
})

async function authorizeWithCredential(
  credential: unknown,
  password: string,
  verify: (candidate: string, hash: string) => Promise<boolean> = verifyPassword
) {
  ;(db.localCredential as typeof db.localCredential).findFirst = ((async () => credential) as unknown) as typeof db.localCredential.findFirst
  try {
    return await authorizeLocalCredentials({ email: "person@example.com", password }, verify)
  } finally {
    ;(db.localCredential as typeof db.localCredential).findFirst = originalLocalCredentialFindFirst
  }
}

test("unusable credentials verify the dummy hash but never authenticate", async () => {
  const hashes: string[] = []
  const dummyMatch = async (_password: string, hash: string) => {
    hashes.push(hash)
    return true
  }
  const user = { id: "user-1", email: "person@example.com", name: "Person", image: null, authVersion: 0 }

  for (const credential of [
    null,
    { passwordHash: "not-a-hash", disabledAt: null, user },
    { passwordHash: "scrypt$v2$32768$8$3$salt$key", disabledAt: null, user },
    { passwordHash: "not-a-hash", disabledAt: new Date(), user },
  ]) {
    assert.equal(await authorizeWithCredential(credential, "submitted-password", dummyMatch), null)
  }
  assert.deepEqual(hashes, Array(4).fill(getDummyPasswordHash()))
})

test("local credentials authenticate only with an eligible credential and valid password", async () => {
  const passwordHash = await hashPassword("correct horse battery staple")
  const user = { id: "user-1", email: "person@example.com", name: "Person", image: null, authVersion: 0 }
  const credential = { passwordHash, disabledAt: null, user }

  assert.equal((await authorizeWithCredential(credential, "wrong password")), null)
  assert.deepEqual(await authorizeWithCredential(credential, "correct horse battery staple"), user)
})

test("local credential callback contains database and crypto failures without leaking details", async () => {
  const leak = "C:\\private\\custom.db token=inert-token person@example.com STACK_MARKER"
  const logged: unknown[][] = []
  const originalConsoleError = console.error
  console.error = (...args: unknown[]) => logged.push(args)
  try {
    ;(db.localCredential as typeof db.localCredential).findFirst = ((async () => {
      throw new Error(leak)
    }) as unknown) as typeof db.localCredential.findFirst
    assert.equal(await authorizeLocalCredentials({ email: "person@example.com", password: "password" }), null)

    const user = { id: "user-1", email: "person@example.com", name: "Person", image: null, authVersion: 0 }
    const credential = { passwordHash: getDummyPasswordHash(), disabledAt: null, user }
    assert.equal(
      await authorizeWithCredential(credential, "password", async () => {
        throw new Error(leak)
      }),
      null
    )
    assert.equal(JSON.stringify(logged).includes(leak), false)
  } finally {
    ;(db.localCredential as typeof db.localCredential).findFirst = originalLocalCredentialFindFirst
    console.error = originalConsoleError
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

    process.env.GOOGLE_CLIENT_ID = "google-id"
    process.env.GOOGLE_CLIENT_SECRET = "google-secret"
    assert.equal(getAuthOptions().providers.some((provider) => provider.id === "google"), true)
    assert.equal(getAuthOptions().providers.some((provider) => provider.id === "credentials"), false)
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET

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

    process.env.PLANGLADE_LOCAL_AUTH_ENABLED = "invalid"
    assert.equal(getAuthOptions().providers.some((provider) => provider.id === "credentials"), false)
  } finally {
    restoreEnv()
  }
})

test("NextAuth resolves application users only from a verified Google profile email", async () => {
  try {
    let createData: unknown
    ;(db.user as typeof db.user).findUnique = ((async () => null) as unknown) as typeof db.user.findUnique
    ;(db.user as typeof db.user).findMany = ((async () => []) as unknown) as typeof db.user.findMany
    ;(db.user as typeof db.user).create = ((async ({ data }) => {
      createData = data
      return { id: "user-1", email: data.email, name: data.name, image: data.image, authVersion: 0 }
    }) as unknown) as typeof db.user.create

    const signIn = getAuthOptions().callbacks?.signIn
    assert.ok(signIn)
    const user: import("next-auth").User & { id?: string } = {
      id: "oauth-user",
      email: "PERSON@example.com",
      name: "Person",
      image: "https://example.com/avatar.png",
    }
    const profile = { email: "person@example.com", email_verified: true }
    const accepted = await signIn({
      user,
      account: { provider: "google", type: "oauth", providerAccountId: "google-user" },
      profile,
    })

    assert.equal(accepted, true)
    assert.deepEqual(createData, {
      email: "person@example.com",
      normalizedEmail: "person@example.com",
      name: "Person",
      image: "https://example.com/avatar.png",
    })
    assert.equal(user.id, "user-1")
    assert.equal(user.authVersion, 0)
  } finally {
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
    ;(db.user as typeof db.user).findMany = originalUserFindMany
    ;(db.user as typeof db.user).create = originalUserCreate
  }
})

test("rejected OAuth identity never reaches application-user resolution", async () => {
  try {
    let userLookups = 0
    ;(db.user as typeof db.user).findUnique = ((async () => {
      userLookups += 1
      return null
    }) as unknown) as typeof db.user.findUnique

    const signIn = getAuthOptions().callbacks?.signIn
    assert.ok(signIn)
    const profile = { email: "person@example.com", email_verified: false }
    const rejected = await signIn({
      user: { id: "oauth-user", email: "person@example.com" },
      account: { provider: "google", type: "oauth", providerAccountId: "google-user" },
      profile,
    })

    assert.equal(rejected, false)
    assert.equal(userLookups, 0)
  } finally {
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
  }
})

test("OAuth sign-in contains identity and application-user failures before mutating the user", async () => {
  const leak = "C:\\private\\custom.db token=inert-token person@example.com STACK_MARKER"
  const signIn = getAuthOptions().callbacks?.signIn
  assert.ok(signIn)

  const identityFailureUser = {
    id: "oauth-user",
    get email(): string {
      throw new Error(leak)
    },
  }
  assert.equal(
    await signIn({
      user: identityFailureUser,
      account: { provider: "google", type: "oauth", providerAccountId: "google-user" },
      profile: { email: "person@example.com", email_verified: true } as import("next-auth").Profile,
    }),
    false
  )
  assert.equal(identityFailureUser.id, "oauth-user")
  assert.equal("authVersion" in identityFailureUser, false)

  try {
    ;(db.user as typeof db.user).findUnique = ((async () => {
      throw new Error(leak)
    }) as unknown) as typeof db.user.findUnique
    const applicationFailureUser = { id: "oauth-user", email: "person@example.com" }
    assert.equal(
      await signIn({
        user: applicationFailureUser,
        account: { provider: "google", type: "oauth", providerAccountId: "google-user" },
        profile: { email: "person@example.com", email_verified: true } as import("next-auth").Profile,
      }),
      false
    )
    assert.equal(applicationFailureUser.id, "oauth-user")
    assert.equal("authVersion" in applicationFailureUser, false)
  } finally {
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
  }
})

test("legacy JWT lookup failures leave trusted claims unset", async () => {
  const jwt = getAuthOptions().callbacks?.jwt
  assert.ok(jwt)
  try {
    ;(db.user as typeof db.user).findUnique = ((async () => {
      throw new Error("C:\\private\\custom.db token=inert-token person@example.com STACK_MARKER")
    }) as unknown) as typeof db.user.findUnique
    assert.deepEqual(
      await jwt({ token: { email: "person@example.com" }, user: { id: "legacy-user" }, account: null, trigger: "update" }),
      { email: "person@example.com" }
    )
  } finally {
    ;(db.user as typeof db.user).findUnique = originalUserFindUnique
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
