import { deleteJson, getJson, sendJson } from '@/lib/api/client'
import {
  savedViewDeleteSchema,
  savedViewListSchema,
  savedViewResponseSchema,
  type BackendSavedView,
} from '@/lib/api/contracts'

export type SavedViewInput = Pick<BackendSavedView, 'workspaceId' | 'name' | 'layout' | 'isDefault'> & {
  projectId?: string
  groupBy?: string
  orderBy?: string
  filters?: Record<string, unknown>
  display?: Record<string, unknown>
}

export function getSavedViews(workspaceId: string, signal?: AbortSignal) {
  return getJson(`/api/saved-views?workspaceId=${encodeURIComponent(workspaceId)}`, savedViewListSchema, signal).then((response) => response.savedViews)
}

export function createSavedView(input: SavedViewInput, signal?: AbortSignal) {
  return sendJson('/api/saved-views', 'POST', input, savedViewResponseSchema, signal).then((response) => response.savedView)
}

export function updateSavedView(workspaceId: string, viewId: string, patch: Partial<SavedViewInput>, signal?: AbortSignal) {
  return sendJson(`/api/saved-views/${encodeURIComponent(viewId)}?workspaceId=${encodeURIComponent(workspaceId)}`, 'PATCH', patch, savedViewResponseSchema, signal).then((response) => response.savedView)
}

export function deleteSavedView(workspaceId: string, viewId: string, signal?: AbortSignal) {
  return deleteJson(`/api/saved-views/${encodeURIComponent(viewId)}?workspaceId=${encodeURIComponent(workspaceId)}`, savedViewDeleteSchema, signal)
}
