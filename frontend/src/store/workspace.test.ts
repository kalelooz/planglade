import { describe, expect, it, vi } from 'vitest'
import { loadApiSettings, saveApiSettings } from '@/lib/api-settings'

const defaults = {
  theme: 'system' as const,
  priorityDisplay: 'icon' as const,
  weekStartsOn: 1 as const,
  hideHomeCompleted: false,
}

describe('API UI settings', () => {
  it('keeps only supported browser-local UI preferences', () => {
    const settings = loadApiSettings({
      getItem: () => JSON.stringify({
        theme: 'dark',
        priorityDisplay: 'text',
        weekStartsOn: 0,
        hideHomeCompleted: true,
        workspaceId: 'client-controlled',
      }),
    })

    expect(settings).toEqual({ ...defaults, theme: 'dark', priorityDisplay: 'text', weekStartsOn: 0, hideHomeCompleted: true })
    expect(settings).not.toHaveProperty('workspaceId')
  })

  it('uses defaults for malformed storage and continues when persistence is unavailable', () => {
    expect(loadApiSettings({ getItem: () => '{' })).toEqual(defaults)
    expect(() => saveApiSettings(defaults, { setItem: vi.fn(() => { throw new Error('unavailable') }) })).not.toThrow()
  })
})
