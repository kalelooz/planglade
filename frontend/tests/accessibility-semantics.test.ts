import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url))

describe('accessibility semantics', () => {
  it('connects every Settings section to its visible heading', () => {
    const settings = readFileSync(`${sourceRoot}/pages/Settings.tsx`, 'utf8')

    for (const id of ['s-workspace', 's-appearance', 's-dates', 's-data', 's-account']) {
      expect(settings).toContain(`<section aria-labelledby="${id}"`)
      expect(settings).toContain(`<SectionHeader id="${id}"`)
    }
  })

  it('uses native grouped radios and shared heading IDs', () => {
    const settings = readFileSync(`${sourceRoot}/pages/Settings.tsx`, 'utf8')
    const bits = readFileSync(`${sourceRoot}/components/bits.tsx`, 'utf8')

    expect(settings).toContain('<fieldset')
    expect(settings).toContain('type="radio"')
    expect(settings).toContain('name={groupName}')
    expect(settings).not.toContain('role="radio"')
    expect(bits).toContain('<h2 id={id}')
  })
})
