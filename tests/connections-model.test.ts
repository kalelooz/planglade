import assert from "node:assert/strict"
import test from "node:test"

import { buildConnectionsGraphModel, buildConnectionsModel } from "../src/lib/connections"

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

test("exposes project context for both sides of a cross-project relation", () => {
  const crossProjects = [
    { id: "project-1", name: "Launch" },
    { id: "project-2", name: "Website" },
  ]
  const crossItems = [
    { id: "alpha", title: "Draft release notes", projectId: "project-1", parentId: null, status: "IN_REVIEW" },
    { id: "beta", title: "Review homepage copy", projectId: "project-2", parentId: null, status: "IN_PROGRESS" },
  ]

  const model = buildConnectionsModel({
    projects: crossProjects,
    workItems: crossItems,
    relations: [{ id: "rel-cross", sourceId: "alpha", targetId: "beta", relationType: "RELATES_TO" }],
  })

  const relation = model.connections.find((connection) => connection.id === "rel-cross")
  assert.equal(relation?.sourceProject?.id, "project-1")
  assert.equal(relation?.sourceProject?.name, "Launch")
  assert.equal(relation?.targetProject?.id, "project-2")
  assert.equal(relation?.targetProject?.name, "Website")
  assert.equal(model.summary.projects, 2)
})

test("same-project relations show the same project on both sides", () => {
  const model = buildConnectionsModel({
    projects,
    workItems,
    relations: [{ id: "same", sourceId: "parent", targetId: "child", relationType: "RELATES_TO" }],
  })

  const relation = model.connections.find((connection) => connection.id === "same")
  assert.equal(relation?.sourceProject?.id, "project-1")
  assert.equal(relation?.targetProject?.id, "project-1")
})

test("builds directional, text-labelled graph edges including cross-project context", () => {
  const model = buildConnectionsModel({
    projects: [
      { id: "project-1", name: "Launch" },
      { id: "project-2", name: "Website" },
    ],
    workItems: [
      { id: "blocked", title: "Publish release", projectId: "project-1", parentId: null, status: "TODO" },
      { id: "blocker", title: "Approve copy", projectId: "project-2", parentId: null, status: "IN_PROGRESS" },
      { id: "child", title: "Send announcement", projectId: "project-1", parentId: "blocked", status: "BACKLOG" },
    ],
    relations: [
      { id: "blocked-by", sourceId: "blocked", targetId: "blocker", relationType: "BLOCKED_BY" },
      { id: "related", sourceId: "blocked", targetId: "blocker", relationType: "RELATES_TO" },
    ],
  })

  const graph = buildConnectionsGraphModel(model.connections)

  assert.deepEqual(
    graph.edges.map(({ id, sourceId, targetId, label }) => ({ id, sourceId, targetId, label })),
    [
      { id: "blocked-by", sourceId: "blocker", targetId: "blocked", label: "blocks" },
      { id: "related", sourceId: "blocked", targetId: "blocker", label: "relates to" },
      { id: "parent:blocked:child", sourceId: "blocked", targetId: "child", label: "has child" },
    ]
  )
  assert.match(graph.edges[0]?.ariaLabel ?? "", /Approve copy \(Website\) blocks Publish release \(Launch\)/)
  assert.equal(graph.nodes.find((node) => node.id === "blocked")?.status, "TODO")
})
