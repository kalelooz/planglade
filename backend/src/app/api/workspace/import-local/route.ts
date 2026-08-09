import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { parseDateValue, parseJsonBody, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { IMPORT_LIMITS, importLocalWorkspaceSchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { buildNoteAccessWhere } from "@/lib/note-access"
import { tryAcquireWorkspaceImport } from "@/lib/workspace-import-lock"

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
  const parsed = await parseJsonBody(request, importLocalWorkspaceSchema, {
    maxBytes: IMPORT_LIMITS.bodyBytes,
    maxNodes: 100_000,
  })
  if (!parsed.ok) return parsed.response

  const { workspaceId, mode, projects, workItems, notes, projectDocs, savedViews } = parsed.data

  try {
    const access = await requireWorkspaceRole(
      workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId
    const releaseImport = tryAcquireWorkspaceImport(workspaceId)
    if (!releaseImport) {
      return NextResponse.json(
        { error: "Another import is already running for this workspace" },
        { status: 409 }
      )
    }

    try {
      const summary = await db.$transaction(async (tx) => {
      const projectMap = new Map<string, string>()
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
      let createdSavedViews = 0
      let skippedSavedViews = 0

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
            projectId: projectId ?? undefined,
            title: item.title,
          },
          select: { id: true },
        })
        if (duplicate) {
          skippedWorkItems += 1
          continue
        }

        await tx.workItem.create({
          data: {
            workspaceId,
            projectId: projectId ?? undefined,
            title: item.title,
            description: item.description,
            checklist: item.checklist,
            noteIds: item.noteIds,
            status: toWorkItemStatus(item.status),
            isInbox: item.isInbox ?? toWorkItemStatus(item.status) === "BACKLOG",
            priority: toWorkItemPriority(item.priority),
            startDate: parseDateValue(item.start) ?? undefined,
            dueDate: parseDateValue(item.due) ?? undefined,
            createdById: actorUserId,
            assigneeId: item.assignee && memberUserIds.has(item.assignee) ? item.assignee : undefined,
          },
        })
        createdWorkItems += 1
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

      for (const view of savedViews) {
        const projectId = view.project ? projectMap.get(view.project) : null
        const duplicate = await tx.savedView.findFirst({
          where: { workspaceId, createdById: actorUserId, name: view.name },
          select: { id: true },
        })
        if (duplicate) {
          skippedSavedViews += 1
          continue
        }
        if (view.isDefault) {
          await tx.savedView.updateMany({
            where: { workspaceId, createdById: actorUserId, isDefault: true },
            data: { isDefault: false },
          })
        }
        await tx.savedView.create({
          data: {
            workspaceId,
            projectId: projectId ?? undefined,
            createdById: actorUserId,
            name: view.name,
            layout: view.layout,
            groupBy: view.groupBy,
            orderBy: view.orderBy,
            filters: view.filters as Prisma.InputJsonValue | undefined,
            display: view.display as Prisma.InputJsonValue | undefined,
            isDefault: view.isDefault,
          },
        })
        createdSavedViews += 1
      }

      const result = {
        workspaceId,
        mode,
        imported: {
          projects: createdProjects,
          workItems: createdWorkItems,
          notes: createdNotes,
          projectDocs: createdProjectDocs,
          savedViews: createdSavedViews,
        },
        skipped: {
          workItems: skippedWorkItems,
          notes: skippedNotes,
          projectDocs: skippedProjectDocs,
          savedViews: skippedSavedViews,
        },
        warnings: {
          projectDocsMissingProjects: unlinkedProjectDocs,
        },
      }

      await logActivityEvent(tx, {
        workspaceId,
        actorId: actorUserId,
        action: "UPDATED",
        entityType: "WORKSPACE",
        entityId: workspaceId,
        summary: "Appended imported workspace data",
        metadata: {
          operation: "IMPORT_APPEND",
          imported: result.imported,
          skipped: result.skipped,
          warnings: result.warnings,
        },
      })

      return result
      }, { maxWait: 2_000, timeout: 15_000 })

      return NextResponse.json(summary, { status: 201 })
    } finally {
      releaseImport()
    }
  } catch (error) {
    return serverError("Failed to import local workspace data", String(error))
  }
}
