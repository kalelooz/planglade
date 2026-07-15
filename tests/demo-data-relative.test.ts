import assert from "node:assert/strict"
import test from "node:test"

import { getDemoFixtures } from "@/lib/demo-data"

test("DEMO-UI-TRUST-001: demo fixtures stay useful relative to today", () => {
  const fixtures = getDemoFixtures(new Date(2026, 6, 14, 10))
  const taskById = new Map(fixtures.tasks.map((task) => [task.id, task]))

  assert.equal(taskById.get("reno-tile-quotes")?.due, "2026-07-14")
  assert.equal(taskById.get("bakery-menu-print")?.due, "2026-07-12")
  assert.equal(taskById.get("event-supply-list")?.due, "2026-07-22")
  assert.ok(fixtures.tasks.some((task) => task.status === "Backlog"), "fixtures include Inbox captures")
  assert.ok(fixtures.notes.some((note) => note.projectId === null), "fixtures include a global note")
  assert.ok(fixtures.notes.some((note) => note.projectId !== null), "fixtures include project-linked notes")
  assert.deepEqual(fixtures.apiTasks.map((task) => task.id), fixtures.tasks.map((task) => task.id))
})
