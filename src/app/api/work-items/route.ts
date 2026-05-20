import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  parseDateValue,
  parseJsonBody,
  parseQuery,
  resolveActorUserId,
  serverError,
} from "@/lib/api-utils"
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
    const actorUserId = await resolveActorUserId(
      parsed.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined
    )
    if (!actorUserId) return badRequest("Workspace not found")

    const created = await db.$transaction(async (tx) => {
      const workItem = await tx.workItem.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          projectId: parsed.data.projectId,
          title: parsed.data.title,
          description: parsed.data.description,
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
          skipDuplicates: true,
        })
      }

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
