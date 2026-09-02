import assert from "node:assert/strict"
import test from "node:test"

import { createNoteSchema, updateNoteSchema } from "../src/lib/contracts"

test("notes can be unlinked from a project only during update", () => {
  assert.equal(updateNoteSchema.safeParse({ projectId: null }).success, true)
  assert.equal(createNoteSchema.safeParse({ workspaceId: "workspace-1", title: "Note", projectId: null }).success, false)
})

test("note patch contracts do not apply create defaults", () => {
  assert.deepEqual(
    updateNoteSchema.parse({ title: "Renamed", expectedUpdatedAt: "2026-09-02T10:00:00.000Z" }),
    { title: "Renamed", expectedUpdatedAt: "2026-09-02T10:00:00.000Z" },
  )
})
