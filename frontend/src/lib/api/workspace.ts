import { getJson, sendJson } from '@/lib/api/client'
import { workspaceExportSchema, workspaceResponseSchema } from '@/lib/api/contracts'

export function getWorkspaceExport(workspaceId: string, signal?: AbortSignal) {
  return getJson(`/api/workspace/export?workspaceId=${encodeURIComponent(workspaceId)}`, workspaceExportSchema, signal)
}

export function createWorkspace(name: string, signal?: AbortSignal) {
  return sendJson('/api/workspaces', 'POST', { name }, workspaceResponseSchema, signal).then((response) => response.workspace)
}

export function updateWorkspace(workspaceId: string, patch: { name?: string }, signal?: AbortSignal) {
  return sendJson(`/api/workspaces/${encodeURIComponent(workspaceId)}`, 'PATCH', patch, workspaceResponseSchema, signal).then((response) => response.workspace)
}
