import assert from "node:assert/strict"
import test from "node:test"

import { canDeleteWorkspaceContent } from "../src/lib/permissions/content"

test("content deletion allows the creator and workspace admins", () => {
  assert.equal(canDeleteWorkspaceContent({ role: "MEMBER", actorUserId: "user-1", creatorUserId: "user-1" }), true)
  assert.equal(canDeleteWorkspaceContent({ role: "MEMBER", actorUserId: "user-1", creatorUserId: "user-2" }), false)
  assert.equal(canDeleteWorkspaceContent({ role: "ADMIN", actorUserId: "admin-1", creatorUserId: "user-2" }), true)
  assert.equal(canDeleteWorkspaceContent({ role: "OWNER", actorUserId: "owner-1" }), true)
  assert.equal(canDeleteWorkspaceContent({ role: "MEMBER", actorUserId: "user-1" }), false)
})
