export const TASK_VIEWS = ['list', 'board', 'timeline'] as const
export type TaskView = typeof TASK_VIEWS[number]

export const QUICK_FILTER_KEYS = ['today', 'upcoming', 'overdue', 'no_date', 'blocked'] as const
export type TaskQuickFilter = typeof QUICK_FILTER_KEYS[number]
export const TASK_SORT_KEYS = ['due', 'priority', 'created', 'title'] as const
export type TaskSort = typeof TASK_SORT_KEYS[number]
export const TASK_GROUP_KEYS = ['none', 'project', 'status', 'due'] as const
export type TaskGroup = typeof TASK_GROUP_KEYS[number]
export const TASK_DENSITIES = ['comfortable', 'compact'] as const
export type TaskDensity = typeof TASK_DENSITIES[number]

export type TaskPresentation = {
  version: 1
  view: TaskView
  search: string
  quick: TaskQuickFilter[]
  projects: string[]
  priorities: string[]
  showCompleted: boolean
  sort: TaskSort
  group: TaskGroup
  density: TaskDensity
  fields: string[]
}

export const DEFAULT_TASK_PRESENTATION: TaskPresentation = {
  version: 1,
  view: 'list',
  search: '',
  quick: [],
  projects: [],
  priorities: [],
  showCompleted: true,
  sort: 'due',
  group: 'none',
  density: 'comfortable',
  fields: ['project', 'status', 'dueDate', 'priority'],
}

export function taskViewFromQuery(value: string | null): TaskView {
  return TASK_VIEWS.includes(value as TaskView) ? value as TaskView : 'list'
}

function listed<T extends string>(value: string | null, allowed?: readonly T[]): T[] {
  if (!value) return []
  const values = [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))] as T[]
  return allowed ? values.filter((item) => allowed.includes(item)) : values
}

function oneOf<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback
}

export function taskPresentationFromQuery(params: URLSearchParams): TaskPresentation {
  return {
    version: 1,
    view: taskViewFromQuery(params.get('view')),
    search: params.get('q') ?? '',
    quick: listed(params.get('when'), QUICK_FILTER_KEYS),
    projects: listed(params.get('projects')),
    priorities: listed(params.get('priorities')),
    showCompleted: params.get('completed') !== '0',
    sort: oneOf(params.get('sort'), TASK_SORT_KEYS, 'due'),
    group: oneOf(params.get('group'), TASK_GROUP_KEYS, 'none'),
    density: oneOf(params.get('density'), TASK_DENSITIES, 'comfortable'),
    fields: listed(params.get('fields')).length ? listed(params.get('fields')) : DEFAULT_TASK_PRESENTATION.fields,
  }
}

export function taskPresentationToQuery(presentation: TaskPresentation, savedViewId?: string | null) {
  const params = new URLSearchParams()
  if (presentation.view !== 'list') params.set('view', presentation.view)
  if (presentation.search) params.set('q', presentation.search)
  if (presentation.quick.length) params.set('when', [...presentation.quick].sort().join(','))
  if (presentation.projects.length) params.set('projects', [...presentation.projects].sort().join(','))
  if (presentation.priorities.length) params.set('priorities', [...presentation.priorities].sort().join(','))
  if (!presentation.showCompleted) params.set('completed', '0')
  if (presentation.sort !== 'due') params.set('sort', presentation.sort)
  if (presentation.group !== 'none') params.set('group', presentation.group)
  if (presentation.density !== 'comfortable') params.set('density', presentation.density)
  if (presentation.fields.join(',') !== DEFAULT_TASK_PRESENTATION.fields.join(',')) params.set('fields', presentation.fields.join(','))
  if (savedViewId) params.set('saved', savedViewId)
  return params
}
