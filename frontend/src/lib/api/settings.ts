import { getJson, sendJson } from '@/lib/api/client'
import { userSettingsResponseSchema } from '@/lib/api/contracts'
import type { AppSettings } from '@/types'

export function getUserSettings(workspaceId: string, userId: string, signal?: AbortSignal) {
  return getJson(`/api/settings?workspaceId=${encodeURIComponent(workspaceId)}&userId=${encodeURIComponent(userId)}`, userSettingsResponseSchema, signal)
}

export function updateUserSettings(workspaceId: string, userId: string, patch: Partial<AppSettings>, signal?: AbortSignal) {
  return sendJson('/api/settings', 'PUT', { workspaceId, userId, ...patch }, userSettingsResponseSchema, signal)
}
