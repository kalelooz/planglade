import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateAuthConfiguration,
  evaluateCanonicalPublicUrl,
  evaluateProductionConfiguration,
  evaluateStorageConfiguration,
} from "../src/lib/production-config.mjs"

const strongSecret = "test-secret-with-more-than-thirty-two-characters"

function productionEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    NODE_ENV: "production",
    PLANGLADE_AUTH_MODE: "nextauth",
    NEXT_PUBLIC_PLANGLADE_AUTH_MODE: "nextauth",
    PLANGLADE_LOCAL_AUTH_ENABLED: "true",
    NEXTAUTH_SECRET: strongSecret,
    NEXTAUTH_URL: "https://planglade.test",
    PLANGLADE_STORAGE_PROVIDER: "local",
    PLANGLADE_EMAIL_PROVIDER: "disabled",
    ...overrides,
  }
}

test("production configuration gives launch, runtime, and health one policy result", () => {
  const env = productionEnv()
  const configuration = evaluateProductionConfiguration(env, { productionLike: true })

  assert.deepEqual(configuration.errors, [])
  assert.deepEqual(configuration.auth, evaluateAuthConfiguration(env, { productionLike: true }))
  assert.deepEqual(configuration.storage, evaluateStorageConfiguration(env, { productionLike: true }))
  assert.equal(configuration.auth.providers.anyConfigured, true)
  assert.equal(configuration.storage.provider, "local")
})

test("production configuration rejects invalid auth, storage, email, and proxy settings together", () => {
  const configuration = evaluateProductionConfiguration(productionEnv({
    PLANGLADE_LOCAL_AUTH_ENABLED: "sometimes",
    NEXTAUTH_SECRET: "short",
    PLANGLADE_STORAGE_PROVIDER: "unknown",
    PLANGLADE_EMAIL_PROVIDER: "console",
    PLANGLADE_TRUST_PROXY_HOPS: "11",
  }), { productionLike: true })
  const errors = configuration.errors.join(" ")

  assert.match(errors, /PLANGLADE_LOCAL_AUTH_ENABLED/)
  assert.match(errors, /NEXTAUTH_SECRET/)
  assert.match(errors, /PLANGLADE_STORAGE_PROVIDER/)
  assert.match(errors, /console.*production/i)
  assert.match(errors, /PLANGLADE_TRUST_PROXY_HOPS/)
})

test("blank mode and provider values use their production defaults", () => {
  const configuration = evaluateProductionConfiguration(productionEnv({
    PLANGLADE_AUTH_MODE: "  ",
    NEXT_PUBLIC_PLANGLADE_AUTH_MODE: "",
    PLANGLADE_STORAGE_PROVIDER: " ",
    PLANGLADE_EMAIL_PROVIDER: "",
  }), { productionLike: true })

  assert.equal(configuration.auth.mode, "nextauth")
  assert.equal(configuration.auth.publicMode, "nextauth")
  assert.equal(configuration.storage.provider, "local")
  assert.equal(configuration.email.provider, "disabled")
  assert.deepEqual(configuration.errors, [])
})

test("canonical public URL preserves ports and rejects ambiguous authorities", () => {
  assert.deepEqual(evaluateCanonicalPublicUrl("http://localhost:8080/"), {
    origin: "http://localhost:8080",
    errors: [],
  })
  assert.deepEqual(evaluateCanonicalPublicUrl("https://example.com/"), {
    origin: "https://example.com",
    errors: [],
  })
  assert.match(evaluateCanonicalPublicUrl("http://example.com/").errors.join(" "), /HTTPS/)
  assert.match(evaluateCanonicalPublicUrl("https://example.com/app").errors.join(" "), /no path/)
  assert.match(evaluateCanonicalPublicUrl("https://user@example.com/").errors.join(" "), /credentials/)
})

test("every authentication mode requires the canonical origin used by mutation protection", () => {
  const firebaseEnv = productionEnv({
    PLANGLADE_AUTH_MODE: "firebase",
    NEXT_PUBLIC_PLANGLADE_AUTH_MODE: "firebase",
    NEXTAUTH_URL: undefined,
    FIREBASE_PROJECT_ID: "project-id",
    FIREBASE_STORAGE_BUCKET: "bucket",
    NEXT_PUBLIC_FIREBASE_API_KEY: "api-key",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "auth.example.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "project-id",
    NEXT_PUBLIC_FIREBASE_APP_ID: "app-id",
  })

  assert.match(
    evaluateAuthConfiguration(firebaseEnv, { productionLike: true }).errors.join(" "),
    /Missing NEXTAUTH_URL/,
  )
  assert.doesNotMatch(
    evaluateAuthConfiguration({ ...firebaseEnv, NEXTAUTH_URL: "https://app.example.com" }, { productionLike: true }).errors.join(" "),
    /NEXTAUTH_URL/,
  )
})
