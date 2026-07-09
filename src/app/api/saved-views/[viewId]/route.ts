import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { badRequest, notFound, parseJsonBody, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { updateSavedViewSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { workspaceProjectExists } from "@/lib/workspace-reference-guards"

type Params = { params: Promise<{ viewId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { viewId } = await params
  const query = parseQuery(
    { workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  const parsed = await parseJsonBody(request, updateSavedViewSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response

    if (!(await workspaceProjectExists(query.data.workspaceId, parsed.data.projectId))) {
      return badRequest("Project not found in workspace")
    }

    const existing = await db.savedView.findUnique({
      where: { id: viewId },
      select: { id: true, workspaceId: true },
    })
    if (!existing) return notFound("Saved view not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Saved view not found in workspace")

    const data: Prisma.SavedViewUncheckedUpdateInput = {
      ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}),
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.layout !== undefined ? { layout: parsed.data.layout } : {}),
      ...(parsed.data.groupBy !== undefined ? { groupBy: parsed.data.groupBy } : {}),
      ...(parsed.data.orderBy !== undefined ? { orderBy: parsed.data.orderBy } : {}),
      ...(parsed.data.filters !== undefined
        ? { filters: parsed.data.filters as Prisma.InputJsonValue }
        : {}),
      ...(parsed.data.display !== undefined
        ? { display: parsed.data.display as Prisma.InputJsonValue }
        : {}),
      ...(parsed.data.isDefault !== undefined ? { isDefault: parsed.data.isDefault } : {}),
    }

    const savedView = await db.savedView.update({
      where: { id: viewId },
      data,
    })
    return NextResponse.json({ savedView })
  } catch (error) {
    return serverError("Failed to update saved view", String(error))
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { viewId } = await params
  const query = parseQuery(
    { workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined },
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

    const existing = await db.savedView.findUnique({
      where: { id: viewId },
      select: { id: true, workspaceId: true },
    })
    if (!existing) return notFound("Saved view not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Saved view not found in workspace")

    await db.savedView.delete({ where: { id: viewId } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete saved view", String(error))
  }
}
