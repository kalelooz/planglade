import assert from "node:assert/strict"
import test from "node:test"

import { sendEmail } from "../src/lib/email-delivery"

const originalProvider = process.env.FLOWBOARD_EMAIL_PROVIDER
const originalFrom = process.env.FLOWBOARD_EMAIL_FROM
const originalApiKey = process.env.RESEND_API_KEY

function restoreEnv() {
  process.env.FLOWBOARD_EMAIL_PROVIDER = originalProvider
  process.env.FLOWBOARD_EMAIL_FROM = originalFrom
  process.env.RESEND_API_KEY = originalApiKey
}

test("email delivery succeeds in console mode without explicit from address", async () => {
  process.env.FLOWBOARD_EMAIL_PROVIDER = "console"
  delete process.env.FLOWBOARD_EMAIL_FROM
  try {
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      text: "Hello",
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.provider, "console")
  } finally {
    restoreEnv()
  }
})

test("email delivery fails in resend mode when API key is missing", async () => {
  process.env.FLOWBOARD_EMAIL_PROVIDER = "resend"
  process.env.FLOWBOARD_EMAIL_FROM = "PlanGlade <invites@example.com>"
  delete process.env.RESEND_API_KEY
  try {
    const result = await sendEmail({
      to: "user@example.com",
      subject: "Test",
      text: "Hello",
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.provider, "resend")
      assert.match(result.error, /RESEND_API_KEY/i)
    }
  } finally {
    restoreEnv()
  }
})
