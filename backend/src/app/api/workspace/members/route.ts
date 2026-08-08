import { NextRequest, NextResponse } from "next/server"

import { logActivityEvent } from "@/lib/activity"
import {
  forbidden,
  parseJsonBody,
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { createWorkspaceMemberSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { validateWorkspaceMemberRoleChange } from "@/lib/workspace-member-guards"

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
      await resolveRequestActorUserId(request),
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

    const workspace = await db.workspace.findUnique({
      where: { id: parsed.data.workspaceId },
      select: { ownerId: true },
    })
    if (!workspace) return serverError("Failed to add workspace member")

    const roleCheck = validateWorkspaceMemberRoleChange({
      workspaceOwnerId: workspace.ownerId,
      targetUserId: user.id,
      nextRole: parsed.data.role,
    })
    if (!roleCheck.ok) return forbidden(roleCheck.message)

    const membership = await db.$transaction(async (tx) => {
      const createdOrUpdated = await tx.workspaceMember.upsert({
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

      await logActivityEvent(tx, {
        workspaceId: parsed.data.workspaceId,
        actorId: access.actor.userId,
        action: "CREATED",
        entityType: "WORKSPACE",
        entityId: parsed.data.workspaceId,
        summary: `Added workspace member ${createdOrUpdated.user.email}`,
        metadata: {
          memberUserId: createdOrUpdated.userId,
          memberEmail: createdOrUpdated.user.email,
          role: createdOrUpdated.role,
        },
      })

      return createdOrUpdated
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
