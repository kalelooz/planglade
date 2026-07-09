import { NextRequest, NextResponse } from "next/server"

import { parseJsonBody, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { createLabelSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    { workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "VIEWER"
    )
    if (!access.ok) return access.response

    const labels = await db.label.findMany({
      where: { workspaceId: query.data.workspaceId },
      orderBy: { name: "asc" },
    })
    return NextResponse.json({ labels })
  } catch (error) {
    return serverError("Failed to load labels", String(error))
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createLabelSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response

    const label = await db.label.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        name: parsed.data.name,
        color: parsed.data.color,
      },
    })
    return NextResponse.json({ label }, { status: 201 })
  } catch (error) {
    return serverError("Failed to create label", String(error))
  }
}
