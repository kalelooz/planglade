import { NextRequest, NextResponse } from "next/server"

import { parseJsonBody, parseQuery, serverError } from "@/lib/api-utils"
import { updateUserSettingsSchema, workspaceUserQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

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
          ? { notifications: parsed.data.notifications }
          : {}),
      },
      create: {
        workspaceId: parsed.data.workspaceId,
        userId: parsed.data.userId,
        theme: parsed.data.theme,
        density: parsed.data.density,
        accent: parsed.data.accent,
        notifications: parsed.data.notifications,
      },
    })

    return NextResponse.json({ settings })
  } catch (error) {
    return serverError("Failed to update settings", String(error))
  }
}
