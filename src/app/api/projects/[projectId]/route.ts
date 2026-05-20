import { NextRequest, NextResponse } from "next/server"

import { badRequest, notFound, parseDateValue, parseJsonBody, serverError } from "@/lib/api-utils"
import { updateProjectSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

type Params = { params: Promise<{ projectId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  const parsed = await parseJsonBody(request, updateProjectSchema)
  if (!parsed.ok) return parsed.response

  try {
    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    })
    if (!existing) return notFound("Project not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Project not found in workspace")

    const project = await db.project.update({
      where: { id: projectId },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.slug !== undefined ? { slug: parsed.data.slug } : {}),
        ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
        ...(parsed.data.startDate !== undefined
          ? { startDate: parseDateValue(parsed.data.startDate) }
          : {}),
        ...(parsed.data.dueDate !== undefined ? { dueDate: parseDateValue(parsed.data.dueDate) } : {}),
      },
    })

    return NextResponse.json({ project })
  } catch (error) {
    return serverError("Failed to update project", String(error))
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { projectId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: _request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  try {
    const existing = await db.project.findUnique({
      where: { id: projectId },
      select: { id: true, workspaceId: true },
    })
    if (!existing) return notFound("Project not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Project not found in workspace")

    await db.project.delete({ where: { id: projectId } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete project", String(error))
  }
}
