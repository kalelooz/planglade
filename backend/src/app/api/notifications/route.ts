import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { z } from "zod"

import { badRequest, parseJsonBody, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import {
  NOTIFICATION_KEYS,
  extractNotificationLastReadAt,
  mergeNotificationMetadata,
  normalizeNotificationPreferences,
} from "@/lib/notification-preferences"

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

const TYPE_TO_PREF: Record<"MENTION" | "ASSIGNED" | "COMMENT" | "STATUS", string> = {
  MENTION: NOTIFICATION_KEYS.mentioned,
  ASSIGNED: NOTIFICATION_KEYS.assignedToMe,
  COMMENT: NOTIFICATION_KEYS.commentsOnMyItems,
  STATUS: NOTIFICATION_KEYS.statusChanges,
}

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
      await resolveRequestActorUserId(request),
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

    const enabledTypes = (Object.keys(TYPE_TO_PREF) as Array<keyof typeof TYPE_TO_PREF>).filter(
      (type) => prefs[TYPE_TO_PREF[type]]
    )

    const notifications = await db.notification.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        userId: targetUserId,
        ...(enabledTypes.length > 0
          ? { type: { in: enabledTypes } }
          : { id: { in: [] as string[] } }),
      },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.data.limit,
    })

    const unreadCount = await db.notification.count({
      where: {
        workspaceId: query.data.workspaceId,
        userId: targetUserId,
        isRead: false,
        ...(enabledTypes.length > 0 ? { type: { in: enabledTypes } } : { id: { in: [] as string[] } }),
      },
    })

    const lastReadAtValue =
      extractNotificationLastReadAt(userSettings?.notifications) ??
      notifications.find((notification) => notification.readAt)?.readAt?.toISOString() ??
      null

    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        createdAt: notification.createdAt.toISOString(),
        isUnread: !notification.isRead,
        workItemId: notification.workItemId,
        actor: notification.actor,
      })),
      unreadCount,
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
      await resolveRequestActorUserId(request),
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

    const hasSpecificNotificationIds = Boolean(parsed.data.notificationIds?.length)
    const cursor = parsed.data.lastReadAt ?? new Date().toISOString()
    const cursorDate = new Date(cursor)
    const isValidCursor = !Number.isNaN(cursorDate.getTime())

    if (hasSpecificNotificationIds) {
      await db.notification.updateMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          userId: targetUserId,
          id: { in: parsed.data.notificationIds },
        },
        data: {
          isRead: true,
          readAt: isValidCursor ? cursorDate : new Date(),
        },
      })
    } else {
      await db.notification.updateMany({
        where: {
          workspaceId: parsed.data.workspaceId,
          userId: targetUserId,
          isRead: false,
          ...(isValidCursor ? { createdAt: { lte: cursorDate } } : {}),
        },
        data: {
          isRead: true,
          readAt: isValidCursor ? cursorDate : new Date(),
        },
      })
    }

    const basePreferences = normalizeNotificationPreferences(existing?.notifications)
    const metadata = mergeNotificationMetadata(existing?.notifications, { lastReadAt: cursor })
    const mergedNotifications = {
      ...basePreferences,
      ...metadata,
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
