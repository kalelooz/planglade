import { NextRequest, NextResponse } from "next/server"

import { logActivityEvent } from "@/lib/activity"
import {
  badRequest,
  forbidden,
  notFound,
  parseJsonBody,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { updateWorkspaceMemberSchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { validateWorkspaceMemberRemoval, validateWorkspaceMemberRoleChange } from "@/lib/workspace-member-guards"

type Params = { params: Promise<{ memberUserId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { memberUserId } = await params
  const parsed = await parseJsonBody(request, updateWorkspaceMemberSchema)
  if (!parsed.ok) return parsed.response

  if (!memberUserId) {
    return badRequest("memberUserId route param is required")
  }

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response

    const workspace = await db.workspace.findUnique({
      where: { id: parsed.data.workspaceId },
      select: { ownerId: true },
    })
    if (!workspace) return notFound("Workspace not found")

    const roleCheck = validateWorkspaceMemberRoleChange({
      workspaceOwnerId: workspace.ownerId,
      targetUserId: memberUserId,
      nextRole: parsed.data.role,
    })
    if (!roleCheck.ok) return forbidden(roleCheck.message)

    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: parsed.data.workspaceId,
          userId: memberUserId,
        },
      },
    })
    if (!membership) return notFound("Workspace member not found")

    const updated = await db.$transaction(async (tx) => {
      const next = await tx.workspaceMember.update({
        where: {
          workspaceId_userId: {
            workspaceId: parsed.data.workspaceId,
            userId: memberUserId,
          },
        },
        data: { role: parsed.data.role },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      })

      await logActivityEvent(tx, {
        workspaceId: parsed.data.workspaceId,
        actorId: access.actor.userId,
        action: "UPDATED",
        entityType: "WORKSPACE",
        entityId: parsed.data.workspaceId,
        summary: `Changed member role for ${next.user.email} to ${next.role}`,
        metadata: {
          memberUserId: next.userId,
          memberEmail: next.user.email,
          role: next.role,
        },
      })

      return next
    })

    return NextResponse.json({
      member: {
        userId: updated.userId,
        role: updated.role,
        joinedAt: updated.joinedAt,
        user: updated.user,
      },
    })
  } catch (error) {
    return serverError("Failed to update workspace member", String(error))
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { memberUserId } = await params
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") ?? undefined
  if (!workspaceId) return badRequest("workspaceId query is required")

  try {
    const access = await requireWorkspaceRole(
      workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })
    if (!workspace) return notFound("Workspace not found")
    const removalCheck = validateWorkspaceMemberRemoval({
      workspaceOwnerId: workspace.ownerId,
      actorUserId: access.actor.userId,
      targetUserId: memberUserId,
    })
    if (!removalCheck.ok) return forbidden(removalCheck.message)

    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId,
        },
      },
    })
    if (!membership) return notFound("Workspace member not found")

    const removed = await db.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId,
        },
      },
    })

    try {
      await logActivityEvent(db, {
        workspaceId,
        actorId: access.actor.userId,
        action: "DELETED",
        entityType: "WORKSPACE",
        entityId: workspaceId,
        summary: `Removed workspace member ${memberUserId}`,
        metadata: {
          memberUserId: removed.userId,
        },
      })
    } catch {
      // Do not fail member removal when activity logging is unavailable.
    }
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to remove workspace member", String(error))
  }
}
