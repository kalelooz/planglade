import { describe, expect, it } from 'vitest'
import { authLoginHref, normalizeWorkspaceDestination } from './auth-destination'

describe('authentication destinations', () => {
  it('defaults public-root and missing destinations to the workspace home', () => {
    expect(normalizeWorkspaceDestination(null)).toBe('/app')
    expect(normalizeWorkspaceDestination('/')).toBe('/app')
  })

  it('canonicalizes safe legacy workspace routes without losing path, query, or hash', () => {
    expect(normalizeWorkspaceDestination('/projects/project-1?tab=notes#today')).toBe('/app/projects/project-1?tab=notes#today')
    expect(normalizeWorkspaceDestination('/board?q=launch&view=list#today')).toBe('/app/tasks?q=launch&view=board#today')
    expect(authLoginHref('/tasks?view=timeline#week')).toBe('/auth/login?next=%2Fapp%2Ftasks%3Fview%3Dtimeline%23week')
  })

  it('preserves safe canonical and unknown local destinations', () => {
    expect(normalizeWorkspaceDestination('/app/projects/project-1?tab=notes#today')).toBe('/app/projects/project-1?tab=notes#today')
    expect(normalizeWorkspaceDestination('/local-extension?panel=one#top')).toBe('/local-extension?panel=one#top')
  })

  it('rejects external, encoded, and entry destinations', () => {
    for (const value of [
      'https://example.com',
      '//example.com',
      '/%2f%2fexample.com',
      '/\\example.com',
      '/login',
      '/auth/login/',
      '/setup',
      '/onboarding?next=/app',
      '/invite/review?inviteToken=secret',
    ]) {
      expect(normalizeWorkspaceDestination(value)).toBe('/app')
    }
  })
})
