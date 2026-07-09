import assert from "node:assert/strict"
import test from "node:test"

import {
  validateWorkspaceMemberRemoval,
  validateWorkspaceMemberRoleChange,
} from "../src/lib/workspace-member-guards"

test("blocks owner role downgrade", () => {
  const result = validateWorkspaceMemberRoleChange({
    workspaceOwnerId: "owner-1",
    targetUserId: "owner-1",
    nextRole: "ADMIN",
  })

  assert.deepEqual(result, {
    ok: false,
    message: "Workspace owner role cannot be downgraded",
  })
})

test("blocks OWNER even when the target is the current owner", () => {
  const result = validateWorkspaceMemberRoleChange({
    workspaceOwnerId: "owner-1",
    targetUserId: "owner-1",
    nextRole: "OWNER",
  })

  assert.deepEqual(result, {
    ok: false,
    message: "Ownership cannot be granted through member management",
  })
})

test("blocks OWNER grants through generic member management", () => {
  const result = validateWorkspaceMemberRoleChange({
    workspaceOwnerId: "owner-1",
    targetUserId: "member-1",
    nextRole: "OWNER",
  })

  assert.deepEqual(result, {
    ok: false,
    message: "Ownership cannot be granted through member management",
  })
})

test("blocks removing workspace owner", () => {
  const result = validateWorkspaceMemberRemoval({
    workspaceOwnerId: "owner-1",
    actorUserId: "admin-1",
    targetUserId: "owner-1",
  })

  assert.deepEqual(result, {
    ok: false,
    message: "Workspace owner cannot be removed",
  })
})

test("blocks admin self-removal", () => {
  const result = validateWorkspaceMemberRemoval({
    workspaceOwnerId: "owner-1",
    actorUserId: "admin-1",
    targetUserId: "admin-1",
  })

  assert.deepEqual(result, {
    ok: false,
    message: "Use a different admin/owner account to remove yourself",
  })
})

test("allows removing non-owner non-self member", () => {
  const result = validateWorkspaceMemberRemoval({
    workspaceOwnerId: "owner-1",
    actorUserId: "admin-1",
    targetUserId: "member-1",
  })

  assert.deepEqual(result, { ok: true })
})
