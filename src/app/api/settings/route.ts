import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { forbidden, hasMinimumWorkspaceRole, parseJsonBody, parseQuery, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { updateUserSettingsSchema, workspaceUserQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import {
  extractReadNotificationIds,
  extractNotificationLastReadAt,
  mergeReadNotificationIds,
  mergeNotificationMetadata,
  normalizeNotificationPreferences,
} from "@/lib/notification-preferences"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      userId: request.nextUrl.searchParams.get("userId") ?? undefined,
    },
    workspaceUserQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response

    if (
      access.actor.userId !== query.data.userId &&
      !hasMinimumWorkspaceRole(access.actor.role, "ADMIN")
    ) {
      return forbidden("You can only read your own settings unless you are admin or owner")
    }

    const settings = await db.userSettings.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: query.data.workspaceId,
          userId: query.data.userId,
        },
      },
    })
    return NextResponse.json({ settings })
  } catch (error) {
    return serverError("Failed to load settings", String(error))
  }
}

export async function PUT(request: NextRequest) {
  const parsed = await parseJsonBody(request, updateUserSettingsSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response

    if (
      access.actor.userId !== parsed.data.userId &&
      !hasMinimumWorkspaceRole(access.actor.role, "ADMIN")
    ) {
      return forbidden("You can only update your own settings unless you are admin or owner")
    }

    let notificationsPayload: Prisma.InputJsonValue | undefined
    if (parsed.data.notifications !== undefined) {
      const existing = await db.userSettings.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: parsed.data.workspaceId,
            userId: parsed.data.userId,
          },
        },
        select: { notifications: true },
      })
      const normalized = normalizeNotificationPreferences(parsed.data.notifications)
      const existingReadIds = extractReadNotificationIds(existing?.notifications)
      const metadata = mergeNotificationMetadata(existing?.notifications, {
        lastReadAt: extractNotificationLastReadAt(existing?.notifications),
        readNotificationIds: mergeReadNotificationIds(existingReadIds, []),
      })
      notificationsPayload = {
        ...normalized,
        ...metadata,
      } as Prisma.InputJsonValue
    }

    const settings = await db.userSettings.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: parsed.data.workspaceId,
          userId: parsed.data.userId,
        },
      },
      update: {
        ...(parsed.data.theme !== undefined ? { theme: parsed.data.theme } : {}),
        ...(parsed.data.density !== undefined ? { density: parsed.data.density } : {}),
        ...(parsed.data.accent !== undefined ? { accent: parsed.data.accent } : {}),
        ...(parsed.data.notifications !== undefined
          ? { notifications: notificationsPayload }
          : {}),
      },
      create: {
        workspaceId: parsed.data.workspaceId,
        userId: parsed.data.userId,
        theme: parsed.data.theme,
        density: parsed.data.density,
        accent: parsed.data.accent,
        notifications: notificationsPayload ?? parsed.data.notifications,
      },
    })

    return NextResponse.json({ settings })
  } catch (error) {
    return serverError("Failed to update settings", String(error))
  }
}
