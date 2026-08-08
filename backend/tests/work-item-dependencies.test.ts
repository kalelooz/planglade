import assert from "node:assert/strict"
import test from "node:test"

import { applyWorkItemDependencyRelations } from "../src/lib/work-item-dependencies"
import type { WorkItem } from "../src/lib/mock-data"

const baseItem = (id: string): WorkItem => ({
  id,
  title: id,
  status: "To Do",
  priority: "Medium",
  assignee: "user-1",
  label: "Task",
  due: "",
  project: "project-1",
})

test("maps BLOCKED_BY relations onto both linked tasks", () => {
  const [task, blocker] = applyWorkItemDependencyRelations([baseItem("task"), baseItem("blocker")], [
    {
      id: "relation-1",
      sourceId: "task",
      targetId: "blocker",
      relationType: "BLOCKED_BY",
    },
  ])

  assert.deepEqual(task.blockerIds, ["blocker"])
  assert.deepEqual(task.dependencyLinks, [{ relationId: "relation-1", taskId: "blocker", direction: "blockedBy" }])
  assert.deepEqual(blocker.blockingIds, ["task"])
  assert.deepEqual(blocker.dependencyLinks, [{ relationId: "relation-1", taskId: "task", direction: "blocking" }])
})

test("maps BLOCKS relations onto both linked tasks", () => {
  const [blocker, task] = applyWorkItemDependencyRelations([baseItem("blocker"), baseItem("task")], [
    {
      id: "relation-1",
      sourceId: "blocker",
      targetId: "task",
      relationType: "BLOCKS",
    },
  ])

  assert.deepEqual(task.blockerIds, ["blocker"])
  assert.deepEqual(blocker.blockingIds, ["task"])
})

test("ignores non-dependency relation types", () => {
  const [task] = applyWorkItemDependencyRelations([baseItem("task")], [
    {
      id: "relation-1",
      sourceId: "task",
      targetId: "other",
      relationType: "RELATES_TO",
    },
  ])

  assert.equal(task.blockerIds, undefined)
  assert.equal(task.blockingIds, undefined)
  assert.equal(task.dependencyLinks, undefined)
})
