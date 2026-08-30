import assert from "node:assert/strict"
import test from "node:test"

import { buildWorkspaceInviteDeliveryIdempotencyKey } from "../src/lib/workspace-invite-mailer"

test("invite delivery idempotency changes with each token rotation", () => {
  const first = buildWorkspaceInviteDeliveryIdempotencyKey({
    workspaceId: "workspace-1",
    inviteId: "invite-1",
    tokenVersion: 1,
  })
  const resent = buildWorkspaceInviteDeliveryIdempotencyKey({
    workspaceId: "workspace-1",
    inviteId: "invite-1",
    tokenVersion: 2,
  })

  assert.notEqual(first, resent)
  assert.equal(first, "workspace-invite:workspace-1:invite-1:v1")
})
