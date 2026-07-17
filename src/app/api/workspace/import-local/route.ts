import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"

import { badRequest, parseDateValue, parseJsonBody, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { consumeWorkspaceThrottle, tooManyRequests } from "@/lib/auth-throttle"
import { importLocalWorkspaceSchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { buildNoteAccessWhere } from "@/lib/note-access"

function toProjectStatus(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_")
  if (normalized === "ACTIVE") return "ACTIVE"
  if (normalized === "IN_REVIEW") return "IN_REVIEW"
  if (normalized === "ON_HOLD") return "ON_HOLD"
  return "ARCHIVED"
}

function toProjectMode(value?: string) {
  const normalized = value?.trim().toUpperCase().replace(/\s+/g, "_")
  if (normalized === "SERVICE_DESK") return "SERVICE_DESK"
  return "STANDARD"
}

function toWorkItemStatus(value: string) {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, "_")
  if (normalized === "BACKLOG") return "BACKLOG"
  if (normalized === "TODO") return "TODO"
  if (normalized === "TO_DO") return "TODO"
  if (normalized === "IN_PROGRESS") return "IN_PROGRESS"
  if (normalized === "IN_REVIEW") return "IN_REVIEW"
  if (normalized === "DONE") return "DONE"
  return "BACKLOG"
}

function toWorkItemPriority(value: string) {
  const normalized = value.trim().toUpperCase()
  if (normalized === "LOW") return "LOW"
  if (normalized === "MEDIUM") return "MEDIUM"
  if (normalized === "HIGH") return "HIGH"
  if (normalized === "URGENT") return "URGENT"
  return "MEDIUM"
}

function toNoteVisibility(_value?: string): "PRIVATE" | "WORKSPACE" {
  return "PRIVATE"
}

function toProjectDocStatus(value: "ACTIVE" | "ARCHIVED") {
  return value
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, importLocalWorkspaceSchema)
  if (!parsed.ok) return parsed.response

  const { workspaceId, mode, projects, workItems, notes, projectDocs, mapLayouts } = parsed.data

  try {
    const access = await requireWorkspaceRole(
      workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response
    if (mapLayouts.some((layout) => layout.schemaVersion !== 1)) {
      return badRequest("Unsupported Map schema version")
    }
    const actorUserId = access.actor.userId
    const throttle = await consumeWorkspaceThrottle("import", actorUserId, workspaceId)
    if (!throttle.allowed) return tooManyRequests(throttle)

    const summary = await db.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.mapScope.deleteMany({ where: { workspaceId } })
        await tx.workItem.deleteMany({ where: { workspaceId } })
        await tx.note.deleteMany({
          where: buildNoteAccessWhere(workspaceId, actorUserId),
        })
        await tx.projectDoc.deleteMany({ where: { workspaceId } })
        await tx.project.deleteMany({ where: { workspaceId } })
      }

      const projectMap = new Map<string, string>()
      const workItemMap = new Map<string, string>()
      const pendingParents: Array<{ workItemId: string; sourceParentId: string }> = []
      const workspaceMembers = await tx.workspaceMember.findMany({
        where: { workspaceId },
        select: { userId: true },
      })
      const memberUserIds = new Set(workspaceMembers.map((member) => member.userId))
      let createdProjects = 0
      let createdWorkItems = 0
      let skippedWorkItems = 0
      let createdNotes = 0
      let skippedNotes = 0
      let createdProjectDocs = 0
      let skippedProjectDocs = 0
      let unlinkedProjectDocs = 0
      let importedMapLayouts = 0
      let skippedMapLayouts = 0
      let skippedMapPlacements = 0

      for (const project of projects) {
        const slug = slugify(project.name || project.id || "project")
        const upserted = await tx.project.upsert({
          where: { workspaceId_slug: { workspaceId, slug } },
          update: {
            name: project.name,
            status: toProjectStatus(project.status),
            mode: toProjectMode(project.mode),
            featureFlags: project.featureFlags,
            dueDate: parseDateValue(project.due) ?? undefined,
            color: project.accent,
          },
          create: {
            workspaceId,
            name: project.name,
            slug,
            status: toProjectStatus(project.status),
            mode: toProjectMode(project.mode),
            featureFlags: project.featureFlags,
            dueDate: parseDateValue(project.due) ?? undefined,
            color: project.accent,
            createdById: actorUserId,
          },
        })
        projectMap.set(project.id, upserted.id)
        createdProjects += 1
      }

      for (const item of workItems) {
        const projectId = item.project ? projectMap.get(item.project) : null
        const duplicate = await tx.workItem.findFirst({
          where: {
            workspaceId,
            projectId,
            title: item.title,
          },
          select: { id: true },
        })
        if (duplicate) {
          workItemMap.set(item.id, duplicate.id)
          skippedWorkItems += 1
          continue
        }

        const created = await tx.workItem.create({
          data: {
            workspaceId,
            projectId: projectId ?? undefined,
            title: item.title,
            description: item.description,
            checklist: item.checklist,
            noteIds: item.noteIds,
            status: toWorkItemStatus(item.status),
            priority: toWorkItemPriority(item.priority),
            startDate: parseDateValue(item.start) ?? undefined,
            dueDate: parseDateValue(item.due) ?? undefined,
            createdById: actorUserId,
            assigneeId: item.assignee && memberUserIds.has(item.assignee) ? item.assignee : undefined,
          },
          select: { id: true },
        })
        workItemMap.set(item.id, created.id)
        if (item.parentId) {
          pendingParents.push({ workItemId: created.id, sourceParentId: item.parentId })
        }
        createdWorkItems += 1
      }

      for (const pending of pendingParents) {
        const parentId = workItemMap.get(pending.sourceParentId)
        if (!parentId || parentId === pending.workItemId) continue
        await tx.workItem.update({
          where: { id: pending.workItemId },
          data: { parentId },
        })
      }

      for (const note of notes) {
        const duplicate = await tx.note.findFirst({
          where: {
            ...buildNoteAccessWhere(workspaceId, actorUserId),
            title: note.title,
          },
          select: { id: true },
        })
        if (duplicate) {
          skippedNotes += 1
          continue
        }

        await tx.note.create({
          data: {
            workspaceId,
            title: note.title,
            body: note.body ?? note.excerpt ?? "",
            visibility: toNoteVisibility(note.tag),
            pinned: false,
            tags: note.tag ? [note.tag] : [],
            createdById: actorUserId,
            updatedById: actorUserId,
          },
        })
        createdNotes += 1
      }

      for (const doc of projectDocs) {
        const projectId = doc.project ? projectMap.get(doc.project) : null
        const duplicate = await tx.projectDoc.findFirst({
          where: {
            workspaceId,
            projectId: projectId ?? undefined,
            title: doc.title,
          },
          select: { id: true },
        })
        if (duplicate) {
          skippedProjectDocs += 1
          continue
        }

        if (doc.project && !projectId) {
          unlinkedProjectDocs += 1
        }

        const status = toProjectDocStatus(doc.status)
        await tx.projectDoc.create({
          data: {
            workspaceId,
            projectId: projectId ?? undefined,
            title: doc.title,
            body: doc.body ?? "",
            status,
            archivedAt: status === "ARCHIVED" ? parseDateValue(doc.archivedAt) ?? new Date() : undefined,
            createdById: actorUserId,
            updatedById: actorUserId,
          },
        })
        createdProjectDocs += 1
      }

      for (const layout of mapLayouts) {
        const scopedProjectId =
          layout.scopeType === "PROJECT" && layout.projectId
            ? projectMap.get(layout.projectId)
            : null
        if (layout.scopeType === "PROJECT" && !scopedProjectId) {
          skippedMapLayouts += 1
          continue
        }

        const scopeKey = scopedProjectId ? `project:${scopedProjectId}` : "workspace"
        const existingScope = await tx.mapScope.findUnique({
          where: { workspaceId_scopeKey: { workspaceId, scopeKey } },
          select: { id: true, revision: true },
        })
        const revision = existingScope
          ? Math.max(existingScope.revision + 1, layout.revision)
          : layout.revision
        const scope = await tx.mapScope.upsert({
          where: { workspaceId_scopeKey: { workspaceId, scopeKey } },
          update: { revision, schemaVersion: 1 },
          create: {
            workspaceId,
            scopeType: layout.scopeType,
            projectId: scopedProjectId,
            scopeKey,
            schemaVersion: 1,
            revision,
          },
          select: { id: true },
        })

        const highestSection = await tx.mapSection.aggregate({
          where: { mapScopeId: scope.id },
          _max: { sortOrder: true },
        })
        const sectionOffset = (highestSection._max.sortOrder ?? -1) + 1
        const sectionMap = new Map<string, string>()
        for (const section of layout.sections) {
          const id = randomUUID()
          await tx.mapSection.create({
            data: {
              id,
              mapScopeId: scope.id,
              name: section.name,
              sortOrder: sectionOffset + section.sortOrder,
              x: section.x,
              y: section.y,
              width: section.width,
              height: section.height,
              color: section.color,
            },
          })
          sectionMap.set(section.id, id)
        }

        for (const placement of layout.projectPlacements) {
          const projectId = placement.projectId
            ? projectMap.get(placement.projectId)
            : null
          if (
            (placement.projectId && !projectId) ||
            (scopedProjectId && projectId !== scopedProjectId)
          ) {
            skippedMapPlacements += 1
            continue
          }
          const containerKey = projectId ? `project:${projectId}` : "no-project"
          await tx.mapProjectPlacement.upsert({
            where: {
              mapScopeId_containerKey: {
                mapScopeId: scope.id,
                containerKey,
              },
            },
            update: { x: placement.x, y: placement.y },
            create: {
              mapScopeId: scope.id,
              containerKey,
              projectId,
              x: placement.x,
              y: placement.y,
            },
          })
        }

        for (const placement of layout.taskPlacements) {
          const workItemId = workItemMap.get(placement.workItemId)
          if (!workItemId) {
            skippedMapPlacements += 1
            continue
          }
          const sectionId = placement.sectionId
            ? sectionMap.get(placement.sectionId) ?? null
            : null
          await tx.mapTaskPlacement.upsert({
            where: {
              mapScopeId_workItemId: {
                mapScopeId: scope.id,
                workItemId,
              },
            },
            update: { x: placement.x, y: placement.y, sectionId },
            create: {
              mapScopeId: scope.id,
              workItemId,
              x: placement.x,
              y: placement.y,
              sectionId,
            },
          })
        }
        importedMapLayouts += 1
      }

      return {
        workspaceId,
        mode,
        imported: {
          projects: createdProjects,
          workItems: createdWorkItems,
          notes: createdNotes,
          projectDocs: createdProjectDocs,
          mapLayouts: importedMapLayouts,
        },
        skipped: {
          workItems: skippedWorkItems,
          notes: skippedNotes,
          projectDocs: skippedProjectDocs,
          mapLayouts: skippedMapLayouts,
        },
        warnings: {
          projectDocsMissingProjects: unlinkedProjectDocs,
          mapPlacementsMissingEntities: skippedMapPlacements,
        },
      }
    })

    return NextResponse.json(summary, { status: 201 })
  } catch (error) {
    return serverError("Failed to import local workspace data", String(error))
  }
}
