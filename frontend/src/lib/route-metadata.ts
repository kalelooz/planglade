import { matchPath } from 'react-router'
import { WORKSPACE_PATHS } from '@/lib/workspace-routes'

const landingTitle = 'PlanGlade — calm project planning'

const workspaceTitles = new Map<string, string>([
  [WORKSPACE_PATHS.home, 'Home · PlanGlade'],
  [WORKSPACE_PATHS.inbox, 'Inbox · PlanGlade'],
  [WORKSPACE_PATHS.tasks, 'Tasks · PlanGlade'],
  [WORKSPACE_PATHS.projects, 'Projects · PlanGlade'],
  [WORKSPACE_PATHS.notes, 'Notes · PlanGlade'],
  [WORKSPACE_PATHS.calendar, 'Calendar · PlanGlade'],
  [WORKSPACE_PATHS.connections, 'Connections · PlanGlade'],
  [WORKSPACE_PATHS.settings, 'Settings · PlanGlade'],
])

export function normalizeRoutePath(pathname: string) {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

function decodeRoutePath(pathname: string) {
  try {
    return normalizeRoutePath(pathname)
      .split('/')
      .map((segment) => decodeURIComponent(segment).replace(/\//g, '%2F'))
      .join('/')
  } catch {
    return null
  }
}

function matchesRoute(pathname: string, path: string) {
  return matchPath({ path, end: true }, pathname) !== null
}

export function routeTitle(pathname: string) {
  const decoded = decodeRoutePath(pathname)
  if (!decoded) return 'Page not found · PlanGlade'
  if (matchesRoute(decoded, '/')) return landingTitle
  if (matchesRoute(decoded, '/auth/login') || matchesRoute(decoded, '/login')) return 'Sign in · PlanGlade'
  if (matchesRoute(decoded, '/auth/recover')) return 'Recover local account · PlanGlade'

  for (const [path, title] of workspaceTitles) {
    if (matchesRoute(decoded, path)) return title
  }

  if (matchesRoute(decoded, `${WORKSPACE_PATHS.projects}/:projectId`)) return 'Project · PlanGlade'
  if (matchesRoute(decoded, '/setup')) return 'Set up PlanGlade'
  if (matchesRoute(decoded, '/onboarding')) return 'Open your workspace · PlanGlade'
  if (matchesRoute(decoded, '/invite/review')) return 'Review invitation · PlanGlade'
  return 'Page not found · PlanGlade'
}
