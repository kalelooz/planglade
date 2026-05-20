import { NextRequest, NextResponse } from "next/server"

import { parseJsonBody, parseQuery, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { createWorkspaceMemberSchema, workspaceQuerySchema } from "@/lib/contracts"
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
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
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

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createWorkspaceMemberSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "ADMIN"
    )
    if (!access.ok) return access.response

    const user = await db.user.upsert({
      where: { email: parsed.data.email },
      update: {
        ...(parsed.data.name ? { name: parsed.data.name } : {}),
      },
      create: {
        email: parsed.data.email,
        name: parsed.data.name ?? parsed.data.email.split("@")[0],
      },
      select: { id: true, email: true, name: true },
    })

    const membership = await db.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: parsed.data.workspaceId,
          userId: user.id,
        },
      },
      update: {
        role: parsed.data.role,
      },
      create: {
        workspaceId: parsed.data.workspaceId,
        userId: user.id,
        role: parsed.data.role,
      },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    })

    return NextResponse.json(
      {
        member: {
          userId: membership.userId,
          role: membership.role,
          joinedAt: membership.joinedAt,
          user: membership.user,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return serverError("Failed to add workspace member", String(error))
  }
}
