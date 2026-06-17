import { NextRequest, NextResponse } from "next/server"

import { badRequest, forbidden, notFound, parseJsonBody, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { updateWorkspaceMemberSchema } from "@/lib/contracts"
import { db } from "@/lib/db"

type Params = { params: Promise<{ memberUserId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { memberUserId } = await params
  const parsed = await parseJsonBody(request, updateWorkspaceMemberSchema)
  if (!parsed.ok) return parsed.response

  if (!memberUserId) {
    return badRequest("memberUserId route param is required")
  }

  try {
    const access = await requireWorkspaceRole(request, parsed.data.workspaceId, "ADMIN")
    if (!access.ok) return access.response

    const workspace = await db.workspace.findUnique({
      where: { id: parsed.data.workspaceId },
      select: { ownerId: true },
    })
    if (!workspace) return notFound("Workspace not found")

    if (workspace.ownerId === memberUserId && parsed.data.role !== "OWNER") {
      return forbidden("Workspace owner role cannot be downgraded")
    }

    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: parsed.data.workspaceId,
          userId: memberUserId,
        },
      },
    })
    if (!membership) return notFound("Workspace member not found")

    const updated = await db.workspaceMember.update({
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
    const access = await requireWorkspaceRole(request, workspaceId, "ADMIN")
    if (!access.ok) return access.response

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { ownerId: true },
    })
    if (!workspace) return notFound("Workspace not found")
    if (workspace.ownerId === memberUserId) {
      return forbidden("Workspace owner cannot be removed")
    }
    if (access.actor.userId === memberUserId) {
      return forbidden("Use a different admin/owner account to remove yourself")
    }

    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId,
        },
      },
    })
    if (!membership) return notFound("Workspace member not found")

    await db.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId,
        },
      },
    })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to remove workspace member", String(error))
  }
}
