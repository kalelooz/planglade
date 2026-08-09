import { describe, expect, it } from 'vitest'
import { authLoginHref, normalizeWorkspaceDestination } from './auth-destination'

describe('authentication destinations', () => {
  it('preserves safe workspace routes through the backend login gateway', () => {
    expect(normalizeWorkspaceDestination('/projects/project-1?tab=notes#today')).toBe('/projects/project-1?tab=notes#today')
    expect(authLoginHref('/tasks?view=board')).toBe('/auth/login?next=%2Ftasks%3Fview%3Dboard')
  })

  it('rejects external, encoded, and recursive login destinations', () => {
    for (const value of ['https://example.com', '//example.com', '/%2f%2fexample.com', '/\\example.com', '/login', '/auth/login/', '/setup']) {
      expect(normalizeWorkspaceDestination(value)).toBe('/')
    }
  })
})
