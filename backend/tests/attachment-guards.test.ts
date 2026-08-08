import assert from "node:assert/strict"
import test from "node:test"

import { validateAttachmentProjectBoundary } from "../src/lib/attachment-guards"

test("allows attachment boundary when no project is associated", () => {
  const result = validateAttachmentProjectBoundary({
    workspaceId: "workspace-a",
    project: null,
  })

  assert.deepEqual(result, { ok: true })
})

test("blocks attachment boundary when project is outside workspace", () => {
  const result = validateAttachmentProjectBoundary({
    workspaceId: "workspace-a",
    project: {
      id: "project-1",
      workspaceId: "workspace-b",
      featureFlags: { attachments: true },
    },
  })

  assert.deepEqual(result, {
    ok: false,
    kind: "bad_request",
    message: "Project not found in workspace",
  })
})

test("blocks attachment boundary when attachment feature is disabled", () => {
  const result = validateAttachmentProjectBoundary({
    workspaceId: "workspace-a",
    project: {
      id: "project-1",
      workspaceId: "workspace-a",
      featureFlags: { attachments: false },
    },
  })

  assert.deepEqual(result, {
    ok: false,
    kind: "forbidden",
    message: "Attachments are disabled for this project",
  })
})

test("allows attachment boundary when workspace matches and feature is enabled", () => {
  const result = validateAttachmentProjectBoundary({
    workspaceId: "workspace-a",
    project: {
      id: "project-1",
      workspaceId: "workspace-a",
      featureFlags: { attachments: true },
    },
  })

  assert.deepEqual(result, { ok: true })
})
