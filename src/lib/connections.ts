export type ConnectionProject = { id: string; name: string }
export type ConnectionWorkItem = {
  id: string
  title: string
  projectId: string | null
  parentId: string | null
  status: string
}
export type ConnectionRelation = {
  id: string
  sourceId: string
  targetId: string
  relationType: "BLOCKS" | "BLOCKED_BY" | "RELATES_TO" | string
}

export type Connection = {
  id: string
  kind: "blocking" | "related" | "hierarchy"
  label: "blocks" | "is blocked by" | "relates to" | "has child"
  source: ConnectionWorkItem
  target: ConnectionWorkItem
  project: ConnectionProject | null
}

export function buildConnectionsModel({
  projects,
  workItems,
  relations,
}: {
  projects: ConnectionProject[]
  workItems: ConnectionWorkItem[]
  relations: ConnectionRelation[]
}) {
  const itemsById = new Map(workItems.map((item) => [item.id, item]))
  const projectsById = new Map(projects.map((project) => [project.id, project]))
  const connections: Connection[] = []

  for (const relation of relations) {
    const source = itemsById.get(relation.sourceId)
    const target = itemsById.get(relation.targetId)
    if (!source || !target) continue
    if (relation.relationType !== "BLOCKS" && relation.relationType !== "BLOCKED_BY" && relation.relationType !== "RELATES_TO") continue

    connections.push({
      id: relation.id,
      kind: relation.relationType === "RELATES_TO" ? "related" : "blocking",
      label: relation.relationType === "BLOCKS" ? "blocks" : relation.relationType === "BLOCKED_BY" ? "is blocked by" : "relates to",
      source,
      target,
      project: projectsById.get(source.projectId ?? "") ?? null,
    })
  }

  for (const child of workItems) {
    if (!child.parentId) continue
    const parent = itemsById.get(child.parentId)
    if (!parent) continue
    connections.push({
      id: `parent:${parent.id}:${child.id}`,
      kind: "hierarchy",
      label: "has child",
      source: parent,
      target: child,
      project: projectsById.get(parent.projectId ?? "") ?? null,
    })
  }

  return {
    connections,
    summary: {
      total: connections.length,
      blocking: connections.filter((connection) => connection.kind === "blocking").length,
      related: connections.filter((connection) => connection.kind === "related").length,
      hierarchy: connections.filter((connection) => connection.kind === "hierarchy").length,
      projects: new Set(connections.flatMap((connection) => [connection.source.projectId, connection.target.projectId]).filter(Boolean)).size,
    },
  }
}

