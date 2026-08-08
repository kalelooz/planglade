import assert from "node:assert/strict"
import test from "node:test"

import { createProjectSchema, updateProjectSchema } from "../src/lib/contracts"

const project = {
  workspaceId: "workspace-1",
  name: "Launch",
  slug: "launch",
  startDate: "2026-08-01T00:00:00.000Z",
  dueDate: "2026-08-31T00:00:00.000Z",
  icon: "rocket",
}

test("project contracts accept a valid schedule and allow dates to be cleared", () => {
  assert.equal(createProjectSchema.safeParse(project).success, true)
  assert.equal(updateProjectSchema.safeParse({ startDate: null, dueDate: null }).success, true)
})

test("project contracts reject icons outside the supported catalog", () => {
  assert.equal(createProjectSchema.safeParse({ ...project, icon: "made-up-icon" }).success, false)
})

test("project contracts reject a due date before the start date", () => {
  const result = createProjectSchema.safeParse({
    ...project,
    startDate: "2026-09-01T00:00:00.000Z",
  })

  assert.equal(result.success, false)
  if (!result.success) assert.equal(result.error.issues[0]?.path[0], "dueDate")
})
