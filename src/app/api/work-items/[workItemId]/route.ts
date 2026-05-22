import { NextRequest, NextResponse } from "next/server"

import { badRequest, notFound, parseDateValue, parseJsonBody, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { updateWorkItemSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { createNotificationRecord } from "@/lib/notifications"
import { normalizeProjectFeatureFlags } from "@/lib/project-flags"

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
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.workItem.findUnique({
      where: { id: workItemId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        status: true,
        assigneeId: true,
        projectId: true,
        parentId: true,
      },
    })
    if (!existing) return notFound("Work item not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Work item not found in workspace")

    const effectiveParentId = parsed.data.parentId !== undefined ? parsed.data.parentId : existing.parentId
    const effectiveProjectId = parsed.data.projectId !== undefined ? parsed.data.projectId : existing.projectId

    if (effectiveParentId === workItemId) {
      return badRequest("A work item cannot be its own parent")
    }

    if (effectiveParentId) {
      const parentWorkItem = await db.workItem.findUnique({
        where: { id: effectiveParentId },
        select: { id: true, workspaceId: true, projectId: true },
      })
      if (!parentWorkItem || parentWorkItem.workspaceId !== query.data.workspaceId) {
        return badRequest("Parent work item not found in workspace")
      }

      if (effectiveProjectId && parentWorkItem.projectId && effectiveProjectId !== parentWorkItem.projectId) {
        return badRequest("Subtask and parent work item must belong to the same project")
      }

      const projectForSubtasksId = effectiveProjectId ?? parentWorkItem.projectId ?? null
      if (projectForSubtasksId) {
        const targetProject = await db.project.findUnique({
          where: { id: projectForSubtasksId },
          select: { id: true, workspaceId: true, featureFlags: true },
        })
        if (!targetProject || targetProject.workspaceId !== query.data.workspaceId) {
          return badRequest("Project not found in workspace")
        }
        const featureFlags = normalizeProjectFeatureFlags(targetProject.featureFlags)
        if (!featureFlags.subtasks) {
          return badRequest("Subtasks are disabled for this project")
        }
      }
    }

    const changedFields = Object.entries(parsed.data)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key)
    const action =
      parsed.data.status === "DONE" && existing.status !== "DONE"
        ? "COMPLETED"
        : parsed.data.status !== undefined && parsed.data.status !== existing.status
          ? "MOVED"
          : "UPDATED"

    const updated = await db.$transaction(async (tx) => {
      const patchedWorkItem = await tx.workItem.update({
        where: { id: workItemId },
        data: {
          ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}),
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.checklist !== undefined ? { checklist: parsed.data.checklist } : {}),
          ...(parsed.data.noteIds !== undefined ? { noteIds: parsed.data.noteIds } : {}),
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
        select: {
          id: true,
          title: true,
          assigneeId: true,
          projectId: true,
          updatedAt: true,
        },
      })

      const projectForFlagsId = patchedWorkItem.projectId ?? existing.projectId
      const projectForFlags = projectForFlagsId
        ? await tx.project.findUnique({
            where: { id: projectForFlagsId },
            select: { featureFlags: true },
          })
        : null
      const featureFlags = normalizeProjectFeatureFlags(projectForFlags?.featureFlags)

      if (parsed.data.labelIds) {
        await tx.workItemLabel.deleteMany({ where: { workItemId } })
        if (parsed.data.labelIds.length > 0) {
          await tx.workItemLabel.createMany({
            data: parsed.data.labelIds.map((labelId) => ({ workItemId, labelId })),
          })
        }
      }

      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action,
        entityType: "WORK_ITEM",
        entityId: workItemId,
        summary:
          action === "COMPLETED"
            ? `Completed work item "${existing.title}"`
            : action === "MOVED"
              ? `Moved work item "${existing.title}" to ${parsed.data.status}`
              : `Updated work item "${existing.title}"`,
        metadata: {
          changedFields,
          ...(parsed.data.status !== undefined ? { previousStatus: existing.status, newStatus: parsed.data.status } : {}),
        },
      })

      if (parsed.data.assigneeId !== undefined && parsed.data.assigneeId !== existing.assigneeId) {
        await logActivityEvent(tx, {
          workspaceId: query.data.workspaceId,
          actorId: actorUserId,
          action: parsed.data.assigneeId ? "ASSIGNED" : "UNASSIGNED",
          entityType: "WORK_ITEM",
          entityId: workItemId,
          summary: parsed.data.assigneeId
            ? `Assigned work item "${existing.title}"`
            : `Unassigned work item "${existing.title}"`,
          metadata: {
            previousAssigneeId: existing.assigneeId,
            newAssigneeId: parsed.data.assigneeId,
          },
        })

        if (featureFlags.notifications && parsed.data.assigneeId && parsed.data.assigneeId !== actorUserId) {
          await createNotificationRecord(tx, {
            workspaceId: query.data.workspaceId,
            userId: parsed.data.assigneeId,
            actorId: actorUserId,
            workItemId,
            type: "ASSIGNED",
            title: "Task assigned to you",
            body: `You were assigned "${existing.title}"`,
            sourceKey: `work-item:${workItemId}:assigned:${parsed.data.assigneeId}:${patchedWorkItem.updatedAt.toISOString()}`,
          })
        }
      }

      const targetAssigneeId =
        parsed.data.assigneeId !== undefined ? parsed.data.assigneeId : existing.assigneeId
      const dueDateChanged = changedFields.includes("dueDate")
      const statusChanged = changedFields.includes("status")

      if (
        featureFlags.notifications &&
        targetAssigneeId &&
        targetAssigneeId !== actorUserId &&
        (dueDateChanged || statusChanged)
      ) {
        await createNotificationRecord(tx, {
          workspaceId: query.data.workspaceId,
          userId: targetAssigneeId,
          actorId: actorUserId,
          workItemId,
          type: "STATUS",
          title: dueDateChanged ? "Due date changed" : "Task status changed",
          body: dueDateChanged
            ? `Due date updated for "${existing.title}"`
            : `Status updated for "${existing.title}"`,
          sourceKey: `work-item:${workItemId}:status:${targetAssigneeId}:${patchedWorkItem.updatedAt.toISOString()}`,
        })
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
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      _request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, workspaceId: true, title: true },
    })
    if (!existing) return notFound("Work item not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Work item not found in workspace")

    await db.$transaction(async (tx) => {
      await tx.workItem.delete({ where: { id: workItemId } })
      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "DELETED",
        entityType: "WORK_ITEM",
        entityId: workItemId,
        summary: `Deleted work item "${existing.title}"`,
      })
    })
    return NextResponse.json({ deleted: true })
  } catch (error) {
    return serverError("Failed to delete work item", String(error))
  }
}
