import { describe, expect, it } from 'vitest'
import { inferProjectIcon, projectIcon } from './project-icons'

describe('project icons', () => {
  it('infers a relevant icon from common project titles', () => {
    expect(inferProjectIcon('Public MVP Launch')).toBe('rocket')
    expect(inferProjectIcon('Website redesign')).toBe('code')
    expect(inferProjectIcon('Autumn workshop series')).toBe('calendar')
  })

  it('falls back safely for unknown titles and stored values', () => {
    expect(inferProjectIcon('Something entirely new')).toBe('folder')
    expect(projectIcon('not-supported').name).toBe('folder')
  })
})
