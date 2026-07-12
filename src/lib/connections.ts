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
  sourceProject: ConnectionProject | null
  targetProject: ConnectionProject | null
}

export type ConnectionGraphNode = {
  id: string
  title: string
  projectName: string
  status: string
  x: number
  y: number
}

export type ConnectionGraphEdge = {
  id: string
  kind: Connection["kind"]
  sourceId: string
  targetId: string
  label: "blocks" | "relates to" | "has child"
  ariaLabel: string
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
      sourceProject: projectsById.get(source.projectId ?? "") ?? null,
      targetProject: projectsById.get(target.projectId ?? "") ?? null,
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
      sourceProject: projectsById.get(parent.projectId ?? "") ?? null,
      targetProject: projectsById.get(child.projectId ?? "") ?? null,
    })
  }

  return {
    connections,
    summary: {
      total: connections.length,
      blocking: connections.filter((connection) => connection.kind === "blocking").length,
      related: connections.filter((connection) => connection.kind === "related").length,
      hierarchy: connections.filter((connection) => connection.kind === "hierarchy").length,
      projects: new Set(
        connections.flatMap((connection) =>
          [connection.sourceProject?.id, connection.targetProject?.id].filter(Boolean) as string[]
        )
      ).size,
    },
  }
}

export function buildConnectionsGraphModel(connections: Connection[]) {
  const nodes = new Map<string, ConnectionGraphNode>()

  for (const connection of connections) {
    for (const [item, project] of [[connection.source, connection.sourceProject], [connection.target, connection.targetProject]] as const) {
      if (nodes.has(item.id)) continue
      const index = nodes.size
      nodes.set(item.id, {
        id: item.id,
        title: item.title,
        projectName: project?.name ?? "No project",
        status: item.status,
        x: 48 + (index % 3) * 288,
        y: 48 + Math.floor(index / 3) * 144,
      })
    }
  }

  const graphNodes = [...nodes.values()]
  const edges = connections.map((connection): ConnectionGraphEdge => {
    const blockedBy = connection.label === "is blocked by"
    const source = blockedBy ? connection.target : connection.source
    const target = blockedBy ? connection.source : connection.target
    const sourceProject = blockedBy ? connection.targetProject : connection.sourceProject
    const targetProject = blockedBy ? connection.sourceProject : connection.targetProject
    const label: ConnectionGraphEdge["label"] = connection.kind === "blocking" ? "blocks" : connection.kind === "related" ? "relates to" : "has child"

    return {
      id: connection.id,
      kind: connection.kind,
      sourceId: source.id,
      targetId: target.id,
      label,
      ariaLabel: `${source.title} (${sourceProject?.name ?? "No project"}) ${label} ${target.title} (${targetProject?.name ?? "No project"})`,
    }
  })

  return {
    nodes: graphNodes,
    edges,
    width: Math.max(936, 96 + Math.min(3, graphNodes.length) * 288),
    height: Math.max(384, 96 + Math.ceil(graphNodes.length / 3) * 144),
  }
}
