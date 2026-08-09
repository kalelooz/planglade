import { seedWorkspace } from '@/data/seed'
import type { WorkspaceState } from '@/types'

const STORAGE_KEY = 'planglade-workspace-v1'

export interface ReferenceWorkspaceAdapter {
  load(): WorkspaceState
  save(state: WorkspaceState): void
  reset(): WorkspaceState
  nextId(prefix: string): string
}

export function createReferenceWorkspaceAdapter(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
  createSeed: () => WorkspaceState = seedWorkspace,
): ReferenceWorkspaceAdapter {
  return {
    load() {
      try {
        const raw = storage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw) as WorkspaceState
          if (parsed && Array.isArray(parsed.tasks) && Array.isArray(parsed.projects)) return parsed
        }
      } catch {
        // Corrupt or unavailable storage falls back to a fresh reference workspace.
      }
      return createSeed()
    },
    save(state) {
      storage.setItem(STORAGE_KEY, JSON.stringify(state))
    },
    reset() {
      storage.removeItem(STORAGE_KEY)
      return createSeed()
    },
    nextId(prefix) {
      return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
    },
  }
}
