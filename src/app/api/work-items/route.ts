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
import { createNotificationRecord } from "@/lib/notifications"
import { normalizeProjectFeatureFlags } from "@/lib/project-flags"

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
    const access = await requireWorkspaceRole(request, query.data.workspaceId, "VIEWER")
    if (!access.ok) return access.response

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
    const access = await requireWorkspaceRole(request, parsed.data.workspaceId, "MEMBER")
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    if (parsed.data.parentId) {
      const parentWorkItem = await db.workItem.findUnique({
        where: { id: parsed.data.parentId },
        select: { id: true, workspaceId: true, projectId: true },
      })

      if (!parentWorkItem || parentWorkItem.workspaceId !== parsed.data.workspaceId) {
        return badRequest("Parent work item not found in workspace")
      }

      if (
        parsed.data.projectId &&
        parentWorkItem.projectId &&
        parsed.data.projectId !== parentWorkItem.projectId
      ) {
        return badRequest("Subtask and parent work item must belong to the same project")
      }

      const projectForSubtasksId = parsed.data.projectId ?? parentWorkItem.projectId ?? null
      if (projectForSubtasksId) {
        const targetProject = await db.project.findUnique({
          where: { id: projectForSubtasksId },
          select: { id: true, workspaceId: true, featureFlags: true },
        })
        if (!targetProject || targetProject.workspaceId !== parsed.data.workspaceId) {
          return badRequest("Project not found in workspace")
        }
        const featureFlags = normalizeProjectFeatureFlags(targetProject.featureFlags)
        if (!featureFlags.subtasks) {
          return badRequest("Subtasks are disabled for this project")
        }
      }
    }

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

      if (workItem.assigneeId && workItem.assigneeId !== actorUserId) {
        const project = workItem.projectId
          ? await tx.project.findUnique({
              where: { id: workItem.projectId },
              select: { featureFlags: true },
            })
          : null
        const featureFlags = normalizeProjectFeatureFlags(project?.featureFlags)
        if (featureFlags.notifications) {
          await createNotificationRecord(tx, {
            workspaceId: parsed.data.workspaceId,
            userId: workItem.assigneeId,
            actorId: actorUserId,
            workItemId: workItem.id,
            type: "ASSIGNED",
            title: "Task assigned to you",
            body: `You were assigned "${workItem.title}"`,
            sourceKey: `work-item:${workItem.id}:created-assignment:${workItem.assigneeId}`,
          })
        }
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
