import assert from "node:assert/strict"
import test from "node:test"

import { getConfiguredAuthMode, getPublicConfiguredAuthMode } from "../src/lib/auth-config"
import { sendEmail } from "../src/lib/email-delivery"
import { getConfiguredStorageProvider } from "../src/lib/storage"

const trackedKeys = [
  "PLANGLADE_AUTH_MODE",
  "NEXT_PUBLIC_PLANGLADE_AUTH_MODE",
  "PLANGLADE_STORAGE_PROVIDER",
  "PLANGLADE_EMAIL_PROVIDER",
  "PLANGLADE_EMAIL_FROM",
  "FLOWBOARD_AUTH_MODE",
  "NEXT_PUBLIC_FLOWBOARD_AUTH_MODE",
  "FLOWBOARD_STORAGE_PROVIDER",
  "FLOWBOARD_EMAIL_PROVIDER",
  "FLOWBOARD_EMAIL_FROM",
  "RESEND_API_KEY",
] as const

const originalEnv = Object.fromEntries(trackedKeys.map((key) => [key, process.env[key]]))

function resetEnv() {
  for (const key of trackedKeys) {
    const value = originalEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

test("PLANGLADE auth env names work and take priority over FLOWBOARD fallbacks", () => {
  resetEnv()
  try {
    process.env.PLANGLADE_AUTH_MODE = "nextauth"
    process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "nextauth"
    process.env.FLOWBOARD_AUTH_MODE = "firebase"
    process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE = "firebase"

    assert.equal(getConfiguredAuthMode(), "nextauth")
    assert.equal(getPublicConfiguredAuthMode(), "nextauth")
  } finally {
    resetEnv()
  }
})

test("FLOWBOARD auth env names still work as compatibility fallbacks", () => {
  resetEnv()
  try {
    process.env.FLOWBOARD_AUTH_MODE = "firebase"
    process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE = "firebase"

    assert.equal(getConfiguredAuthMode(), "firebase")
    assert.equal(getPublicConfiguredAuthMode(), "firebase")
  } finally {
    resetEnv()
  }
})

test("PLANGLADE storage provider works and takes priority over FLOWBOARD fallback", () => {
  resetEnv()
  try {
    process.env.PLANGLADE_STORAGE_PROVIDER = "firebase"
    process.env.FLOWBOARD_STORAGE_PROVIDER = "local"

    assert.equal(getConfiguredStorageProvider(), "firebase")
  } finally {
    resetEnv()
  }
})

test("FLOWBOARD storage provider still works as a compatibility fallback", () => {
  resetEnv()
  try {
    process.env.FLOWBOARD_STORAGE_PROVIDER = "firebase"

    assert.equal(getConfiguredStorageProvider(), "firebase")
  } finally {
    resetEnv()
  }
})

test("PLANGLADE email env names work and take priority over FLOWBOARD fallbacks", async () => {
  resetEnv()
  try {
    process.env.PLANGLADE_EMAIL_PROVIDER = "console"
    process.env.PLANGLADE_EMAIL_FROM = "PlanGlade <invites@planglade.local>"
    process.env.FLOWBOARD_EMAIL_PROVIDER = "disabled"

    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      text: "Hello",
    })

    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.provider, "console")
  } finally {
    resetEnv()
  }
})
