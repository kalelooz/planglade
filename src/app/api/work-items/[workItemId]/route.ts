import { NextRequest, NextResponse } from "next/server"

import { badRequest, notFound, parseDateValue, parseJsonBody, serverError } from "@/lib/api-utils"
import { updateWorkItemSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

type Params = { params: Promise<{ workItemId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { workItemId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  const parsed = await parseJsonBody(request, updateWorkItemSchema)
  if (!parsed.ok) return parsed.response

  try {
    const existing = await db.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, workspaceId: true },
    })
    if (!existing) return notFound("Work item not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Work item not found in workspace")

    const updated = await db.$transaction(async (tx) => {
      await tx.workItem.update({
        where: { id: workItemId },
        data: {
          ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}),
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.priority !== undefined ? { priority: parsed.data.priority } : {}),
          ...(parsed.data.startDate !== undefined
            ? { startDate: parseDateValue(parsed.data.startDate) }
            : {}),
          ...(parsed.data.dueDate !== undefined ? { dueDate: parseDateValue(parsed.data.dueDate) } : {}),
          ...(parsed.data.assigneeId !== undefined ? { assigneeId: parsed.data.assigneeId } : {}),
          ...(parsed.data.parentId !== undefined ? { parentId: parsed.data.parentId } : {}),
          ...(parsed.data.completedAt !== undefined
            ? { completedAt: parseDateValue(parsed.data.completedAt ?? undefined) }
            : {}),
        },
      })

      if (parsed.data.labelIds) {
        await tx.workItemLabel.deleteMany({ where: { workItemId } })
        if (parsed.data.labelIds.length > 0) {
          await tx.workItemLabel.createMany({
            data: parsed.data.labelIds.map((labelId) => ({ workItemId, labelId })),
            skipDuplicates: true,
          })
        }
      }

      return tx.workItem.findUnique({
        where: { id: workItemId },
        include: { labels: { include: { label: true } } },
      })
    })

    return NextResponse.json({ workItem: updated })
  } catch (error) {
    return serverError("Failed to update work item", String(error))
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { workItemId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: _request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  try {
    const existing = await db.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, workspaceId: true },
    })
    if (!existing) return notFound("Work item not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Work item not found in workspace")

    await db.workItem.delete({ where: { id: workItemId } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete work item", String(error))
  }
}
