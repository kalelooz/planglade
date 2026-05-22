import assert from "node:assert/strict"
import test from "node:test"

import { validateRelationProjectsBoundary } from "../src/lib/work-item-relation-guards"

test("allows relation boundary when no project IDs are present", () => {
  const result = validateRelationProjectsBoundary({
    workspaceId: "workspace-a",
    projectIds: [null, undefined, ""],
    projects: [],
  })

  assert.deepEqual(result, { ok: true })
})

test("blocks relation boundary when a related project cannot be resolved", () => {
  const result = validateRelationProjectsBoundary({
    workspaceId: "workspace-a",
    projectIds: ["project-1", "project-2"],
    projects: [{ id: "project-1", workspaceId: "workspace-a", featureFlags: { relations: true } }],
  })

  assert.deepEqual(result, {
    ok: false,
    kind: "bad_request",
    message: "One or more related projects were not found",
  })
})

test("blocks relation boundary when a related project is outside the workspace", () => {
  const result = validateRelationProjectsBoundary({
    workspaceId: "workspace-a",
    projectIds: ["project-1"],
    projects: [{ id: "project-1", workspaceId: "workspace-b", featureFlags: { relations: true } }],
  })

  assert.deepEqual(result, {
    ok: false,
    kind: "bad_request",
    message: "One or more related projects are outside this workspace",
  })
})

test("blocks relation boundary when project relations feature is disabled", () => {
  const result = validateRelationProjectsBoundary({
    workspaceId: "workspace-a",
    projectIds: ["project-1"],
    projects: [{ id: "project-1", workspaceId: "workspace-a", featureFlags: { relations: false } }],
  })

  assert.deepEqual(result, {
    ok: false,
    kind: "forbidden",
    message: "Work-item relations are disabled for one or more related projects",
  })
})

test("allows relation boundary when all related projects are in workspace and relations are enabled", () => {
  const result = validateRelationProjectsBoundary({
    workspaceId: "workspace-a",
    projectIds: ["project-1", "project-2", "project-1"],
    projects: [
      { id: "project-1", workspaceId: "workspace-a", featureFlags: { relations: true } },
      { id: "project-2", workspaceId: "workspace-a", featureFlags: { relations: true } },
    ],
  })

  assert.deepEqual(result, { ok: true })
})
