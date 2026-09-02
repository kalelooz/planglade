import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  forbidden,
  notFound,
  parseDateValue,
  parseJsonBody,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { updateWorkItemSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { canDeleteWorkspaceContent } from "@/lib/permissions/content"
import { createNotificationRecord } from "@/lib/notifications"
import { normalizeProjectFeatureFlags } from "@/lib/project-flags"
import { validateNoteReferences } from "@/lib/note-access"
import {
  validateWorkspaceLabelIds,
  workspaceMemberExists,
  workspaceProjectExists,
} from "@/lib/workspace-reference-guards"
import {
  bumpWorkItemLaneVersion,
  claimWorkItemLaneVersions,
  getWorkItemLaneVersions,
  runSerializableWorkItemMutation,
  StaleWorkItemLaneMutationError,
  type WorkItemLaneVersions,
} from "@/lib/work-item-lane-versions"

type Params = { params: Promise<{ workItemId: string }> }

class StaleWorkItemMutationError extends Error {}

async function currentWorkItemState(workspaceId: string, workItemId: string) {
  const [workItem, laneVersions] = await Promise.all([
    db.workItem.findFirst({
      where: { id: workItemId, workspaceId },
      include: { labels: { include: { label: true } } },
    }),
    getWorkItemLaneVersions(db, workspaceId),
  ])
  return { workItem, laneVersions }
}

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
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const noteReferences = await validateNoteReferences({
      workspaceId: query.data.workspaceId,
      actorUserId,
      noteIds: parsed.data.noteIds,
    })
    if (!noteReferences.ok) return badRequest("Note not found or not accessible")

    const labelReferences = await validateWorkspaceLabelIds({
      workspaceId: query.data.workspaceId,
      labelIds: parsed.data.labelIds,
    })
    if (!labelReferences.ok) return badRequest("Label not found in workspace")

    if (!(await workspaceProjectExists(query.data.workspaceId, parsed.data.projectId))) {
      return badRequest("Project not found in workspace")
    }
    if (!(await workspaceMemberExists(query.data.workspaceId, parsed.data.assigneeId))) {
      return badRequest("Assignee not found in workspace")
    }

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
        position: true,
        isInbox: true,
        updatedAt: true,
      },
    })
    if (!existing) return notFound("Work item not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Work item not found in workspace")

    if (!parsed.data.expectedUpdatedAt) {
      return NextResponse.json(
        {
          error: "expectedUpdatedAt is required",
          current: await currentWorkItemState(query.data.workspaceId, workItemId),
        },
        { status: 428 },
      )
    }
    const expectedUpdatedAt = parsed.data.expectedUpdatedAt

    const effectiveParentId = parsed.data.parentId !== undefined ? parsed.data.parentId : existing.parentId
    const effectiveProjectId = parsed.data.projectId !== undefined ? parsed.data.projectId : existing.projectId
    const effectiveStatus = parsed.data.status ?? existing.status

    const affectedLaneStatuses = new Set<typeof existing.status>()
    const changesLane = parsed.data.beforeId !== undefined
      || (parsed.data.status !== undefined && (parsed.data.status !== existing.status || existing.isInbox))
    if (changesLane) {
      if (!existing.isInbox) affectedLaneStatuses.add(existing.status)
      affectedLaneStatuses.add(effectiveStatus)
    }
    const expectedLaneVersions = Object.fromEntries(
      [...affectedLaneStatuses].map((status) => [status, parsed.data.expectedLaneVersions?.[status]]),
    ) as Partial<WorkItemLaneVersions>
    const missingLaneVersion = [...affectedLaneStatuses].find(
      (status) => expectedLaneVersions[status] === undefined,
    )
    if (missingLaneVersion) {
      return NextResponse.json(
        {
          error: `expectedLaneVersions.${missingLaneVersion} is required`,
          current: await currentWorkItemState(query.data.workspaceId, workItemId),
        },
        { status: 428 },
      )
    }

    if (parsed.data.beforeId === workItemId) return badRequest("A work item cannot be placed before itself")

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
          select: { id: true, workspaceId: true },
        })
        if (!targetProject || targetProject.workspaceId !== query.data.workspaceId) {
          return badRequest("Project not found in workspace")
        }
      }
    }

    const changedFields = Object.entries(parsed.data)
      .filter(([key, value]) => !["expectedUpdatedAt", "expectedLaneVersions"].includes(key) && value !== undefined)
      .map(([key]) => key)
    const action =
      parsed.data.status === "DONE" && existing.status !== "DONE"
        ? "COMPLETED"
        : parsed.data.status !== undefined && parsed.data.status !== existing.status
          ? "MOVED"
          : "UPDATED"

    const updated = await runSerializableWorkItemMutation(db, async (tx) => {
      await claimWorkItemLaneVersions(
        tx,
        query.data.workspaceId,
        expectedLaneVersions,
      )

      const mutationFields = {
          ...(parsed.data.projectId !== undefined ? { projectId: parsed.data.projectId } : {}),
          ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
          ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
          ...(parsed.data.checklist !== undefined ? { checklist: parsed.data.checklist } : {}),
          ...(noteReferences.noteIds !== undefined ? { noteIds: noteReferences.noteIds } : {}),
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          ...(parsed.data.status !== undefined ? { isInbox: false } : {}),
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
      }
      const mutationData = Object.keys(mutationFields).length > 0
        ? mutationFields
        : { updatedAt: new Date() }
      const claim = await tx.workItem.updateMany({
        where: { id: workItemId, updatedAt: new Date(expectedUpdatedAt) },
        data: mutationData,
      })
      if (claim.count !== 1) throw new StaleWorkItemMutationError()
      const patchedWorkItem = await tx.workItem.findUniqueOrThrow({
        where: { id: workItemId },
        select: {
          id: true,
          title: true,
          assigneeId: true,
          projectId: true,
          updatedAt: true,
        },
      })

      if (parsed.data.beforeId !== undefined) {
        if (parsed.data.beforeId) {
          const before = await tx.workItem.findFirst({
            where: {
              id: parsed.data.beforeId,
              workspaceId: query.data.workspaceId,
              status: effectiveStatus,
              isInbox: false,
            },
            select: { id: true },
          })
          if (!before) throw new StaleWorkItemLaneMutationError()
        }
        const siblings = await tx.workItem.findMany({
          where: {
            workspaceId: query.data.workspaceId,
            status: effectiveStatus,
            isInbox: false,
          },
          orderBy: [{ position: "asc" }, { createdAt: "asc" }],
          select: { id: true },
        })
        const orderedIds = siblings.filter((item) => item.id !== workItemId).map((item) => item.id)
        const targetIndex = parsed.data.beforeId ? orderedIds.indexOf(parsed.data.beforeId) : -1
        if (targetIndex >= 0) orderedIds.splice(targetIndex, 0, workItemId)
        else orderedIds.push(workItemId)
        await Promise.all(
          orderedIds.map((id, index) => tx.workItem.update({ where: { id }, data: { position: (index + 1) * 1024 } }))
        )
      }

      const projectForFlagsId = patchedWorkItem.projectId ?? existing.projectId
      const projectForFlags = projectForFlagsId
        ? await tx.project.findUnique({
            where: { id: projectForFlagsId },
            select: { featureFlags: true },
          })
        : null
      const featureFlags = normalizeProjectFeatureFlags(projectForFlags?.featureFlags)

      if (labelReferences.labelIds) {
        await tx.workItemLabel.deleteMany({ where: { workItemId } })
        if (labelReferences.labelIds.length > 0) {
          await tx.workItemLabel.createMany({
            data: labelReferences.labelIds.map((labelId) => ({ workItemId, labelId })),
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
    if (error instanceof StaleWorkItemMutationError || error instanceof StaleWorkItemLaneMutationError) {
      return NextResponse.json(
        {
          error: error instanceof StaleWorkItemLaneMutationError
            ? "Task order changed since it was loaded"
            : "Work item changed since it was loaded",
          current: await currentWorkItemState(query.data.workspaceId, workItemId),
        },
        { status: 409 },
      )
    }
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
      await resolveRequestActorUserId(_request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const existing = await db.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, workspaceId: true, title: true, createdById: true, status: true, isInbox: true },
    })
    if (!existing) return notFound("Work item not found")
    if (existing.workspaceId !== query.data.workspaceId) return notFound("Work item not found in workspace")
    if (!canDeleteWorkspaceContent({
      role: access.actor.role,
      actorUserId,
      creatorUserId: existing.createdById,
    })) return forbidden("Only the work-item creator or a workspace admin can delete this work item")

    await runSerializableWorkItemMutation(db, async (tx) => {
      await tx.workItem.delete({ where: { id: workItemId } })
      if (!existing.isInbox) {
        await bumpWorkItemLaneVersion(tx, query.data.workspaceId, existing.status)
      }
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
