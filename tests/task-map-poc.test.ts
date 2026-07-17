import assert from "node:assert/strict"
import test from "node:test"

import {
  buildTaskMapPocModel,
  TASK_MAP_HARD_LIMIT,
} from "../src/lib/task-map-poc"
import type { Project, WorkItem } from "../src/lib/mock-data"

const projects: Project[] = [
  {
    id: "launch",
    name: "Launch",
    status: "Active",
    due: "",
    owner: "owner",
    progress: 0,
    accent: "oklch(0.52 0.09 195)",
  },
  {
    id: "website",
    name: "Website",
    status: "Active",
    due: "",
    owner: "owner",
    progress: 0,
    accent: "oklch(0.52 0.09 195)",
  },
]

const workItems: WorkItem[] = [
  {
    id: "plan",
    title: "Plan release",
    status: "In Progress",
    priority: "High",
    assignee: "owner",
    label: "Task",
    due: "",
    project: "launch",
    blockingIds: ["ship"],
  },
  {
    id: "copy",
    title: "Approve copy",
    status: "To Do",
    priority: "Medium",
    assignee: "owner",
    label: "Task",
    due: "",
    project: "launch",
    parentId: "plan",
  },
  {
    id: "ship",
    title: "Publish site",
    status: "To Do",
    priority: "High",
    assignee: "owner",
    label: "Task",
    due: "",
    project: "website",
    blockerIds: ["plan"],
  },
  {
    id: "done",
    title: "Archive draft",
    status: "Done",
    priority: "Low",
    assignee: "owner",
    label: "Task",
    due: "",
    project: "website",
  },
]

test("builds project containers before task nodes and preserves canonical task ids", () => {
  const model = buildTaskMapPocModel({
    projects,
    workItems,
    statusFilter: "open",
  })

  assert.deepEqual(model.nodes.slice(0, 2).map((node) => node.type), ["project", "project"])
  assert.deepEqual(
    model.nodes.filter((node) => node.type === "task").map((node) => node.data.taskId),
    ["plan", "copy", "ship"],
  )
  assert.equal(model.projectCount, 2)
})

test("shows parent/subtask and normalized blocking edges without editing task truth", () => {
  const model = buildTaskMapPocModel({
    projects,
    workItems,
    statusFilter: "all",
  })

  assert.deepEqual(
    model.edges.map(({ source, target, kind, label }) => ({ source, target, kind, label })),
    [
      {
        source: "task:plan",
        target: "task:copy",
        kind: "hierarchy",
        label: "subtask",
      },
      {
        source: "task:plan",
        target: "task:ship",
        kind: "dependency",
        label: "blocks",
      },
    ],
  )
  assert.equal(workItems[0]?.blockingIds?.[0], "ship")
  assert.equal(workItems[2]?.blockerIds?.[0], "plan")
})

test("filters by project and completion state", () => {
  const model = buildTaskMapPocModel({
    projects,
    workItems,
    projectId: "website",
    statusFilter: "completed",
  })

  assert.equal(model.totalMatching, 1)
  assert.equal(model.items[0]?.id, "done")
  assert.equal(model.projectCount, 1)
})

test("uses the large-map fallback beyond the hard rendering limit", () => {
  const manyItems = Array.from({ length: TASK_MAP_HARD_LIMIT + 1 }, (_, index): WorkItem => ({
    id: `task-${index}`,
    title: `Task ${index}`,
    status: "To Do",
    priority: "Medium",
    assignee: "owner",
    label: "Task",
    due: "",
    project: "launch",
  }))
  const model = buildTaskMapPocModel({
    projects,
    workItems: manyItems,
    statusFilter: "all",
  })

  assert.equal(model.overHardLimit, true)
  assert.equal(model.nodes.length, 0)
  assert.equal(model.edges.length, 0)
  assert.equal(model.totalMatching, TASK_MAP_HARD_LIMIT + 1)
})
