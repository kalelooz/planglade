import { NextRequest, NextResponse } from "next/server"

import { notFound, parseJsonBody, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { updateLabelSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

type Params = { params: Promise<{ labelId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { labelId } = await params
  const query = parseQuery(
    { workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  const parsed = await parseJsonBody(request, updateLabelSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response

    const existing = await db.label.findUnique({
      where: { id: labelId },
      select: { id: true, workspaceId: true },
    })
    if (!existing) return notFound("Label not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Label not found in workspace")

    const label = await db.label.update({
      where: { id: labelId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
      },
    })
    return NextResponse.json({ label })
  } catch (error) {
    return serverError("Failed to update label", String(error))
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { labelId } = await params
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

    const existing = await db.label.findUnique({
      where: { id: labelId },
      select: { id: true, workspaceId: true },
    })
    if (!existing) return notFound("Label not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Label not found in workspace")

    await db.label.delete({ where: { id: labelId } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete label", String(error))
  }
}
