import assert from "node:assert/strict"
import test from "node:test"

import { canResendInvite, evaluateInviteAcceptance } from "../src/lib/workspace-invite-guards"

const actor = {
  actorUserId: "user-1",
  actorEmail: "user@example.com",
}

test("marks expired pending invite as expired", () => {
  const result = evaluateInviteAcceptance({
    status: "PENDING",
    expiresAt: new Date("2026-01-01T00:00:00.000Z"),
    acceptedById: null,
    inviteEmail: "user@example.com",
    ...actor,
  })

  assert.deepEqual(result, { kind: "expired" })
})

test("blocks revoked invite acceptance", () => {
  const result = evaluateInviteAcceptance({
    status: "REVOKED",
    expiresAt: new Date("2100-01-01T00:00:00.000Z"),
    acceptedById: null,
    inviteEmail: "user@example.com",
    ...actor,
  })

  assert.deepEqual(result, { kind: "revoked" })
})

test("treats accepted-by-self as idempotent acceptance", () => {
  const result = evaluateInviteAcceptance({
    status: "ACCEPTED",
    expiresAt: new Date("2100-01-01T00:00:00.000Z"),
    acceptedById: "user-1",
    inviteEmail: "user@example.com",
    ...actor,
  })

  assert.deepEqual(result, { kind: "accepted_self" })
})

test("blocks accepted invite when accepted by another account", () => {
  const result = evaluateInviteAcceptance({
    status: "ACCEPTED",
    expiresAt: new Date("2100-01-01T00:00:00.000Z"),
    acceptedById: "user-2",
    inviteEmail: "user@example.com",
    ...actor,
  })

  assert.deepEqual(result, { kind: "accepted_other" })
})

test("blocks invite acceptance on email mismatch", () => {
  const result = evaluateInviteAcceptance({
    status: "PENDING",
    expiresAt: new Date("2100-01-01T00:00:00.000Z"),
    acceptedById: null,
    inviteEmail: "different@example.com",
    ...actor,
  })

  assert.deepEqual(result, { kind: "email_mismatch" })
})

test("allows pending invite acceptance with matching email", () => {
  const result = evaluateInviteAcceptance({
    status: "PENDING",
    expiresAt: new Date("2100-01-01T00:00:00.000Z"),
    acceptedById: null,
    inviteEmail: "User@Example.com",
    ...actor,
  })

  assert.deepEqual(result, { kind: "allow" })
})

test("resend is blocked only for accepted invites", () => {
  assert.equal(canResendInvite("ACCEPTED"), false)
  assert.equal(canResendInvite("PENDING"), true)
  assert.equal(canResendInvite("REVOKED"), true)
  assert.equal(canResendInvite("EXPIRED"), true)
})
