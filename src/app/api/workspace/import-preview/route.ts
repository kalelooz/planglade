import { NextRequest, NextResponse } from "next/server"

import { parseJsonBody, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { consumeWorkspaceThrottle, tooManyRequests } from "@/lib/auth-throttle"
import {
  importPreviewWorkspaceSnapshotSchema,
  type ImportPreviewWorkspaceSnapshotInput,
  workspaceQuerySchema,
} from "@/lib/contracts"
import { db } from "@/lib/db"
import { buildNoteAccessWhere } from "@/lib/note-access"

const SUPPORTED_EXPORT_VERSION = 1

type PreviewWarning = {
  code: string
  message: string
  count?: number
}

function normalizeMatchValue(value: string) {
  return value.trim().toLowerCase()
}

function countDuplicates<T>(items: T[], existingValues: Set<string>, getValue: (item: T) => string) {
  return items.filter((item) => existingValues.has(normalizeMatchValue(getValue(item)))).length
}

function addCountWarning(warnings: PreviewWarning[], code: string, message: string, count: number) {
  if (count > 0) {
    warnings.push({ code, message, count })
  }
}

function buildRelationshipWarnings(snapshot: ImportPreviewWorkspaceSnapshotInput) {
  const warnings: PreviewWarning[] = []
  const importedProjectIds = new Set(snapshot.data.projects.map((project) => project.id))
  const importedWorkItemIds = new Set(snapshot.data.workItems.map((item) => item.id))
  const importedNoteIds = new Set(snapshot.data.notes.map((note) => note.id))

  const workItemsMissingProjects = snapshot.data.workItems.filter(
    (item) => item.project && !importedProjectIds.has(item.project)
  ).length
  const projectDocsMissingProjects = snapshot.data.projectDocs.filter(
    (doc) => doc.project && !importedProjectIds.has(doc.project)
  ).length
  const workItemsMissingNotes = snapshot.data.workItems.filter((item) =>
    item.noteIds?.some((noteId) => !importedNoteIds.has(noteId))
  ).length
  const archivedProjectDocs = snapshot.data.projectDocs.filter(
    (doc) => doc.status === "ARCHIVED" || Boolean(doc.archivedAt)
  ).length
  const unsupportedMapLayouts = snapshot.data.mapLayouts.filter(
    (layout) => layout.schemaVersion !== 1,
  ).length
  const mapLayoutsMissingProjects = snapshot.data.mapLayouts.filter(
    (layout) =>
      layout.scopeType === "PROJECT" &&
      (!layout.projectId || !importedProjectIds.has(layout.projectId)),
  ).length
  const mapPlacementsMissingTasks = snapshot.data.mapLayouts.reduce(
    (count, layout) =>
      count +
      layout.taskPlacements.filter(
        (placement) => !importedWorkItemIds.has(placement.workItemId),
      ).length,
    0,
  )
  const mapPlacementsMissingProjects = snapshot.data.mapLayouts.reduce(
    (count, layout) =>
      count +
      layout.projectPlacements.filter(
        (placement) =>
          placement.projectId !== null &&
          !importedProjectIds.has(placement.projectId),
      ).length,
    0,
  )

  addCountWarning(
    warnings,
    "work_items_missing_projects",
    "Some tasks reference projects that are not in this import file.",
    workItemsMissingProjects
  )
  addCountWarning(
    warnings,
    "project_docs_missing_projects",
    "Some Project Docs reference projects that are not in this import file.",
    projectDocsMissingProjects
  )
  addCountWarning(
    warnings,
    "work_items_missing_notes",
    "Some tasks reference notes that are not in this import file.",
    workItemsMissingNotes
  )
  addCountWarning(
    warnings,
    "archived_project_docs",
    "Archived Project Docs are included in this import file.",
    archivedProjectDocs
  )
  addCountWarning(
    warnings,
    "unsupported_map_schema",
    "Some Map layouts use an unsupported schema version and cannot be imported.",
    unsupportedMapLayouts,
  )
  addCountWarning(
    warnings,
    "map_layouts_missing_projects",
    "Some project Maps reference projects that are not in this import file.",
    mapLayoutsMissingProjects,
  )
  addCountWarning(
    warnings,
    "map_placements_missing_tasks",
    "Some Map placements reference tasks that are not in this import file.",
    mapPlacementsMissingTasks,
  )
  addCountWarning(
    warnings,
    "map_placements_missing_projects",
    "Some Map placements reference projects that are not in this import file.",
    mapPlacementsMissingProjects,
  )

  return {
    warnings,
    relationCounts: {
      workItemsMissingProjects,
      projectDocsMissingProjects,
      workItemsMissingNotes,
      archivedProjectDocs,
      unsupportedMapLayouts,
      mapLayoutsMissingProjects,
      mapPlacementsMissingTasks,
      mapPlacementsMissingProjects,
    },
  }
}

export async function POST(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
    },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  const parsed = await parseJsonBody(request, importPreviewWorkspaceSnapshotSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response
    const throttle = await consumeWorkspaceThrottle(
      "import-preview",
      access.actor.userId,
      query.data.workspaceId,
    )
    if (!throttle.allowed) return tooManyRequests(throttle)

    const snapshot = parsed.data
    const [existingProjects, existingWorkItems, existingNotes, existingProjectDocs] = await Promise.all([
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
    ])

    const warnings: PreviewWarning[] = []
    if (snapshot.version && snapshot.version !== SUPPORTED_EXPORT_VERSION) {
      warnings.push({
        code: "unsupported_export_version",
        message: `This export version is not currently supported. Expected version ${SUPPORTED_EXPORT_VERSION}.`,
      })
    }

    const { warnings: relationshipWarnings, relationCounts } = buildRelationshipWarnings(snapshot)
    warnings.push(...relationshipWarnings)

    const duplicateCandidates = {
      projects: countDuplicates(
        snapshot.data.projects,
        new Set(existingProjects.map((project) => normalizeMatchValue(project.name))),
        (project) => project.name
      ),
      tasks: countDuplicates(
        snapshot.data.workItems,
        new Set(existingWorkItems.map((item) => normalizeMatchValue(item.title))),
        (item) => item.title
      ),
      notes: countDuplicates(
        snapshot.data.notes,
        new Set(existingNotes.map((note) => normalizeMatchValue(note.title))),
        (note) => note.title
      ),
      projectDocs: countDuplicates(
        snapshot.data.projectDocs,
        new Set(existingProjectDocs.map((doc) => normalizeMatchValue(doc.title))),
        (doc) => doc.title
      ),
    }

    addCountWarning(
      warnings,
      "duplicate_projects",
      "Possible duplicate projects found by simple name matching.",
      duplicateCandidates.projects
    )
    addCountWarning(
      warnings,
      "duplicate_tasks",
      "Possible duplicate tasks found by simple title matching.",
      duplicateCandidates.tasks
    )
    addCountWarning(
      warnings,
      "duplicate_notes",
      "Possible duplicate notes found by simple title matching.",
      duplicateCandidates.notes
    )
    addCountWarning(
      warnings,
      "duplicate_project_docs",
      "Possible duplicate Project Docs found by simple title matching.",
      duplicateCandidates.projectDocs
    )

    return NextResponse.json({
      workspaceId: query.data.workspaceId,
      source: {
        version: snapshot.version ?? null,
        generatedAt: snapshot.generatedAt ?? null,
        workspaceName: snapshot.workspace?.name ?? null,
        workspaceSlug: snapshot.workspace?.slug ?? null,
      },
      counts: {
        projects: snapshot.data.projects.length,
        tasks: snapshot.data.workItems.length,
        notes: snapshot.data.notes.length,
        projectDocs: snapshot.data.projectDocs.length,
        mapLayouts: snapshot.data.mapLayouts.length,
        settings: snapshot.settings ? 1 : 0,
        archivedProjectDocs: relationCounts.archivedProjectDocs,
      },
      relationIssues: {
        tasksMissingProjects: relationCounts.workItemsMissingProjects,
        projectDocsMissingProjects: relationCounts.projectDocsMissingProjects,
        tasksMissingNotes: relationCounts.workItemsMissingNotes,
        mapLayoutsMissingProjects: relationCounts.mapLayoutsMissingProjects,
        mapPlacementsMissingTasks: relationCounts.mapPlacementsMissingTasks,
        mapPlacementsMissingProjects: relationCounts.mapPlacementsMissingProjects,
      },
      duplicateCandidates,
      warnings,
      writes: false,
    })
  } catch (error) {
    return serverError("Failed to preview workspace import", String(error))
  }
}
