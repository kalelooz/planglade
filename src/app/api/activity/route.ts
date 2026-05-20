import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { parseQuery, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"

const activityQuerySchema = z.object({
  workspaceId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(500).default(250),
  projectId: z.string().min(1).optional(),
})

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? "250",
      projectId: request.nextUrl.searchParams.get("projectId") ?? undefined,
    },
    activityQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response

    const events = await db.activityEvent.findMany({
      where: { workspaceId: query.data.workspaceId },
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: query.data.limit,
    })

    const workItemIds = Array.from(
      new Set(events.filter((event) => event.entityType === "WORK_ITEM").map((event) => event.entityId))
    )
    const projectIds = Array.from(
      new Set(events.filter((event) => event.entityType === "PROJECT").map((event) => event.entityId))
    )
    const noteIds = Array.from(
      new Set(events.filter((event) => event.entityType === "NOTE").map((event) => event.entityId))
    )

    const workItems = workItemIds.length
      ? await db.workItem.findMany({
          where: { id: { in: workItemIds } },
          select: {
            id: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            projectId: true,
            assigneeId: true,
          },
        })
      : []
    const projects = projectIds.length
      ? await db.project.findMany({
          where: { id: { in: projectIds } },
          select: {
            id: true,
            name: true,
            status: true,
            dueDate: true,
            color: true,
          },
        })
      : []
    const notes = noteIds.length
      ? await db.note.findMany({
          where: { id: { in: noteIds } },
          select: { id: true, title: true, projectId: true },
        })
      : []

    const workItemById = new Map(workItems.map((item) => [item.id, item] as const))
    const projectById = new Map(projects.map((project) => [project.id, project] as const))
    const noteById = new Map(notes.map((note) => [note.id, note] as const))

    const mapped = events
      .map((event) => {
        const workItem = event.entityType === "WORK_ITEM" ? workItemById.get(event.entityId) ?? null : null
        const project = event.entityType === "PROJECT" ? projectById.get(event.entityId) ?? null : null
        const note = event.entityType === "NOTE" ? noteById.get(event.entityId) ?? null : null

        const relatedProjectId =
          project?.id ?? workItem?.projectId ?? note?.projectId ?? null

        return {
          id: event.id,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          summary: event.summary,
          metadata: event.metadata,
          createdAt: event.createdAt.toISOString(),
          actor: event.actor,
          target:
            workItem?.title ??
            project?.name ??
            note?.title ??
            event.summary ??
            event.entityId,
          workItemId: workItem?.id ?? null,
          projectId: relatedProjectId,
          noteId: note?.id ?? null,
          workItem: workItem
            ? {
                id: workItem.id,
                title: workItem.title,
                status: workItem.status,
                priority: workItem.priority,
                dueDate: workItem.dueDate?.toISOString() ?? null,
                assigneeId: workItem.assigneeId,
              }
            : null,
          project: project
            ? {
                id: project.id,
                name: project.name,
                status: project.status,
                dueDate: project.dueDate?.toISOString() ?? null,
                color: project.color,
              }
            : null,
        }
      })
      .filter((entry) => !query.data.projectId || entry.projectId === query.data.projectId)

    return NextResponse.json({ events: mapped })
  } catch (error) {
    return serverError("Failed to load activity", String(error))
  }
}
