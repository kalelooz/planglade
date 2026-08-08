import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  notFound,
  parseJsonBody,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { updateWorkspaceSchema } from "@/lib/contracts"
import { db } from "@/lib/db"

type Params = { params: Promise<{ workspaceId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { workspaceId } = await params
  const parsed = await parseJsonBody(request, updateWorkspaceSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response

    const existing = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, name: true, slug: true },
    })
    if (!existing) return notFound("Workspace not found")

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const slugOwner = await db.workspace.findUnique({
        where: { slug: parsed.data.slug },
        select: { id: true },
      })
      if (slugOwner) return badRequest("Workspace slug already exists")
    }

    const changedFields = Object.entries(parsed.data)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)

    const workspace = await db.$transaction(async (tx) => {
      const updated = await tx.workspace.update({
        where: { id: workspaceId },
        data: {
          ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
          ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
        },
        select: {
          id: true,
          slug: true,
          name: true,
          taskPriorityDisplayStyle: true,
        },
      })

      await logActivityEvent(tx, {
        workspaceId,
        actorId: access.actor.userId,
        action: "UPDATED",
        entityType: "WORKSPACE",
        entityId: workspaceId,
        summary: `Updated workspace ${existing.name}`,
        metadata: { changedFields },
      })

      return updated
    })

    return NextResponse.json({ workspace })
  } catch (error) {
    return serverError("Failed to update workspace", String(error))
  }
}
