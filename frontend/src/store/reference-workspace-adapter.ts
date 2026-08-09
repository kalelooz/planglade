import { seedWorkspace } from '@/data/seed'
import type { WorkspaceState } from '@/types'

const STORAGE_KEY = 'planglade-workspace-v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isWorkspaceState(value: unknown): value is WorkspaceState {
  if (!isRecord(value) || typeof value.workspaceName !== 'string' || typeof value.userName !== 'string') return false
  for (const field of ['projects', 'tasks', 'notes', 'inbox', 'people', 'labels', 'recents']) {
    if (!Array.isArray(value[field])) return false
  }
  if (!isRecord(value.settings)) return false
  return ['light', 'dark', 'system'].includes(String(value.settings.theme))
    && ['icon', 'text'].includes(String(value.settings.priorityDisplay))
    && (value.settings.weekStartsOn === 0 || value.settings.weekStartsOn === 1)
    && typeof value.settings.hideHomeCompleted === 'boolean'
}

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
          const parsed: unknown = JSON.parse(raw)
          if (isWorkspaceState(parsed)) return parsed
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
