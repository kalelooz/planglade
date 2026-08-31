import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { EntityTypeBadge, type EntityType } from '@/components/EntityTypeBadge'

describe('EntityTypeBadge', () => {
  it('renders immutable system types separately from custom labels', () => {
    const expected: Array<[EntityType, string]> = [
      ['capture', 'Capture'],
      ['task', 'Task'],
      ['project', 'Project'],
      ['note', 'Note'],
      ['person', 'Person'],
    ]

    for (const [type, label] of expected) {
      const html = renderToStaticMarkup(<EntityTypeBadge type={type} />)
      expect(html).toContain(`data-entity-type="${type}"`)
      expect(html).toContain(`aria-label="${label} type"`)
      expect(html).toContain(`>${label}</span>`)
      expect(html).not.toContain('button')
    }
  })
})
