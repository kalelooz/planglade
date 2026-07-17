import { NextRequest, NextResponse } from "next/server"

import {
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { consumeWorkspaceThrottle, tooManyRequests } from "@/lib/auth-throttle"
import { resolvePriorityDisplayStyle, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { buildNoteAccessWhere } from "@/lib/note-access"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
    },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const actorUserId = await resolveRequestActorUserId(request)
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      actorUserId,
      "MEMBER"
    )
    if (!access.ok) return access.response
    const throttle = await consumeWorkspaceThrottle(
      "export",
      access.actor.userId,
      query.data.workspaceId,
    )
    if (!throttle.allowed) return tooManyRequests(throttle)

    const [workspace, projects, workItems, notes, labels, projectDocs, mapScopes] = await Promise.all([
      db.workspace.findUnique({
        where: { id: query.data.workspaceId },
        select: {
          id: true,
          slug: true,
          name: true,
          taskPriorityDisplayStyle: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      db.project.findMany({
        where: { workspaceId: query.data.workspaceId },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          status: true,
          mode: true,
          featureFlags: true,
          color: true,
          startDate: true,
          dueDate: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      db.workItem.findMany({
        where: { workspaceId: query.data.workspaceId },
        select: {
          id: true,
          title: true,
          description: true,
          checklist: true,
          noteIds: true,
          status: true,
          priority: true,
          startDate: true,
          dueDate: true,
          completedAt: true,
          sortOrder: true,
          position: true,
          projectId: true,
          assigneeId: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
          labels: {
            select: {
              labelId: true,
              createdAt: true,
              label: {
                select: {
                  id: true,
                  name: true,
                  color: true,
                },
              },
            },
          },
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      db.note.findMany({
        where: buildNoteAccessWhere(query.data.workspaceId, access.actor.userId),
        select: {
          id: true,
          projectId: true,
          title: true,
          body: true,
          visibility: true,
          pinned: true,
          tags: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      db.label.findMany({
        where: { workspaceId: query.data.workspaceId },
        select: {
          id: true,
          name: true,
          color: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ name: "asc" }],
      }),
      db.projectDoc.findMany({
        where: { workspaceId: query.data.workspaceId },
        select: {
          id: true,
          projectId: true,
          title: true,
          body: true,
          status: true,
          archivedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: [{ createdAt: "asc" }],
      }),
      db.mapScope.findMany({
        where: { workspaceId: query.data.workspaceId },
        select: {
          scopeType: true,
          projectId: true,
          schemaVersion: true,
          revision: true,
          taskPlacements: {
            select: { workItemId: true, sectionId: true, x: true, y: true },
            orderBy: { workItemId: "asc" },
          },
          projectPlacements: {
            select: { projectId: true, x: true, y: true },
            orderBy: { containerKey: "asc" },
          },
          sections: {
            select: {
              id: true,
              name: true,
              sortOrder: true,
              x: true,
              y: true,
              width: true,
              height: true,
              color: true,
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: [{ scopeType: "asc" }, { projectId: "asc" }],
      }),
    ])

    const exportedAt = new Date().toISOString()
    const serializedWorkspace = workspace
      ? {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          taskPriorityDisplayStyle: resolvePriorityDisplayStyle(workspace.taskPriorityDisplayStyle),
          createdAt: workspace.createdAt.toISOString(),
          updatedAt: workspace.updatedAt.toISOString(),
        }
      : {
          id: query.data.workspaceId,
          slug: "unknown",
          name: "Workspace",
          taskPriorityDisplayStyle: resolvePriorityDisplayStyle(undefined),
        }
    const serializedProjects = projects.map((project) => ({
      id: project.id,
      name: project.name,
      slug: project.slug,
      description: project.description ?? undefined,
      status: project.status,
      mode: project.mode,
      featureFlags:
        project.featureFlags && typeof project.featureFlags === "object" && !Array.isArray(project.featureFlags)
          ? project.featureFlags
          : undefined,
      color: project.color ?? undefined,
      startDate: project.startDate?.toISOString(),
      dueDate: project.dueDate?.toISOString(),
      archivedAt: project.archivedAt?.toISOString(),
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    }))
    const accessibleNoteIds = new Set(notes.map((note) => note.id))
    const serializedWorkItems = workItems.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description ?? undefined,
      status: item.status,
      priority: item.priority,
      projectId: item.projectId ?? undefined,
      assigneeId: item.assigneeId ?? undefined,
      parentId: item.parentId ?? undefined,
      startDate: item.startDate?.toISOString(),
      dueDate: item.dueDate?.toISOString(),
      completedAt: item.completedAt?.toISOString(),
      sortOrder: item.sortOrder,
      position: item.position,
      noteIds: Array.isArray(item.noteIds)
        ? item.noteIds.filter((noteId): noteId is string =>
            typeof noteId === "string" && accessibleNoteIds.has(noteId)
          )
        : undefined,
      checklist: Array.isArray(item.checklist) ? item.checklist : undefined,
      labelIds: item.labels.map((entry) => entry.labelId),
      labels: item.labels.map((entry) => ({
        id: entry.label.id,
        name: entry.label.name,
        color: entry.label.color ?? undefined,
      })),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
    const serializedNotes = notes.map((note) => {
      const tags = Array.isArray(note.tags)
        ? note.tags.filter((entry): entry is string => typeof entry === "string")
        : []
      return {
        id: note.id,
        projectId: note.projectId ?? undefined,
        title: note.title,
        body: note.body ?? "",
        visibility: note.visibility,
        pinned: note.pinned,
        tags,
        createdAt: note.createdAt.toISOString(),
        updatedAt: note.updatedAt.toISOString(),
      }
    })
    const serializedLabels = labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color ?? undefined,
      createdAt: label.createdAt.toISOString(),
      updatedAt: label.updatedAt.toISOString(),
    }))
    const serializedTaskLabels = workItems.flatMap((item) =>
      item.labels.map((entry) => ({
        taskId: item.id,
        labelId: entry.labelId,
        createdAt: entry.createdAt.toISOString(),
      }))
    )
    const serializedLegacyDocs = projectDocs.map((doc) => ({
      id: doc.id,
      projectId: doc.projectId ?? undefined,
      title: doc.title,
      body: doc.body ?? "",
      status: doc.status,
      archivedAt: doc.archivedAt?.toISOString(),
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    }))
    const serializedMapLayouts = mapScopes.map((scope) => ({
      schemaVersion: scope.schemaVersion,
      scopeType: scope.scopeType,
      projectId: scope.projectId ?? undefined,
      revision: scope.revision,
      taskPlacements: scope.taskPlacements,
      projectPlacements: scope.projectPlacements,
      sections: scope.sections,
    }))
    const tasks = serializedWorkItems.filter((item) => item.status !== "BACKLOG")
    const inboxItems = serializedWorkItems.filter((item) => item.status === "BACKLOG")

    const response = NextResponse.json({
      version: 1,
      exportedAt,
      generatedAt: exportedAt,
      workspace: serializedWorkspace,
      projects: serializedProjects,
      tasks,
      inboxItems,
      notes: serializedNotes,
      labels: serializedLabels,
      taskLabels: serializedTaskLabels,
      legacyDocs: serializedLegacyDocs,
      data: {
        projects: serializedProjects.map((project) => ({
          id: project.id,
          name: project.name,
          status: project.status,
          mode: project.mode,
          featureFlags: project.featureFlags,
          due: project.dueDate,
          accent: project.color,
        })),
        workItems: serializedWorkItems.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          priority: item.priority,
          assignee: item.assigneeId ?? undefined,
          due: item.dueDate,
          start: item.startDate,
          project: item.projectId,
          parentId: item.parentId ?? undefined,
          description: item.description ?? undefined,
          noteIds: item.noteIds,
          checklist: item.checklist,
        })),
        notes: serializedNotes.map((note) => ({
          id: note.id,
          title: note.title,
          tag: note.tags[0] ?? "Note",
          excerpt: note.body.slice(0, 240),
          body: note.body,
        })),
        projectDocs: serializedLegacyDocs.map((doc) => ({
          id: doc.id,
          project: doc.projectId,
          title: doc.title,
          body: doc.body,
          status: doc.status,
          archivedAt: doc.archivedAt,
        })),
        mapLayouts: serializedMapLayouts,
      },
      counts: {
        projects: serializedProjects.length,
        tasks: tasks.length,
        inboxItems: inboxItems.length,
        workItems: serializedWorkItems.length,
        notes: serializedNotes.length,
        labels: serializedLabels.length,
        taskLabels: serializedTaskLabels.length,
        legacyDocs: serializedLegacyDocs.length,
        projectDocs: serializedLegacyDocs.length,
        mapLayouts: serializedMapLayouts.length,
      },
    })
    response.headers.set("Cache-Control", "no-store")
    return response
  } catch {
    return serverError("Failed to export workspace snapshot")
  }
}
