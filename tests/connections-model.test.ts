import assert from "node:assert/strict"
import test from "node:test"

import { buildConnectionsModel } from "../src/lib/connections"

const projects = [{ id: "project-1", name: "Launch" }]
const workItems = [
  { id: "parent", title: "Plan launch", projectId: "project-1", parentId: null, status: "IN_PROGRESS" },
  { id: "child", title: "Approve copy", projectId: "project-1", parentId: "parent", status: "TODO" },
  { id: "blocker", title: "Confirm budget", projectId: "project-1", parentId: null, status: "TODO" },
]

test("builds text-explicit dependency and hierarchy connections", () => {
  const model = buildConnectionsModel({
    projects,
    workItems,
    relations: [
      { id: "dependency", sourceId: "child", targetId: "blocker", relationType: "BLOCKED_BY" },
      { id: "related", sourceId: "parent", targetId: "blocker", relationType: "RELATES_TO" },
    ],
  })

  assert.deepEqual(
    model.connections.map(({ id, label, source, target }) => ({ id, label, source: source.id, target: target.id })),
    [
      { id: "dependency", label: "is blocked by", source: "child", target: "blocker" },
      { id: "related", label: "relates to", source: "parent", target: "blocker" },
      { id: "parent:parent:child", label: "has child", source: "parent", target: "child" },
    ]
  )
  assert.deepEqual(model.summary, { total: 3, blocking: 1, related: 1, hierarchy: 1, projects: 1 })
})

test("normalizes BLOCKS direction and ignores missing work items", () => {
  const model = buildConnectionsModel({
    projects,
    workItems,
    relations: [
      { id: "blocks", sourceId: "blocker", targetId: "child", relationType: "BLOCKS" },
      { id: "missing", sourceId: "missing", targetId: "child", relationType: "RELATES_TO" },
    ],
  })

  assert.equal(model.connections[0]?.label, "blocks")
  assert.equal(model.connections[0]?.source.id, "blocker")
  assert.equal(model.connections[0]?.target.id, "child")
  assert.equal(model.connections.length, 2)
})

