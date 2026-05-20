import { NextRequest, NextResponse } from "next/server"

import { notFound, parseDateValue, parseJsonBody, serverError } from "@/lib/api-utils"
import { updateWorkItemSchema } from "@/lib/contracts"
import { db } from "@/lib/db"

type Params = { params: Promise<{ workItemId: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  const { workItemId } = await params
  const parsed = await parseJsonBody(request, updateWorkItemSchema)
  if (!parsed.ok) return parsed.response

  try {
    const existing = await db.workItem.findUnique({ where: { id: workItemId }, select: { id: true } })
    if (!existing) return notFound("Work item not found")

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
  try {
    const existing = await db.workItem.findUnique({ where: { id: workItemId }, select: { id: true } })
    if (!existing) return notFound("Work item not found")

    await db.workItem.delete({ where: { id: workItemId } })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete work item", String(error))
  }
}
