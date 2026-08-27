import { NextRequest, NextResponse } from "next/server"

import {
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
    },
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

    const members = await db.workspaceMember.findMany({
      where: { workspaceId: query.data.workspaceId },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
      orderBy: { joinedAt: "asc" },
    })

    return NextResponse.json({
      members: members.map((member) => ({
        userId: member.userId,
        role: member.role,
        joinedAt: member.joinedAt,
        user: member.user,
      })),
    })
  } catch (error) {
    return serverError("Failed to load workspace members", String(error))
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Direct member creation is disabled; use a workspace invitation" },
    { status: 405, headers: { Allow: "GET" } }
  )
}
