import { NextRequest, NextResponse } from "next/server"

import { parseJsonBody, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import {
  IMPORT_LIMITS,
  importPreviewWorkspaceSnapshotSchema,
  workspaceQuerySchema,
} from "@/lib/contracts"
import { db } from "@/lib/db"
import { buildNoteAccessWhere } from "@/lib/note-access"
import { buildWorkspaceImportPlan } from "@/lib/workspace-import-plan"

export async function POST(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
    },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  const parsed = await parseJsonBody(request, importPreviewWorkspaceSnapshotSchema, {
    maxBytes: IMPORT_LIMITS.bodyBytes,
    maxNodes: 100_000,
  })
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response

    const snapshot = parsed.data
    const [existingProjects, existingWorkItems, existingNotes, existingProjectDocs, existingSavedViews] = await Promise.all([
      db.project.findMany({
        where: { workspaceId: query.data.workspaceId },
        select: { name: true },
      }),
      db.workItem.findMany({
        where: { workspaceId: query.data.workspaceId },
        select: { title: true },
      }),
      db.note.findMany({
        where: buildNoteAccessWhere(query.data.workspaceId, access.actor.userId),
        select: { title: true },
      }),
      db.projectDoc.findMany({
        where: { workspaceId: query.data.workspaceId },
        select: { title: true },
      }),
      db.savedView.findMany({
        where: { workspaceId: query.data.workspaceId, createdById: access.actor.userId },
        select: { name: true },
      }),
    ])

    const plan = buildWorkspaceImportPlan(snapshot, {
      projects: existingProjects.map((project) => project.name),
      tasks: existingWorkItems.map((item) => item.title),
      notes: existingNotes.map((note) => note.title),
      projectDocs: existingProjectDocs.map((doc) => doc.title),
      savedViews: existingSavedViews.map((view) => view.name),
    })

    return NextResponse.json({
      workspaceId: query.data.workspaceId,
      source: plan.source,
      counts: plan.counts,
      relationIssues: plan.relationIssues,
      duplicateCandidates: plan.duplicateCandidates,
      warnings: plan.warnings,
      writes: false,
    })
  } catch (error) {
    return serverError("Failed to preview workspace import", String(error))
  }
}
