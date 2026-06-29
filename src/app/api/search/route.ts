import { NextRequest, NextResponse } from "next/server"

import { parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { db } from "@/lib/db"
import { searchQuerySchema } from "@/lib/contracts"

function normalizeQuery(value: string) {
  return value.trim()
}

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      q: request.nextUrl.searchParams.get("q") ?? undefined,
      projectId: request.nextUrl.searchParams.get("projectId") ?? undefined,
      limit: request.nextUrl.searchParams.get("limit") ?? "25",
    },
    searchQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response

    const term = normalizeQuery(query.data.q)
    const take = query.data.limit

    const [projects, workItems, notes, labels] = await Promise.all([
      db.project.findMany({
        where: {
          workspaceId: query.data.workspaceId,
          ...(query.data.projectId ? { id: query.data.projectId } : {}),
          OR: [{ name: { contains: term } }, { slug: { contains: term } }, { description: { contains: term } }],
        },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          status: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take,
      }),
      db.workItem.findMany({
        where: {
          workspaceId: query.data.workspaceId,
          ...(query.data.projectId ? { projectId: query.data.projectId } : {}),
          OR: [{ title: { contains: term } }, { description: { contains: term } }],
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          projectId: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take,
      }),
      db.note.findMany({
        where: {
          workspaceId: query.data.workspaceId,
          ...(query.data.projectId ? { projectId: query.data.projectId } : {}),
          OR: [{ title: { contains: term } }, { body: { contains: term } }],
        },
        select: {
          id: true,
          title: true,
          body: true,
          projectId: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take,
      }),
      db.label.findMany({
        where: {
          workspaceId: query.data.workspaceId,
          name: { contains: term },
        },
        select: {
          id: true,
          name: true,
          color: true,
          updatedAt: true,
        },
        orderBy: { updatedAt: "desc" },
        take,
      }),
    ])

    const results = [
      ...workItems.map((item) => ({
        kind: "work-item" as const,
        id: item.id,
        title: item.title,
        subtitle: item.description,
        projectId: item.projectId,
        updatedAt: item.updatedAt.toISOString(),
        status: item.status,
        priority: item.priority,
      })),
      ...notes.map((note) => ({
        kind: "note" as const,
        id: note.id,
        title: note.title,
        subtitle: note.body,
        projectId: note.projectId,
        updatedAt: note.updatedAt.toISOString(),
      })),
      ...projects.map((project) => ({
        kind: "project" as const,
        id: project.id,
        title: project.name,
        subtitle: project.description ?? project.slug,
        projectId: project.id,
        updatedAt: project.updatedAt.toISOString(),
        status: project.status,
      })),
      ...labels.map((label) => ({
        kind: "label" as const,
        id: label.id,
        title: label.name,
        subtitle: label.color ?? null,
        projectId: null,
        updatedAt: label.updatedAt.toISOString(),
      })),
    ]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, take)

    return NextResponse.json({
      query: term,
      total: results.length,
      results,
      groups: {
        projects,
        workItems,
        notes,
        labels,
      },
    })
  } catch (error) {
    return serverError("Search failed", String(error))
  }
}
