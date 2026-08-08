import assert from "node:assert/strict"
import test from "node:test"

import { updateUserSettingsSchema } from "../src/lib/contracts"

test("user settings accept PlanGlade planning preferences", () => {
  const result = updateUserSettingsSchema.safeParse({
    workspaceId: "workspace-1",
    userId: "user-1",
    theme: "dark",
    priorityDisplay: "text",
    weekStartsOn: 0,
    hideHomeCompleted: true,
  })
  assert.equal(result.success, true)
})

test("week start remains constrained to Sunday or Monday", () => {
  assert.equal(updateUserSettingsSchema.safeParse({ workspaceId: "workspace-1", userId: "user-1", weekStartsOn: 2 }).success, false)
})
