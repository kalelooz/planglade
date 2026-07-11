import assert from "node:assert/strict"
import test from "node:test"

import { resolveVerifiedOAuthIdentity } from "../src/lib/oauth-verified-identity"

function account(provider: string, accessToken?: string) {
  return {
    provider,
    type: "oauth",
    providerAccountId: "account-1",
    ...(accessToken ? { access_token: accessToken } : {}),
  }
}

test("Google resolves only a matching provider-verified email", async () => {
  const identity = await resolveVerifiedOAuthIdentity({
    user: { email: "Person@Example.com", name: "Person", image: "https://example.com/avatar.png" },
    account: account("google"),
    profile: { email: "person@example.com", email_verified: true },
  })

  assert.deepEqual(identity, {
    email: "person@example.com",
    name: "Person",
    image: "https://example.com/avatar.png",
  })
})

test("Google rejects unverified, missing, malformed, and mismatched profiles", async () => {
  for (const profile of [
    { email: "person@example.com", email_verified: false },
    { email: "person@example.com" },
    { email: "person@example.com", email_verified: "true" },
    { email_verified: true },
    { email: "other@example.com", email_verified: true },
  ]) {
    assert.equal(
      await resolveVerifiedOAuthIdentity({
        user: { email: "person@example.com" },
        account: account("google"),
        profile,
      }),
      null
    )
  }
})

test("GitHub resolves exactly one matching verified email from its authenticated endpoint", async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = []
  const identity = await resolveVerifiedOAuthIdentity(
    {
      user: { email: "Person@Example.com", name: "Person" },
      account: account("github", "inert-test-token"),
    },
    {
      fetch: async (url, init) => {
        calls.push({ url: String(url), init })
        return new Response(JSON.stringify([{ email: "person@example.com", verified: true }]), { status: 200 })
      },
    }
  )

  assert.equal(identity?.email, "person@example.com")
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /\/user\/emails\?per_page=100$/)
  assert.equal(calls[0].init?.signal instanceof AbortSignal, true)
})

test("GitHub rejects unverified, mismatched, malformed, ambiguous, unavailable, and timed-out email evidence", async () => {
  const payloads: Array<unknown | Error> = [
    [{ email: "person@example.com", verified: false }],
    [{ email: "other@example.com", verified: true }],
    {},
    [],
    [
      { email: "person@example.com", verified: true },
      { email: "PERSON@example.com", verified: true },
    ],
    new Error("network failure"),
    new DOMException("request timed out", "TimeoutError"),
  ]

  for (const payload of payloads) {
    assert.equal(
      await resolveVerifiedOAuthIdentity(
        {
          user: { email: "person@example.com" },
          account: account("github", "inert-test-token"),
        },
        {
          fetch: async () => {
            if (payload instanceof Error) throw payload
            return new Response(JSON.stringify(payload), { status: 200 })
          },
        }
      ),
      null
    )
  }

  assert.equal(
    await resolveVerifiedOAuthIdentity(
      { user: { email: "person@example.com" }, account: account("github") },
      { fetch: async () => new Response("", { status: 200 }) }
    ),
    null
  )
  assert.equal(
    await resolveVerifiedOAuthIdentity(
      { user: { email: "person@example.com" }, account: account("github", "inert-test-token") },
      { fetch: async () => new Response("", { status: 500 }) }
    ),
    null
  )
})

test("unknown OAuth providers fail closed", async () => {
  assert.equal(
    await resolveVerifiedOAuthIdentity({
      user: { email: "person@example.com" },
      account: account("unsupported"),
      profile: { email: "person@example.com", email_verified: true },
    }),
    null
  )
})
