import assert from "node:assert/strict"
import test from "node:test"

import {
  buildInviteExpiry,
  buildInviteToken,
  normalizeInviteEmail,
  resolveInviteStatus,
} from "../src/lib/workspace-invite-utils"

test("normalizeInviteEmail trims and lowercases", () => {
  assert.equal(normalizeInviteEmail("  User.Name+1@Example.COM "), "user.name+1@example.com")
})

test("buildInviteToken creates long unpredictable token", () => {
  const token = buildInviteToken()
  assert.equal(typeof token, "string")
  assert.equal(token.length, 48)
})

test("resolveInviteStatus keeps non-pending status", () => {
  const status = resolveInviteStatus({
    status: "REVOKED",
    expiresAt: new Date("2100-01-01T00:00:00.000Z"),
  })
  assert.equal(status, "REVOKED")
})

test("resolveInviteStatus marks pending invite as expired after expiry date", () => {
  const status = resolveInviteStatus(
    {
      status: "PENDING",
      expiresAt: new Date("2026-05-01T00:00:00.000Z"),
    },
    new Date("2026-05-31T00:00:00.000Z")
  )
  assert.equal(status, "EXPIRED")
})

test("buildInviteExpiry uses requested days", () => {
  const now = Date.now()
  const expires = buildInviteExpiry(3).getTime()
  const diffMs = expires - now
  assert.ok(diffMs > 2 * 24 * 60 * 60 * 1000)
  assert.ok(diffMs < 4 * 24 * 60 * 60 * 1000)
})
