import { deleteJson, getJson, sendJson } from '@/lib/api/client'
import {
  workItemRelationDeleteSchema,
  workItemRelationListSchema,
  workItemRelationResponseSchema,
} from '@/lib/api/contracts'

export async function getWorkItemRelations(workspaceId: string, signal?: AbortSignal) {
  const response = await getJson(`/api/work-item-relations?workspaceId=${encodeURIComponent(workspaceId)}`, workItemRelationListSchema, signal)
  return response.relations
}

export async function createBlockedByRelation(workspaceId: string, blockedTaskId: string, blockerTaskId: string, signal?: AbortSignal) {
  const response = await sendJson('/api/work-item-relations', 'POST', {
    workspaceId,
    sourceId: blockedTaskId,
    targetId: blockerTaskId,
    relationType: 'BLOCKED_BY',
  }, workItemRelationResponseSchema, signal)
  return response.relation
}

export async function deleteWorkItemRelation(workspaceId: string, relationId: string, signal?: AbortSignal) {
  return deleteJson(
    `/api/work-item-relations/${encodeURIComponent(relationId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    workItemRelationDeleteSchema,
    signal,
  )
}
