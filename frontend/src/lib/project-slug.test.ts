import { describe, expect, it } from 'vitest'
import { isValidProjectSlug, projectSlugFromName } from '@/lib/project-slug'

describe('project slugs', () => {
  it('generates a URL-safe slug from a project name', () => {
    expect(projectSlugFromName('  Autumn Workshop Series  ')).toBe('autumn-workshop-series')
    expect(projectSlugFromName('Crème brûlée & Launch!')).toBe('creme-brulee-launch')
  })

  it('enforces the API slug contract', () => {
    expect(isValidProjectSlug('client-launch')).toBe(true)
    expect(isValidProjectSlug('x')).toBe(false)
    expect(isValidProjectSlug('Client Launch')).toBe(false)
  })
})
