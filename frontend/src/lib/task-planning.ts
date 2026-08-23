import { differenceInCalendarDays, parseISO, startOfDay } from 'date-fns'
import type { Project, Task, TaskStatus } from '@/types'
import { STATUS_LABELS } from '@/types'
import type { TaskGroup, TaskPresentation } from '@/lib/task-views'

export type TaskPlanningGroup = {
  key: string
  label: string
  tasks: Task[]
}

export type TaskPlanningCount = {
  label: 'Open' | 'Backlog' | 'In progress' | 'In review' | 'Done'
  value: number
}

type TaskPlanningInput = {
  tasks: Task[]
  projects: Project[]
  presentation: TaskPresentation
  isBlocked: (task: Task) => boolean
  now?: Date
}

const PRIORITY_RANK = { high: 0, medium: 1, low: 2, none: 3 } as const
const STATUS_GROUP_ORDER: TaskStatus[] = ['backlog', 'planned', 'in_progress', 'in_review', 'blocked', 'done']
const DUE_GROUP_ORDER = ['overdue', 'today', 'week', 'later', 'none'] as const

function dueDistance(task: Task, today: Date) {
  return task.dueDate ? differenceInCalendarDays(parseISO(task.dueDate), today) : null
}

function matchesQuickFilters(task: Task, filters: Set<string>, today: Date, isBlocked: (task: Task) => boolean) {
  if (filters.size === 0) return true
  const distance = dueDistance(task, today)
  const checks = {
    today: distance === 0,
    upcoming: distance !== null && distance > 0,
    overdue: distance !== null && distance < 0 && task.status !== 'done',
    no_date: distance === null,
    blocked: isBlocked(task),
  }
  return [...filters].some((filter) => checks[filter as keyof typeof checks] ?? false)
}

function sortTasks(tasks: Task[], sort: TaskPresentation['sort']) {
  return [...tasks].sort((first, second) => {
    switch (sort) {
      case 'due':
        return (first.dueDate ?? '9999').localeCompare(second.dueDate ?? '9999') || first.createdAt - second.createdAt
      case 'priority':
        return PRIORITY_RANK[first.priority] - PRIORITY_RANK[second.priority] || (first.dueDate ?? '9999').localeCompare(second.dueDate ?? '9999')
      case 'created':
        return second.createdAt - first.createdAt
      case 'title':
        return first.title.localeCompare(second.title)
    }
  })
}

function groupKey(task: Task, group: TaskGroup, today: Date) {
  if (group === 'project') return task.projectId ?? 'none'
  if (group === 'status') return task.status
  if (group === 'due') {
    const distance = dueDistance(task, today)
    if (distance === null) return 'none'
    if (distance < 0) return 'overdue'
    if (distance === 0) return 'today'
    if (distance <= 7) return 'week'
    return 'later'
  }
  return 'all'
}

function groupLabel(key: string, group: TaskGroup, projects: Project[]) {
  if (group === 'project') return key === 'none' ? 'No project' : projects.find((project) => project.id === key)?.name ?? 'No project'
  if (group === 'status') return STATUS_LABELS[key as TaskStatus]
  if (key === 'overdue') return 'Overdue'
  if (key === 'today') return 'Today'
  if (key === 'week') return 'This week'
  if (key === 'later') return 'Later'
  return group === 'none' ? '' : 'No date'
}

function buildGroups(tasks: Task[], group: TaskGroup, projects: Project[], today: Date): TaskPlanningGroup[] {
  if (group === 'none') return [{ key: 'all', label: '', tasks }]
  const grouped = new Map<string, Task[]>()
  for (const task of tasks) {
    const key = groupKey(task, group, today)
    grouped.set(key, [...(grouped.get(key) ?? []), task])
  }
  const order = group === 'due'
    ? DUE_GROUP_ORDER
    : group === 'status'
      ? STATUS_GROUP_ORDER
      : [...grouped.keys()]
  return [...order]
    .filter((key) => grouped.has(key))
    .map((key) => ({ key, label: groupLabel(key, group, projects), tasks: grouped.get(key)! }))
}

function buildCounts(tasks: Task[]): TaskPlanningCount[] {
  const topLevel = tasks.filter((task) => !task.parentId)
  return [
    { label: 'Open', value: topLevel.filter((task) => task.status !== 'done').length },
    { label: 'Backlog', value: topLevel.filter((task) => task.status === 'backlog').length },
    { label: 'In progress', value: topLevel.filter((task) => task.status === 'in_progress').length },
    { label: 'In review', value: topLevel.filter((task) => task.status === 'in_review').length },
    { label: 'Done', value: topLevel.filter((task) => task.status === 'done').length },
  ]
}

export function buildTaskPlanningProjection({
  tasks,
  projects,
  presentation,
  isBlocked,
  now = new Date(),
}: TaskPlanningInput) {
  const today = startOfDay(now)
  const quick = new Set<string>(presentation.quick)
  const projectIds = new Set(presentation.projects)
  const priorities = new Set(presentation.priorities)
  const query = presentation.search.trim().toLowerCase()

  const selected = tasks.filter((task) => {
    if (task.parentId) return false
    if (!presentation.showCompleted && task.status === 'done') return false
    if (query && !`${task.title} ${task.description}`.toLowerCase().includes(query)) return false
    if (!matchesQuickFilters(task, quick, today, isBlocked)) return false
    if (projectIds.size > 0 && (!task.projectId || !projectIds.has(task.projectId))) return false
    if (priorities.size > 0 && !priorities.has(task.priority)) return false
    return true
  })
  const projectedTasks = sortTasks(selected, presentation.sort)

  return {
    tasks: projectedTasks,
    groups: buildGroups(projectedTasks, presentation.group, projects, today),
    counts: buildCounts(tasks),
  }
}

export function buildBoardColumns(tasks: Task[], statuses: TaskStatus[]) {
  const columns = new Map<TaskStatus, Task[]>()
  for (const status of statuses) columns.set(status, [])
  const ordered = [...tasks].sort((first, second) =>
    (first.position ?? 0) - (second.position ?? 0) || first.createdAt - second.createdAt)
  for (const task of ordered) columns.get(task.status)?.push(task)
  return columns
}

export function buildTimelineRows(tasks: Task[], projects: Project[]) {
  const scheduled = tasks.filter((task) => task.dueDate)
  const projectRows = projects
    .map((project) => ({ project, tasks: scheduled.filter((task) => task.projectId === project.id) }))
    .filter((row) => row.tasks.length > 0)
  const unassigned = scheduled.filter((task) => !task.projectId)
  return [...projectRows, ...(unassigned.length ? [{ project: null, tasks: unassigned }] : [])]
}
