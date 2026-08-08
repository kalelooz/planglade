import assert from "node:assert/strict"
import test from "node:test"

import { getParentTask, getSubtasks, subtaskProgress } from "../src/lib/work-item-hierarchy"
import type { WorkItem } from "../src/lib/mock-data"

const task = (id: string, parentId?: string, status: WorkItem["status"] = "To Do"): WorkItem => ({
  id,
  parentId,
  status,
  title: id,
  priority: "Medium",
  assignee: "user-1",
  label: "Task",
  due: "",
  project: "project-1",
})

test("finds subtasks and parent task", () => {
  const items = [task("parent"), task("child-1", "parent"), task("child-2", "parent"), task("other")]

  assert.deepEqual(getSubtasks(task("parent"), items).map((item) => item.id), ["child-1", "child-2"])
  assert.equal(getParentTask(task("child-1", "parent"), items)?.id, "parent")
})

test("computes subtask progress", () => {
  const items = [task("parent"), task("child-1", "parent", "Done"), task("child-2", "parent", "In Progress")]

  assert.deepEqual(subtaskProgress(task("parent"), items), { done: 1, total: 2, open: 1 })
})
