import { z } from 'zod'
import { getJson, sendJson } from '@/lib/api/client'

const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(['MENTION', 'ASSIGNED', 'COMMENT', 'STATUS']),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  isUnread: z.boolean(),
  workItemId: z.string().nullable(),
  actor: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
  }).passthrough().nullable(),
}).passthrough()

const notificationFeedSchema = z.object({
  notifications: z.array(notificationSchema),
  unreadCount: z.number().int().nonnegative(),
  lastReadAt: z.string().nullable(),
  preferences: z.record(z.string(), z.boolean()),
}).passthrough()

export type Notification = z.infer<typeof notificationSchema>

export function getNotifications(workspaceId: string, limit?: number, signal?: AbortSignal) {
  const limitQuery = limit === undefined ? '' : `&limit=${encodeURIComponent(String(limit))}`
  return getJson(
    `/api/notifications?workspaceId=${encodeURIComponent(workspaceId)}${limitQuery}`,
    notificationFeedSchema,
    signal,
  )
}

export function markNotificationsRead(workspaceId: string, notificationIds?: string[], signal?: AbortSignal) {
  return sendJson(
    '/api/notifications',
    'POST',
    { workspaceId, ...(notificationIds !== undefined ? { notificationIds } : {}) },
    z.object({ markedReadAt: z.string() }).passthrough(),
    signal,
  )
}
