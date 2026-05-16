import assert from "node:assert/strict"
import test from "node:test"

import {
  createQuickCaptureTask,
  selectHomeSections,
  type WorkspaceData,
} from "../src/components/flowboard/workspace-model"

const now = new Date("2026-05-16T09:30:00.000Z")

test("createQuickCaptureTask trims a title into a default Inbox task", () => {
  const task = createQuickCaptureTask({ title: "  Draft launch checklist  " }, now)

  assert.ok(task)
  assert.equal(task.title, "Draft launch checklist")
  assert.equal(task.status, "Backlog")
  assert.equal(task.priority, "Medium")
  assert.equal(task.projectId, null)
  assert.equal(task.dueDate, null)
  assert.equal(task.createdAt, now.toISOString())
  assert.equal(task.updatedAt, now.toISOString())
  assert.equal(task.completedAt, null)
})

test("createQuickCaptureTask ignores blank titles", () => {
  const task = createQuickCaptureTask({ title: "    " }, now)

  assert.equal(task, null)
})

test("selectHomeSections derives today, overdue, inbox, and counts from workspace tasks", () => {
  const data: WorkspaceData = {
    tasks: [
      {
        id: "task-overdue",
        title: "Pay vendor invoice",
        status: "In Progress",
        priority: "High",
        projectId: "project-1",
        dueDate: "2026-05-15",
        createdAt: "2026-05-10T08:00:00.000Z",
        updatedAt: "2026-05-10T08:00:00.000Z",
        completedAt: null,
      },
      {
        id: "task-today",
        title: "Review homepage wireframe",
        status: "Backlog",
        priority: "Medium",
        projectId: "project-1",
        dueDate: "2026-05-16",
        createdAt: "2026-05-12T08:00:00.000Z",
        updatedAt: "2026-05-12T08:00:00.000Z",
        completedAt: null,
      },
      {
        id: "task-inbox",
        title: "Capture unorganized note",
        status: "Backlog",
        priority: "Low",
        projectId: null,
        dueDate: null,
        createdAt: "2026-05-16T08:30:00.000Z",
        updatedAt: "2026-05-16T08:30:00.000Z",
        completedAt: null,
      },
      {
        id: "task-done",
        title: "Finished task",
        status: "Done",
        priority: "Low",
        projectId: null,
        dueDate: "2026-05-16",
        createdAt: "2026-05-14T08:00:00.000Z",
        updatedAt: "2026-05-14T08:00:00.000Z",
        completedAt: "2026-05-15T08:00:00.000Z",
      },
    ],
    projects: [
      {
        id: "project-1",
        name: "Website Redesign",
        color: "#01696f",
        status: "Active",
      },
    ],
  }

  const home = selectHomeSections(data, now)

  assert.deepEqual(home.today.map((task) => task.id), ["task-today"])
  assert.deepEqual(home.overdue.map((task) => task.id), ["task-overdue"])
  assert.deepEqual(home.inbox.map((task) => task.id), ["task-inbox"])
  assert.equal(home.counts.openTasks, 3)
  assert.equal(home.counts.today, 1)
  assert.equal(home.counts.overdue, 1)
  assert.equal(home.counts.inbox, 1)
})
