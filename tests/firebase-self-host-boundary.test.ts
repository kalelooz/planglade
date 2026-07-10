import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, promises as fs } from "node:fs"
import test from "node:test"

import { getAuthConfigErrors, getConfiguredAuthMode, getPublicConfiguredAuthMode } from "../src/lib/auth-config"
import { getConfiguredStorageProvider } from "../src/lib/storage"

// FIREBASE-SAAS-BOUNDARY-001 regression: the public self-host path must not
// require, default to, or advertise Firebase. These tests assert that with
// every Firebase variable absent the public defaults resolve to the self-host
// auth/storage path and never to Firebase.

const firebaseKeys = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_CLIENT_EMAIL",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_PRIVATE_KEY_BASE64",
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
] as const

const plangladeKeys = [
  "PLANGLADE_AUTH_MODE",
  "NEXT_PUBLIC_PLANGLADE_AUTH_MODE",
  "PLANGLADE_STORAGE_PROVIDER",
  "FLOWBOARD_AUTH_MODE",
  "NEXT_PUBLIC_FLOWBOARD_AUTH_MODE",
  "FLOWBOARD_STORAGE_PROVIDER",
] as const

const allKeys = [...firebaseKeys, ...plangladeKeys] as const
const originalEnv = Object.fromEntries(allKeys.map((key) => [key, process.env[key]]))
const originalNodeEnv = process.env.NODE_ENV
const env = process.env as Record<string, string | undefined>

function clearFirebaseAndModeEnv() {
  for (const key of allKeys) delete env[key]
}

function restoreEnv() {
  for (const key of allKeys) {
    const value = originalEnv[key]
    if (value === undefined) delete env[key]
    else env[key] = value
  }
  if (originalNodeEnv === undefined) delete env.NODE_ENV
  else env.NODE_ENV = originalNodeEnv
}

test("FIREBASE-SAAS-BOUNDARY-001: storage default never resolves to firebase, even in production", () => {
  clearFirebaseAndModeEnv()
  try {
    env.NODE_ENV = "production"
    // No PLANGLADE_STORAGE_PROVIDER / FLOWBOARD_STORAGE_PROVIDER set at all.
    assert.equal(getConfiguredStorageProvider(), "local")
  } finally {
    restoreEnv()
  }
})

test("FIREBASE-SAAS-BOUNDARY-001: production auth default resolves to nextauth without Firebase", () => {
  clearFirebaseAndModeEnv()
  try {
    env.NODE_ENV = "production"
    assert.equal(getConfiguredAuthMode(), "nextauth")
    assert.equal(getPublicConfiguredAuthMode(), "nextauth")
  } finally {
    restoreEnv()
  }
})

test("FIREBASE-SAAS-BOUNDARY-001: public self-host config is valid with every Firebase variable absent", () => {
  clearFirebaseAndModeEnv()
  try {
    env.NODE_ENV = "production"
    env.PLANGLADE_AUTH_MODE = "nextauth"
    env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "nextauth"
    env.NEXTAUTH_SECRET = "test-secret"
    env.NEXTAUTH_URL = "http://localhost:3000"

    // No Firebase variables are set; verify none are reported as missing.
    const auth = getAuthConfigErrors()
    assert.equal(auth.mode, "nextauth")
    assert.deepEqual(
      auth.errors.filter((error) => /firebase/i.test(error)),
      [],
      "no Firebase variable should be required in nextauth self-host mode",
    )

    // Storage must resolve to local and only ask for a signing secret.
    assert.equal(getConfiguredStorageProvider(), "local")
  } finally {
    restoreEnv()
  }
})

test("FIREBASE-SAAS-BOUNDARY-001: validate-auth-config passes for a Firebase-free self-host config", () => {
  // Run the real build-time validator as a subprocess with a clean, Firebase-free
  // production-like environment. It must exit 0 without requiring any Firebase var.
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    PLANGLADE_AUTH_MODE: "nextauth",
    NEXT_PUBLIC_PLANGLADE_AUTH_MODE: "nextauth",
    NEXTAUTH_SECRET: "test-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    PLANGLADE_STORAGE_PROVIDER: "local",
    PLANGLADE_STORAGE_SIGNING_SECRET: "test-signing-secret",
    PLANGLADE_EMAIL_PROVIDER: "disabled",
    // Deliberately omit every FIREBASE_* / NEXT_PUBLIC_FIREBASE_* variable.
  }
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ["scripts/validate-auth-config.mjs"], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "ignore", "pipe"],
    })
  }, "validate-auth-config must pass with no Firebase variables in a self-host production config")
})

test("FIREBASE-SAAS-BOUNDARY-001: validate-auth-config defaults production auth to nextauth", () => {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    NEXTAUTH_SECRET: "test-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    PLANGLADE_STORAGE_PROVIDER: "local",
    PLANGLADE_STORAGE_SIGNING_SECRET: "test-signing-secret",
    PLANGLADE_EMAIL_PROVIDER: "disabled",
  }
  assert.doesNotThrow(() => {
    execFileSync(process.execPath, ["scripts/validate-auth-config.mjs"], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "ignore", "pipe"],
    })
  }, "validate-auth-config must default to nextauth in production without Firebase variables")
})

test("FIREBASE-SAAS-BOUNDARY-001: validate-auth-config fails if someone re-defaults storage to firebase without credentials", () => {
  // Guard rail: if an operator (or a future regression) sets the SaaS-only
  // firebase storage provider without credentials, the validator must reject it.
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "production",
    PLANGLADE_AUTH_MODE: "nextauth",
    NEXT_PUBLIC_PLANGLADE_AUTH_MODE: "nextauth",
    NEXTAUTH_SECRET: "test-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    PLANGLADE_STORAGE_PROVIDER: "firebase",
    PLANGLADE_EMAIL_PROVIDER: "disabled",
  }
  let threw = false
  try {
    execFileSync(process.execPath, ["scripts/validate-auth-config.mjs"], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "ignore", "pipe"],
    })
  } catch {
    threw = true
  }
  assert.equal(threw, true, "firebase storage provider must require Firebase credentials")
})

test("FIREBASE-SAAS-BOUNDARY-001: public repo has no Firebase App Hosting config", () => {
  assert.equal(
    existsSync("apphosting.yaml"),
    false,
    "Firebase App Hosting config belongs in the private hosted SaaS codebase",
  )
})

test("FIREBASE-SAAS-BOUNDARY-001: extraction manifest inventories the Firebase session helper", async () => {
  const manifest = await fs.readFile("docs/FIREBASE_EXTRACTION_PLAN.md", "utf8")

  assert.match(manifest, /src\/lib\/server-session-client\.ts/)
})
