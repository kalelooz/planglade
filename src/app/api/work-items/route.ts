import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  parseDateValue,
  parseJsonBody,
  parseQuery,
  requireWorkspaceRole,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { createWorkItemSchema, workItemListQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      projectId: request.nextUrl.searchParams.get("projectId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
      assigneeId: request.nextUrl.searchParams.get("assigneeId") ?? undefined,
    },
    workItemListQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const workItems = await db.workItem.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        ...(query.data.projectId ? { projectId: query.data.projectId } : {}),
        ...(query.data.status ? { status: query.data.status } : {}),
        ...(query.data.assigneeId ? { assigneeId: query.data.assigneeId } : {}),
      },
      include: {
        labels: { include: { label: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    })

    return NextResponse.json({ workItems })
  } catch (error) {
    return serverError("Failed to load work items", String(error))
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createWorkItemSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const created = await db.$transaction(async (tx) => {
      const workItem = await tx.workItem.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          projectId: parsed.data.projectId,
          title: parsed.data.title,
          description: parsed.data.description,
          checklist: parsed.data.checklist,
          noteIds: parsed.data.noteIds,
          status: parsed.data.status,
          priority: parsed.data.priority,
          startDate: parseDateValue(parsed.data.startDate) ?? undefined,
          dueDate: parseDateValue(parsed.data.dueDate) ?? undefined,
          assigneeId: parsed.data.assigneeId,
          parentId: parsed.data.parentId,
          createdById: actorUserId,
        },
      })

      if (parsed.data.labelIds && parsed.data.labelIds.length > 0) {
        await tx.workItemLabel.createMany({
          data: parsed.data.labelIds.map((labelId) => ({
            workItemId: workItem.id,
            labelId,
          })),
        })
      }

      await logActivityEvent(tx, {
        workspaceId: parsed.data.workspaceId,
        actorId: actorUserId,
        action: "CREATED",
        entityType: "WORK_ITEM",
        entityId: workItem.id,
        summary: `Created work item "${workItem.title}"`,
        metadata: {
          status: workItem.status,
          priority: workItem.priority,
          ...(workItem.projectId ? { projectId: workItem.projectId } : {}),
        },
      })

      return tx.workItem.findUnique({
        where: { id: workItem.id },
        include: { labels: { include: { label: true } } },
      })
    })

    return NextResponse.json({ workItem: created }, { status: 201 })
  } catch (error) {
    return serverError("Failed to create work item", String(error))
  }
}
