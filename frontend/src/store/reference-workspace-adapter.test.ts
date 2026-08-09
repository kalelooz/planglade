import { describe, expect, it } from 'vitest'
import { createReferenceWorkspaceAdapter } from './reference-workspace-adapter'
import type { WorkspaceState } from '@/types'

function fixture(): WorkspaceState {
  return {
    workspaceName: 'Local', userName: 'Owner', projects: [], tasks: [], notes: [], inbox: [],
    people: [], labels: [], recents: [], settings: { theme: 'system', priorityDisplay: 'icon', weekStartsOn: 1, hideHomeCompleted: false },
  }
}

describe('reference workspace adapter', () => {
  it('falls back on corrupt data and persists valid state', () => {
    const values = new Map<string, string>([['planglade-workspace-v1', '{bad']])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    }
    const adapter = createReferenceWorkspaceAdapter(storage, fixture)

    expect(adapter.load().workspaceName).toBe('Local')
    adapter.save({ ...fixture(), workspaceName: 'Saved' })
    expect(adapter.load().workspaceName).toBe('Saved')
    expect(adapter.reset().workspaceName).toBe('Local')
    expect(values.size).toBe(0)
  })

  it('rejects partial persisted state before the provider reads required fields', () => {
    const partial = JSON.stringify({ workspaceName: 'Broken', userName: 'Owner', projects: [], tasks: [] })
    const storage = {
      getItem: () => partial,
      setItem: () => undefined,
      removeItem: () => undefined,
    }

    expect(createReferenceWorkspaceAdapter(storage, fixture).load()).toEqual(fixture())
  })
})
