import { describe, expect, it } from 'vitest'
import { routeTitle } from '@/lib/route-metadata'

describe('route metadata', () => {
  it('labels known workspace and project-detail routes', () => {
    expect(routeTitle('/app')).toBe('Home · PlanGlade')
    expect(routeTitle('/app/tasks')).toBe('Tasks · PlanGlade')
    expect(routeTitle('/app/plans')).toBe('Plans · PlanGlade')
    expect(routeTitle('/app/projects/project-1')).toBe('Project · PlanGlade')
    expect(routeTitle('/auth/recover')).toBe('Recover local account · PlanGlade')
  })

  it('matches known routes case-insensitively and after URL decoding', () => {
    expect(routeTitle('/APP/TASKS/')).toBe('Tasks · PlanGlade')
    expect(routeTitle('/%61pp/%63alendar')).toBe('Calendar · PlanGlade')
    expect(routeTitle('/AUTH/%6Cogin')).toBe('Sign in · PlanGlade')
    expect(routeTitle('/APP/%70ROJECTS/Client%20Refresh')).toBe('Project · PlanGlade')
    expect(routeTitle('/app/projects/client%2Frefresh')).toBe('Project · PlanGlade')
  })

  it('labels unknown root and workspace routes as not found', () => {
    expect(routeTitle('/unknown')).toBe('Page not found · PlanGlade')
    expect(routeTitle('/app/unknown')).toBe('Page not found · PlanGlade')
    expect(routeTitle('/app/projects/project-1/unknown')).toBe('Page not found · PlanGlade')
  })
})
