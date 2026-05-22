import { NextRequest, NextResponse } from "next/server"

import { parseQuery, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { workspaceExportQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      userId: request.nextUrl.searchParams.get("userId") ?? undefined,
    },
    workspaceExportQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? query.data.userId,
      "MEMBER"
    )
    if (!access.ok) return access.response

    const targetUserId = query.data.userId ?? access.actor.userId

    const [workspace, projects, workItems, notes, settings] = await Promise.all([
      db.workspace.findUnique({
        where: { id: query.data.workspaceId },
        select: { id: true, slug: true, name: true },
      }),
      db.project.findMany({
        where: { workspaceId: query.data.workspaceId },
        orderBy: [{ createdAt: "asc" }],
      }),
      db.workItem.findMany({
        where: { workspaceId: query.data.workspaceId },
        orderBy: [{ createdAt: "asc" }],
      }),
      db.note.findMany({
        where: { workspaceId: query.data.workspaceId },
        orderBy: [{ createdAt: "asc" }],
      }),
      db.userSettings.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: query.data.workspaceId,
            userId: targetUserId,
          },
        },
      }),
    ])

    return NextResponse.json({
      version: 1,
      generatedAt: new Date().toISOString(),
      workspace: workspace ?? {
        id: query.data.workspaceId,
        slug: "unknown",
        name: "Workspace",
      },
      settings: settings
        ? {
            userId: settings.userId,
            theme: settings.theme,
            density: settings.density,
            accent: settings.accent,
            notifications: settings.notifications,
          }
        : null,
      data: {
        projects: projects.map((project) => ({
          id: project.id,
          name: project.name,
          status: project.status,
          mode: project.mode,
          featureFlags:
            project.featureFlags && typeof project.featureFlags === "object" && !Array.isArray(project.featureFlags)
              ? project.featureFlags
              : undefined,
          due: project.dueDate?.toISOString(),
          accent: project.color ?? undefined,
        })),
        workItems: workItems.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          priority: item.priority,
          assignee: item.assigneeId ?? undefined,
          due: item.dueDate?.toISOString(),
          start: item.startDate?.toISOString(),
          project: item.projectId ?? undefined,
          description: item.description ?? undefined,
          noteIds: Array.isArray(item.noteIds) ? item.noteIds : undefined,
          checklist: Array.isArray(item.checklist) ? item.checklist : undefined,
        })),
        notes: notes.map((note) => {
          const tags = Array.isArray(note.tags)
            ? note.tags.filter((entry): entry is string => typeof entry === "string")
            : []
          return {
            id: note.id,
            title: note.title,
            tag: tags[0] ?? "Note",
            excerpt: (note.body ?? "").slice(0, 240),
            body: note.body ?? "",
          }
        }),
      },
      counts: {
        projects: projects.length,
        workItems: workItems.length,
        notes: notes.length,
      },
    })
  } catch (error) {
    return serverError("Failed to export workspace snapshot", String(error))
  }
}
