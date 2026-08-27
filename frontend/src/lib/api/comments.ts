import { z } from 'zod'
import { getJson, sendJson } from '@/lib/api/client'

const commentSchema = z.object({
  id: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  author: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
  }).passthrough(),
  mentionUserIds: z.array(z.string()).optional(),
}).passthrough()

export type WorkItemComment = z.infer<typeof commentSchema>

export async function getWorkItemComments(workspaceId: string, workItemId: string, signal?: AbortSignal) {
  const response = await getJson(
    `/api/work-items/${encodeURIComponent(workItemId)}/comments?workspaceId=${encodeURIComponent(workspaceId)}`,
    z.object({ comments: z.array(commentSchema) }).passthrough(),
    signal,
  )
  return response.comments
}

export function createWorkItemComment(
  workspaceId: string,
  workItemId: string,
  input: { body: string },
  signal?: AbortSignal,
) {
  return sendJson(
    `/api/work-items/${encodeURIComponent(workItemId)}/comments?workspaceId=${encodeURIComponent(workspaceId)}`,
    'POST',
    input,
    z.object({ comment: commentSchema }).passthrough(),
    signal,
  ).then((response) => response.comment)
}
