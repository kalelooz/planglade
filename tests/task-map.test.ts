import assert from "node:assert/strict"
import test from "node:test"

import { buildTaskMapModel, TASK_MAP_HARD_LIMIT } from "../src/lib/task-map"
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
    blockerIds: ["plan"],
  },
  {
    id: "loose",
    title: "Unsorted thought",
    status: "Backlog",
    priority: "Low",
    assignee: "owner",
    label: "Task",
    due: "",
    project: "",
  },
]

test("builds canonical task edges and persists project, no-project, and task placements", () => {
  const model = buildTaskMapModel({
    projects,
    workItems,
    statusFilter: "all",
    layout: {
      projectPlacements: [
        { projectId: "launch", x: 100, y: 200 },
        { projectId: null, x: 700, y: 200 },
      ],
      taskPlacements: [
        { workItemId: "plan", sectionId: null, x: 30, y: 70 },
      ],
    },
  })

  const projectNode = model.nodes.find((node) => node.id === "project:launch")
  const noProjectNode = model.nodes.find((node) => node.id === "project:no-project")
  const taskNode = model.nodes.find((node) => node.id === "task:plan")
  assert.deepEqual(projectNode?.position, { x: 100, y: 200 })
  assert.deepEqual(noProjectNode?.position, { x: 700, y: 200 })
  assert.deepEqual(taskNode?.position, { x: 30, y: 70 })
  assert.deepEqual(
    model.edges.map(({ source, target, kind }) => ({ source, target, kind })),
    [
      { source: "task:plan", target: "task:copy", kind: "hierarchy" },
      { source: "task:plan", target: "task:copy", kind: "dependency" },
    ],
  )
})

test("refuses canvas construction above the hard limit", () => {
  const manyItems = Array.from(
    { length: TASK_MAP_HARD_LIMIT + 1 },
    (_, index): WorkItem => ({
      id: `task-${index}`,
      title: `Task ${index}`,
      status: "To Do",
      priority: "Medium",
      assignee: "owner",
      label: "Task",
      due: "",
      project: "launch",
    }),
  )
  const model = buildTaskMapModel({
    projects,
    workItems: manyItems,
    statusFilter: "all",
  })
  assert.equal(model.overHardLimit, true)
  assert.equal(model.nodes.length, 0)
})
