import {
  projects as drawerProjects,
  tasks as drawerTasks,
  type ProjectStatus,
  type TaskStatus,
  type Priority,
} from "@/components/flowboard/drawer-data"

export interface WorkspaceTask {
  id: string
  title: string
  status: TaskStatus
  priority: Priority
  projectId: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

export interface WorkspaceProject {
  id: string
  name: string
  color: string
  status: ProjectStatus
}

export interface WorkspaceData {
  tasks: WorkspaceTask[]
  projects: WorkspaceProject[]
}

export interface HomeSections {
  today: WorkspaceTask[]
  overdue: WorkspaceTask[]
  inbox: WorkspaceTask[]
  counts: {
    openTasks: number
    today: number
    overdue: number
    inbox: number
  }
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function createTaskId(now: Date): string {
  const randomValue =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)

  return `task-${now.getTime()}-${randomValue}`
}

export function createQuickCaptureTask(
  input: { title: string },
  now = new Date()
): WorkspaceTask | null {
  const title = input.title.trim()
  if (!title) return null

  const timestamp = now.toISOString()

  return {
    id: createTaskId(now),
    title,
    status: "Backlog",
    priority: "Medium",
    projectId: null,
    dueDate: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
  }
}

function normalizeSeedDueDate(dueDate: string): string | null {
  const directDate = new Date(dueDate)
  if (!Number.isNaN(directDate.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(dueDate)) {
    return toDateKey(directDate)
  }

  const dateWithYear = new Date(`${dueDate}, 2026`)
  if (Number.isNaN(dateWithYear.getTime())) return null

  return toDateKey(dateWithYear)
}

export function getSeedWorkspaceData(): WorkspaceData {
  return {
    projects: drawerProjects.map((project) => ({
      id: project.id,
      name: project.name,
      color: project.color,
      status: project.status,
    })),
    tasks: drawerTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      projectId: task.projectId,
      dueDate: normalizeSeedDueDate(task.dueDate),
      createdAt: "2026-05-16T08:00:00.000Z",
      updatedAt: "2026-05-16T08:00:00.000Z",
      completedAt: task.status === "Done" ? "2026-05-16T08:00:00.000Z" : null,
    })),
  }
}

function isOpenTask(task: WorkspaceTask): boolean {
  return task.status !== "Done" && !task.completedAt
}

function byDueThenCreated(a: WorkspaceTask, b: WorkspaceTask): number {
  const aDate = a.dueDate ?? a.createdAt
  const bDate = b.dueDate ?? b.createdAt
  return aDate.localeCompare(bDate)
}

export function selectHomeSections(data: WorkspaceData, today = new Date()): HomeSections {
  const todayKey = toDateKey(today)
  const openTasks = data.tasks.filter(isOpenTask)
  const todayTasks = openTasks
    .filter((task) => task.dueDate === todayKey)
    .sort(byDueThenCreated)
  const overdueTasks = openTasks
    .filter((task) => task.dueDate !== null && task.dueDate < todayKey)
    .sort(byDueThenCreated)
  const inboxTasks = openTasks
    .filter((task) => task.projectId === null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    today: todayTasks,
    overdue: overdueTasks,
    inbox: inboxTasks,
    counts: {
      openTasks: openTasks.length,
      today: todayTasks.length,
      overdue: overdueTasks.length,
      inbox: inboxTasks.length,
    },
  }
}

export function toggleTaskDone(tasks: WorkspaceTask[], taskId: string, now = new Date()): WorkspaceTask[] {
  const timestamp = now.toISOString()

  return tasks.map((task) => {
    if (task.id !== taskId) return task

    const isDone = task.status === "Done" || task.completedAt !== null

    return {
      ...task,
      status: isDone ? "Backlog" : "Done",
      completedAt: isDone ? null : timestamp,
      updatedAt: timestamp,
    }
  })
}
