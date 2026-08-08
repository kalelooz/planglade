import type { BackendSavedView } from '@/lib/api/contracts'
import type { SavedViewInput } from '@/lib/api/saved-views'
import {
  DEFAULT_TASK_PRESENTATION,
  TASK_DENSITIES,
  TASK_GROUP_KEYS,
  TASK_SORT_KEYS,
  TASK_VIEWS,
  type TaskPresentation,
  type TaskView,
} from '@/lib/task-views'

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function layout(value: string): TaskView {
  if (value === 'kanban') return 'board'
  return TASK_VIEWS.includes(value as TaskView) ? value as TaskView : 'list'
}

export function savedViewToPresentation(saved: BackendSavedView): TaskPresentation {
  const filters = record(saved.filters)
  const display = record(saved.display)
  const group = TASK_GROUP_KEYS.includes(saved.groupBy as TaskPresentation['group']) ? saved.groupBy as TaskPresentation['group'] : 'none'
  const sort = TASK_SORT_KEYS.includes(saved.orderBy as TaskPresentation['sort']) ? saved.orderBy as TaskPresentation['sort'] : 'due'
  const density = TASK_DENSITIES.includes(display.density as TaskPresentation['density']) ? display.density as TaskPresentation['density'] : 'comfortable'
  return {
    ...DEFAULT_TASK_PRESENTATION,
    view: layout(saved.layout),
    search: typeof filters.search === 'string' ? filters.search : '',
    quick: strings(filters.quick) as TaskPresentation['quick'],
    projects: strings(filters.projects),
    priorities: strings(filters.priorities),
    showCompleted: typeof filters.showCompleted === 'boolean' ? filters.showCompleted : true,
    sort,
    group,
    density,
    fields: strings(display.fields).length ? strings(display.fields) : DEFAULT_TASK_PRESENTATION.fields,
  }
}

export function presentationToSavedView(
  workspaceId: string,
  name: string,
  presentation: TaskPresentation,
  placement?: { pinned?: boolean; position?: number },
): SavedViewInput {
  return {
    workspaceId,
    name,
    layout: presentation.view,
    groupBy: presentation.group,
    orderBy: presentation.sort,
    filters: {
      search: presentation.search,
      quick: presentation.quick,
      projects: presentation.projects,
      priorities: presentation.priorities,
      showCompleted: presentation.showCompleted,
    },
    display: {
      version: 1,
      density: presentation.density,
      fields: presentation.fields,
      pinned: placement?.pinned ?? true,
      position: placement?.position ?? 0,
    },
    isDefault: false,
  }
}

export function savedViewPlacement(saved: BackendSavedView) {
  const display = record(saved.display)
  return {
    pinned: display.pinned !== false,
    position: typeof display.position === 'number' && Number.isFinite(display.position) ? display.position : 0,
  }
}
