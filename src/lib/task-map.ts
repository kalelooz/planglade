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

export type TaskMapStatusFilter =
  | "all"
  | "open"
  | "completed"
  | Status

export type TaskMapLayout = {
  taskPlacements: Array<{
    workItemId: string
    sectionId: string | null
    x: number
    y: number
  }>
  projectPlacements: Array<{
    projectId: string | null
    x: number
    y: number
  }>
}

export type TaskMapProjectNode = {
  id: string
  type: "project"
  position: { x: number; y: number }
  width: number
  height: number
  data: {
    projectId: string | null
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

export type TaskMapModel = {
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

export function filterTaskMapItems(input: {
  workItems: WorkItem[]
  projectId?: string | null
  statusFilter: TaskMapStatusFilter
}) {
  return input.workItems.filter(
    (item) =>
      (!input.projectId || item.project === input.projectId) &&
      matchesStatus(item, input.statusFilter),
  )
}

export function buildTaskMapModel(input: {
  projects: Project[]
  workItems: WorkItem[]
  projectId?: string | null
  statusFilter: TaskMapStatusFilter
  layout?: TaskMapLayout | null
}): TaskMapModel {
  const items = filterTaskMapItems(input)
  if (items.length > TASK_MAP_HARD_LIMIT) {
    return {
      nodes: [],
      edges: [],
      items,
      totalMatching: items.length,
      overHardLimit: true,
      projectCount: new Set(items.map((item) => item.project || "no-project")).size,
    }
  }

  const projectsById = new Map(input.projects.map((project) => [project.id, project]))
  const grouped = new Map<string, WorkItem[]>()
  for (const item of items) {
    const key = projectsById.has(item.project) ? item.project : "no-project"
    grouped.set(key, [...(grouped.get(key) ?? []), item])
  }

  const orderedProjectIds = [
    ...input.projects.map((project) => project.id).filter((id) => grouped.has(id)),
    ...(grouped.has("no-project") ? ["no-project"] : []),
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

  const defaultProjectPositions = new Map<string, { x: number; y: number }>()
  let rowY = 0
  for (let index = 0; index < layouts.length; index += 2) {
    const left = layouts[index]
    const right = layouts[index + 1]
    defaultProjectPositions.set(left.id, { x: 0, y: rowY })
    if (right) {
      defaultProjectPositions.set(right.id, {
        x: left.width + PROJECT_COLUMN_GAP,
        y: rowY,
      })
    }
    rowY += Math.max(left.height, right?.height ?? 0) + PROJECT_ROW_GAP
  }

  const savedProjects = new Map(
    input.layout?.projectPlacements.map((placement) => [
      placement.projectId ?? "no-project",
      placement,
    ]) ?? [],
  )
  const savedTasks = new Map(
    input.layout?.taskPlacements.map((placement) => [placement.workItemId, placement]) ?? [],
  )
  const projectNodes: TaskMapProjectNode[] = []
  const taskNodes: TaskMapTaskNode[] = []

  for (const layout of layouts) {
    const project = projectsById.get(layout.id)
    const projectId = project?.id ?? null
    const projectName = project?.name ?? "No project"
    const projectNodeId = projectId ? `project:${projectId}` : "project:no-project"
    const savedProject = savedProjects.get(projectId ?? "no-project")
    projectNodes.push({
      id: projectNodeId,
      type: "project",
      position: savedProject
        ? { x: savedProject.x, y: savedProject.y }
        : defaultProjectPositions.get(layout.id) ?? { x: 0, y: 0 },
      width: layout.width,
      height: layout.height,
      data: {
        projectId,
        name: projectName,
        taskCount: layout.projectItems.length,
      },
    })

    layout.projectItems.forEach((item, index) => {
      const column = index % layout.columns
      const row = Math.floor(index / layout.columns)
      const savedTask = savedTasks.get(item.id)
      taskNodes.push({
        id: `task:${item.id}`,
        type: "task",
        parentId: projectNodeId,
        position: savedTask
          ? { x: savedTask.x, y: savedTask.y }
          : {
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
