import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { z } from "zod"

import { badRequest, parseJsonBody, parseQuery, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import {
  NOTIFICATION_KEYS,
  extractReadNotificationIds,
  extractNotificationLastReadAt,
  mergeReadNotificationIds,
  mergeNotificationMetadata,
  normalizeNotificationPreferences,
} from "@/lib/notification-preferences"

function asJsonObject(value: Prisma.JsonValue | null): Record<string, Prisma.JsonValue> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, Prisma.JsonValue>
}

function asStringArray(value: Prisma.JsonValue | undefined) {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string")
}

function asString(value: Prisma.JsonValue | undefined) {
  return typeof value === "string" ? value : null
}

function asStringList(value: Prisma.JsonValue | undefined) {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === "string")
}

const notificationsQuerySchema = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

const markReadSchema = z.object({
  workspaceId: z.string().min(1),
  userId: z.string().min(1).optional(),
  lastReadAt: z.string().datetime().optional(),
  notificationIds: z.array(z.string().min(1)).optional(),
})

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      userId: request.nextUrl.searchParams.get("userId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? "20",
    },
    notificationsQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? query.data.userId,
      "MEMBER"
    )
    if (!access.ok) return access.response

    const targetUserId = query.data.userId ?? access.actor.userId
    if (targetUserId !== access.actor.userId && access.actor.role !== "ADMIN" && access.actor.role !== "OWNER") {
      return badRequest("Cannot fetch notifications for another user")
    }

    const userSettings = await db.userSettings.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: query.data.workspaceId,
          userId: targetUserId,
        },
      },
      select: { notifications: true },
    })
    const prefs = normalizeNotificationPreferences(userSettings?.notifications)
    const lastReadAtValue = extractNotificationLastReadAt(userSettings?.notifications)
    const lastReadAt = lastReadAtValue ? new Date(lastReadAtValue) : null
    const hasValidReadCursor = Boolean(lastReadAt && !Number.isNaN(lastReadAt.getTime()))
    const readNotificationIds = new Set(extractReadNotificationIds(userSettings?.notifications))

    const events = await db.activityEvent.findMany({
      where: { workspaceId: query.data.workspaceId },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 400,
    })

    const workItemIds = Array.from(
      new Set(
        events
          .filter((event) => event.entityType === "WORK_ITEM")
          .map((event) => event.entityId)
      )
    )
    const workItems = workItemIds.length
      ? await db.workItem.findMany({
          where: { id: { in: workItemIds } },
          select: { id: true, title: true, assigneeId: true },
        })
      : []
    const workItemById = new Map(workItems.map((workItem) => [workItem.id, workItem]))

    const notifications: Array<{
      id: string
      type: "MENTION" | "ASSIGNED" | "COMMENT" | "STATUS"
      title: string
      body: string
      createdAt: Date
      workItemId: string | null
      actor: { id: string; name: string | null; email: string } | null
      eventId: string
    }> = []

    for (const event of events) {
      if (event.actorId === targetUserId) continue

      const metadata = asJsonObject(event.metadata)
      const workItem = event.entityType === "WORK_ITEM" ? workItemById.get(event.entityId) ?? null : null
      const mentionUserIds = asStringArray(metadata?.mentionUserIds)
      const newAssigneeId = asString(metadata?.newAssigneeId) ?? asString(metadata?.assigneeId)
      const changedFields = asStringList(metadata?.changedFields)
      const mentionsTarget = mentionUserIds.includes(targetUserId)
      const assignedToTarget = newAssigneeId === targetUserId
      const isCommentOnMyItem = event.action === "COMMENTED" && workItem?.assigneeId === targetUserId
      const isStatusEvent =
        workItem?.assigneeId === targetUserId &&
        (event.action === "MOVED" ||
          event.action === "COMPLETED" ||
          (event.action === "UPDATED" &&
            (changedFields.includes("status") || changedFields.includes("dueDate"))))

      if (prefs[NOTIFICATION_KEYS.mentioned] && mentionsTarget) {
        notifications.push({
          id: `${event.id}:mention`,
          type: "MENTION",
          title: "You were mentioned",
          body: event.summary ?? "You were mentioned in a comment",
          createdAt: event.createdAt,
          workItemId: workItem?.id ?? null,
          actor: event.actor,
          eventId: event.id,
        })
        continue
      }

      if (prefs[NOTIFICATION_KEYS.assignedToMe] && assignedToTarget) {
        notifications.push({
          id: `${event.id}:assigned`,
          type: "ASSIGNED",
          title: "Task assigned to you",
          body: event.summary ?? `Assigned to ${workItem?.title ?? "a task"}`,
          createdAt: event.createdAt,
          workItemId: workItem?.id ?? null,
          actor: event.actor,
          eventId: event.id,
        })
        continue
      }

      if (prefs[NOTIFICATION_KEYS.commentsOnMyItems] && isCommentOnMyItem) {
        notifications.push({
          id: `${event.id}:comment`,
          type: "COMMENT",
          title: "Comment on your task",
          body: event.summary ?? `New comment on ${workItem?.title ?? "your task"}`,
          createdAt: event.createdAt,
          workItemId: workItem?.id ?? null,
          actor: event.actor,
          eventId: event.id,
        })
        continue
      }

      if (prefs[NOTIFICATION_KEYS.statusChanges] && isStatusEvent) {
        const dueChanged = changedFields.includes("dueDate")
        notifications.push({
          id: `${event.id}:status`,
          type: "STATUS",
          title: dueChanged ? "Due date changed" : "Task status changed",
          body: event.summary ?? `Updated ${workItem?.title ?? "your task"}`,
          createdAt: event.createdAt,
          workItemId: workItem?.id ?? null,
          actor: event.actor,
          eventId: event.id,
        })
      }
    }

    return NextResponse.json({
      notifications: notifications.slice(0, query.data.limit).map((notification) => {
        const markedRead = readNotificationIds.has(notification.id)
        const isUnread = markedRead ? false : hasValidReadCursor ? notification.createdAt > (lastReadAt as Date) : true
        return {
          ...notification,
          createdAt: notification.createdAt.toISOString(),
          isUnread,
        }
      }),
      unreadCount: notifications.reduce((count, notification) => {
        const markedRead = readNotificationIds.has(notification.id)
        const isUnread = markedRead ? false : hasValidReadCursor ? notification.createdAt > (lastReadAt as Date) : true
        return isUnread ? count + 1 : count
      }, 0),
      lastReadAt: lastReadAtValue,
      preferences: prefs,
    })
  } catch (error) {
    return serverError("Failed to load notifications", String(error))
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, markReadSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? parsed.data.userId,
      "MEMBER"
    )
    if (!access.ok) return access.response

    const targetUserId = parsed.data.userId ?? access.actor.userId
    if (targetUserId !== access.actor.userId && access.actor.role !== "ADMIN" && access.actor.role !== "OWNER") {
      return badRequest("Cannot update notifications for another user")
    }

    const existing = await db.userSettings.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: parsed.data.workspaceId,
          userId: targetUserId,
        },
      },
      select: { notifications: true },
    })
    const hasSpecificNotificationIds = Boolean(parsed.data.notificationIds && parsed.data.notificationIds.length > 0)
    const existingCursor = extractNotificationLastReadAt(existing?.notifications)
    const cursor = hasSpecificNotificationIds
      ? (parsed.data.lastReadAt ?? existingCursor ?? null)
      : (parsed.data.lastReadAt ?? new Date().toISOString())

    const basePreferences = normalizeNotificationPreferences(existing?.notifications)
    const existingReadIds = extractReadNotificationIds(existing?.notifications)
    const nextReadIds = mergeReadNotificationIds(existingReadIds, parsed.data.notificationIds ?? [])
    const metadata = mergeNotificationMetadata(existing?.notifications, { lastReadAt: cursor })
    const metadataWithReads = mergeNotificationMetadata(metadata, { readNotificationIds: nextReadIds })
    const mergedNotifications = {
      ...basePreferences,
      ...metadataWithReads,
    } as Prisma.InputJsonValue

    await db.userSettings.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: parsed.data.workspaceId,
          userId: targetUserId,
        },
      },
      update: {
        notifications: mergedNotifications,
      },
      create: {
        workspaceId: parsed.data.workspaceId,
        userId: targetUserId,
        notifications: mergedNotifications,
      },
    })

    return NextResponse.json({
      markedReadAt: cursor,
    })
  } catch (error) {
    return serverError("Failed to update notification cursor", String(error))
  }
}
