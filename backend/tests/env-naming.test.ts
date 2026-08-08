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
  "RESEND_API_KEY",
] as const

const originalEnv = Object.fromEntries(trackedKeys.map((key) => [key, process.env[key]]))

function resetEnv() {
  for (const key of trackedKeys) {
    const value = originalEnv[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
}

test("PLANGLADE auth environment names configure server and client modes", () => {
  resetEnv()
  try {
    process.env.PLANGLADE_AUTH_MODE = "nextauth"
    process.env.NEXT_PUBLIC_PLANGLADE_AUTH_MODE = "nextauth"

    assert.equal(getConfiguredAuthMode(), "nextauth")
    assert.equal(getPublicConfiguredAuthMode(), "nextauth")
  } finally {
    resetEnv()
  }
})

test("PLANGLADE storage provider configures storage", () => {
  resetEnv()
  try {
    process.env.PLANGLADE_STORAGE_PROVIDER = "firebase"
    assert.equal(getConfiguredStorageProvider(), "firebase")
  } finally {
    resetEnv()
  }
})

test("PLANGLADE email environment names configure delivery", async () => {
  resetEnv()
  try {
    process.env.PLANGLADE_EMAIL_PROVIDER = "console"
    process.env.PLANGLADE_EMAIL_FROM = "PlanGlade <invites@planglade.local>"

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
