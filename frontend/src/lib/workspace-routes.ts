export const WORKSPACE_PATHS = {
  home: '/app',
  inbox: '/app/inbox',
  tasks: '/app/tasks',
  projects: '/app/projects',
  notes: '/app/notes',
  calendar: '/app/calendar',
  connections: '/app/connections',
  plans: '/app/plans',
  settings: '/app/settings',
} as const

type LocationSuffix = {
  search?: string
  hash?: string
}

type RequiredSearchParams = Record<string, string | null | undefined>

type LegacyWorkspaceRedirect = {
  path: string
  to: string
  requiredSearchParams?: RequiredSearchParams
}

const LEGACY_WORKSPACE_PATHS = {
  inbox: '/inbox',
  tasks: '/tasks',
  projects: '/projects',
  notes: '/notes',
  calendar: '/calendar',
  connections: '/connections',
  plans: '/plans',
  settings: '/settings',
  board: '/board',
  myTasks: '/my-tasks',
} as const

export const LEGACY_WORKSPACE_REDIRECTS: readonly LegacyWorkspaceRedirect[] = [
  { path: LEGACY_WORKSPACE_PATHS.inbox, to: WORKSPACE_PATHS.inbox },
  { path: LEGACY_WORKSPACE_PATHS.tasks, to: WORKSPACE_PATHS.tasks },
  { path: LEGACY_WORKSPACE_PATHS.projects, to: WORKSPACE_PATHS.projects },
  { path: LEGACY_WORKSPACE_PATHS.notes, to: WORKSPACE_PATHS.notes },
  { path: LEGACY_WORKSPACE_PATHS.calendar, to: WORKSPACE_PATHS.calendar },
  { path: LEGACY_WORKSPACE_PATHS.connections, to: WORKSPACE_PATHS.connections },
  { path: LEGACY_WORKSPACE_PATHS.plans, to: WORKSPACE_PATHS.plans },
  { path: LEGACY_WORKSPACE_PATHS.settings, to: WORKSPACE_PATHS.settings },
  { path: LEGACY_WORKSPACE_PATHS.board, to: WORKSPACE_PATHS.tasks, requiredSearchParams: { view: 'board' } },
  { path: LEGACY_WORKSPACE_PATHS.myTasks, to: WORKSPACE_PATHS.tasks, requiredSearchParams: { filter: 'mine' } },
]

export const LEGACY_PROJECT_ROUTE = `${LEGACY_WORKSPACE_PATHS.projects}/:projectId`

function hasControlCharacters(value: string) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127
  })
}

function normalizedPathname(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

function validProjectId(projectId: unknown): projectId is string {
  return typeof projectId === 'string' &&
    projectId.length > 0 &&
    projectId !== '.' &&
    projectId !== '..' &&
    !/[\\/?#]/.test(projectId) &&
    !hasControlCharacters(projectId)
}

function normalizedSearch(search = '') {
  return search.startsWith('?') ? search.slice(1) : search
}

function normalizedHash(hash = '') {
  if (!hash) return ''
  return hash.startsWith('#') ? hash : `#${hash}`
}

function searchParamName(segment: string) {
  const separator = segment.indexOf('=')
  const encodedName = separator === -1 ? segment : segment.slice(0, separator)
  try {
    return decodeURIComponent(encodedName.replace(/\+/g, ' '))
  } catch {
    return null
  }
}

function mergeRequiredSearchParams(search: string, requiredSearchParams: RequiredSearchParams) {
  const required = Object.entries(requiredSearchParams)
  if (!required.length) return search

  const requiredNames = new Set(required.map(([name]) => name))
  const segments = search
    ? search.split('&').filter((segment) => {
        const name = searchParamName(segment)
        return name === null || !requiredNames.has(name)
      })
    : []
  for (const [name, value] of required) {
    if (value !== null && value !== undefined) segments.push(new URLSearchParams([[name, value]]).toString())
  }
  return segments.join('&')
}

export function withPreservedLocation(
  pathname: string,
  location: LocationSuffix = {},
  requiredSearchParams: RequiredSearchParams = {},
) {
  const search = mergeRequiredSearchParams(normalizedSearch(location.search), requiredSearchParams)
  return `${pathname}${search ? `?${search}` : ''}${normalizedHash(location.hash)}`
}

export function workspaceProjectPath(projectId: unknown) {
  return validProjectId(projectId)
    ? `${WORKSPACE_PATHS.projects}/${encodeURIComponent(projectId)}`
    : WORKSPACE_PATHS.projects
}

export function workspaceTasksPath(searchParams: RequiredSearchParams = {}) {
  return withPreservedLocation(WORKSPACE_PATHS.tasks, {}, searchParams)
}

export function workspaceNotePath(noteId: string | null | undefined) {
  return noteId
    ? withPreservedLocation(WORKSPACE_PATHS.notes, {}, { note: noteId })
    : WORKSPACE_PATHS.notes
}

function legacyProjectId(pathname: string) {
  const prefix = `${LEGACY_WORKSPACE_PATHS.projects}/`
  if (!pathname.startsWith(prefix)) return null
  const encodedProjectId = pathname.slice(prefix.length)
  if (!encodedProjectId || encodedProjectId.includes('/')) return null
  try {
    const projectId = decodeURIComponent(encodedProjectId)
    return validProjectId(projectId) ? projectId : null
  } catch {
    return null
  }
}

export function canonicalizeLegacyWorkspaceLocation(pathname: string, search = '', hash = '') {
  const normalized = normalizedPathname(pathname)
  const redirect = LEGACY_WORKSPACE_REDIRECTS.find((candidate) => candidate.path === normalized)
  if (redirect) return withPreservedLocation(redirect.to, { search, hash }, redirect.requiredSearchParams)

  const projectId = legacyProjectId(normalized)
  return projectId
    ? withPreservedLocation(workspaceProjectPath(projectId), { search, hash })
    : null
}
