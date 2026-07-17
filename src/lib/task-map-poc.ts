import type { Project, Status, WorkItem } from "@/lib/mock-data"

export const TASK_MAP_VISIBLE_TARGET = 250
export const TASK_MAP_HARD_LIMIT = 500

const TASK_WIDTH = 232
const TASK_HEIGHT = 92
const TASK_GAP = 20
const PROJECT_PADDING = 24
const PROJECT_HEADER_HEIGHT = 56
const PROJECT_COLUMN_GAP = 48
const PROJECT_ROW_GAP = 48

export type TaskMapStatusFilter = "all" | "open" | "completed" | Status

export type TaskMapProjectNode = {
  id: string
  type: "project"
  position: { x: number; y: number }
  width: number
  height: number
  data: {
    projectId: string
    name: string
    taskCount: number
  }
}

export type TaskMapTaskNode = {
  id: string
  type: "task"
  parentId: string
  position: { x: number; y: number }
  width: number
  height: number
  data: {
    taskId: string
    title: string
    status: Status
    priority: WorkItem["priority"]
    due: string
    projectName: string
    blocked: boolean
    isSubtask: boolean
  }
}

export type TaskMapEdge = {
  id: string
  source: string
  target: string
  kind: "hierarchy" | "dependency"
  label: "subtask" | "blocks"
}

export type TaskMapPocModel = {
  nodes: Array<TaskMapProjectNode | TaskMapTaskNode>
  edges: TaskMapEdge[]
  items: WorkItem[]
  totalMatching: number
  overHardLimit: boolean
  projectCount: number
}

function matchesStatus(item: WorkItem, filter: TaskMapStatusFilter) {
  if (filter === "all") return true
  if (filter === "open") return item.status !== "Done"
  if (filter === "completed") return item.status === "Done"
  return item.status === filter
}

export function filterTaskMapItems({
  workItems,
  projectId,
  statusFilter,
}: {
  workItems: WorkItem[]
  projectId?: string | null
  statusFilter: TaskMapStatusFilter
}) {
  return workItems.filter(
    (item) => (!projectId || item.project === projectId) && matchesStatus(item, statusFilter),
  )
}

export function buildTaskMapPocModel({
  projects,
  workItems,
  projectId,
  statusFilter,
}: {
  projects: Project[]
  workItems: WorkItem[]
  projectId?: string | null
  statusFilter: TaskMapStatusFilter
}): TaskMapPocModel {
  const items = filterTaskMapItems({ workItems, projectId, statusFilter })
  if (items.length > TASK_MAP_HARD_LIMIT) {
    return {
      nodes: [],
      edges: [],
      items,
      totalMatching: items.length,
      overHardLimit: true,
      projectCount: new Set(items.map((item) => item.project)).size,
    }
  }

  const projectsById = new Map(projects.map((project) => [project.id, project]))
  const grouped = new Map<string, WorkItem[]>()
  for (const item of items) {
    const key = projectsById.has(item.project) ? item.project : "unassigned"
    grouped.set(key, [...(grouped.get(key) ?? []), item])
  }

  const orderedProjectIds = [
    ...projects.map((project) => project.id).filter((id) => grouped.has(id)),
    ...(grouped.has("unassigned") ? ["unassigned"] : []),
  ]

  const layouts = orderedProjectIds.map((id) => {
    const projectItems = grouped.get(id) ?? []
    const columns = projectItems.length > 1 ? 2 : 1
    const rows = Math.max(1, Math.ceil(projectItems.length / columns))
    const width = PROJECT_PADDING * 2 + columns * TASK_WIDTH + (columns - 1) * TASK_GAP
    const height =
      PROJECT_HEADER_HEIGHT +
      PROJECT_PADDING +
      rows * TASK_HEIGHT +
      Math.max(0, rows - 1) * TASK_GAP
    return { id, projectItems, columns, width, height }
  })

  const projectPositions = new Map<string, { x: number; y: number }>()
  let rowY = 0
  for (let index = 0; index < layouts.length; index += 2) {
    const left = layouts[index]
    const right = layouts[index + 1]
    projectPositions.set(left.id, { x: 0, y: rowY })
    if (right) {
      projectPositions.set(right.id, {
        x: left.width + PROJECT_COLUMN_GAP,
        y: rowY,
      })
    }
    rowY += Math.max(left.height, right?.height ?? 0) + PROJECT_ROW_GAP
  }

  const projectNodes: TaskMapProjectNode[] = []
  const taskNodes: TaskMapTaskNode[] = []

  for (const layout of layouts) {
    const project = projectsById.get(layout.id)
    const projectName = project?.name ?? "No project"
    const projectNodeId = `project:${layout.id}`
    projectNodes.push({
      id: projectNodeId,
      type: "project",
      position: projectPositions.get(layout.id) ?? { x: 0, y: 0 },
      width: layout.width,
      height: layout.height,
      data: {
        projectId: layout.id,
        name: projectName,
        taskCount: layout.projectItems.length,
      },
    })

    layout.projectItems.forEach((item, index) => {
      const column = index % layout.columns
      const row = Math.floor(index / layout.columns)
      taskNodes.push({
        id: `task:${item.id}`,
        type: "task",
        parentId: projectNodeId,
        position: {
          x: PROJECT_PADDING + column * (TASK_WIDTH + TASK_GAP),
          y: PROJECT_HEADER_HEIGHT + row * (TASK_HEIGHT + TASK_GAP),
        },
        width: TASK_WIDTH,
        height: TASK_HEIGHT,
        data: {
          taskId: item.id,
          title: item.title,
          status: item.status,
          priority: item.priority,
          due: item.due,
          projectName,
          blocked: (item.blockerIds?.length ?? 0) > 0,
          isSubtask: Boolean(item.parentId),
        },
      })
    })
  }

  const visibleTaskIds = new Set(items.map((item) => item.id))
  const edges: TaskMapEdge[] = []
  const seenEdges = new Set<string>()

  for (const item of items) {
    if (item.parentId && visibleTaskIds.has(item.parentId)) {
      const id = `hierarchy:${item.parentId}:${item.id}`
      edges.push({
        id,
        source: `task:${item.parentId}`,
        target: `task:${item.id}`,
        kind: "hierarchy",
        label: "subtask",
      })
      seenEdges.add(id)
    }

    for (const blockerId of item.blockerIds ?? []) {
      if (!visibleTaskIds.has(blockerId)) continue
      const id = `dependency:${blockerId}:${item.id}`
      if (seenEdges.has(id)) continue
      edges.push({
        id,
        source: `task:${blockerId}`,
        target: `task:${item.id}`,
        kind: "dependency",
        label: "blocks",
      })
      seenEdges.add(id)
    }
  }

  return {
    nodes: [...projectNodes, ...taskNodes],
    edges,
    items,
    totalMatching: items.length,
    overHardLimit: false,
    projectCount: layouts.length,
  }
}
