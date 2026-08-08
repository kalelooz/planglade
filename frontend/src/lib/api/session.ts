import { getJson } from '@/lib/api/client'
import { sessionSchema } from '@/lib/api/contracts'

export function getSession(workspaceId?: string | null, signal?: AbortSignal) {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''
  return getJson(`/api/auth/session${query}`, sessionSchema, signal)
}
