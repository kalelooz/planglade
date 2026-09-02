import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { parseJsonBody, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { IMPORT_LIMITS, importLocalWorkspaceSchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { buildNoteAccessWhere } from "@/lib/note-access"
import {
  claimWorkspaceImportOperation,
  completeWorkspaceImportOperation,
  releaseWorkspaceImportOperation,
  runSerializableWorkspaceImport,
} from "@/lib/workspace-import-operation"
import { buildWorkspaceImportPlan, remapImportedNoteIds } from "@/lib/workspace-import-plan"

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, importLocalWorkspaceSchema, {
    maxBytes: IMPORT_LIMITS.bodyBytes,
    maxNodes: 100_000,
  })
  if (!parsed.ok) return parsed.response

  const { workspaceId, mode, expectedSourceChecksum, snapshot } = parsed.data

  try {
    const access = await requireWorkspaceRole(
      workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId
    const reviewedPlan = buildWorkspaceImportPlan(snapshot)
    if (!reviewedPlan.contract.canExecute) {
      return NextResponse.json({ error: "This workspace export version cannot be imported" }, { status: 400 })
    }
    if (reviewedPlan.contract.sourceChecksum !== expectedSourceChecksum) {
      return NextResponse.json({ error: "Workspace export changed after preview" }, { status: 409 })
    }
    const operation = await claimWorkspaceImportOperation(db, {
      workspaceId,
      sourceChecksum: expectedSourceChecksum,
    })
    if (operation.status === "in_progress") {
      return NextResponse.json(
        { error: "Another import is already running for this workspace" },
        { status: 409 }
      )
    }
    if (operation.status === "replayed") {
      return NextResponse.json(operation.result, { status: 200 })
    }

    try {
      const summary = await runSerializableWorkspaceImport(db, async (tx) => {
      const existingProjects = await tx.project.findMany({
        where: { workspaceId },
        select: { slug: true },
      })
      const importPlan = buildWorkspaceImportPlan(
        snapshot,
        { projectSlugs: existingProjects.map((project) => project.slug) }
      )
      const projectMap = new Map<string, string>()
      const noteMap = new Map<string, string>()
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
      let createdSavedViews = 0
      let skippedSavedViews = 0

      for (const project of importPlan.projects) {
        const upserted = await tx.project.upsert({
          where: { workspaceId_slug: { workspaceId, slug: project.slug } },
          update: {
            name: project.name,
            status: project.status,
            mode: project.mode,
            featureFlags: project.featureFlags,
            dueDate: project.dueDate,
            color: project.color,
          },
          create: {
            workspaceId,
            name: project.name,
            slug: project.slug,
            status: project.status,
            mode: project.mode,
            featureFlags: project.featureFlags,
            dueDate: project.dueDate,
            color: project.color,
            createdById: actorUserId,
          },
        })
        projectMap.set(project.sourceId, upserted.id)
        createdProjects += 1
      }

      for (const note of importPlan.notes) {
        const duplicate = await tx.note.findFirst({
          where: {
            ...buildNoteAccessWhere(workspaceId, actorUserId),
            title: note.title,
          },
          select: { id: true },
        })
        if (duplicate) {
          noteMap.set(note.sourceId, duplicate.id)
          skippedNotes += 1
          continue
        }

        const createdNote = await tx.note.create({
          data: {
            workspaceId,
            title: note.title,
            body: note.body,
            visibility: note.visibility,
            pinned: false,
            tags: note.tags,
            createdById: actorUserId,
            updatedById: actorUserId,
          },
          select: { id: true },
        })
        noteMap.set(note.sourceId, createdNote.id)
        createdNotes += 1
      }

      for (const item of importPlan.workItems) {
        const projectId = item.sourceProjectId ? projectMap.get(item.sourceProjectId) : null
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
            noteIds: remapImportedNoteIds(item.noteIds, noteMap),
            status: item.status,
            isInbox: item.isInbox,
            priority: item.priority,
            startDate: item.startDate,
            dueDate: item.dueDate,
            createdById: actorUserId,
            assigneeId: item.assigneeId && memberUserIds.has(item.assigneeId) ? item.assigneeId : undefined,
          },
        })
        createdWorkItems += 1
      }

      for (const doc of importPlan.projectDocs) {
        const projectId = doc.sourceProjectId ? projectMap.get(doc.sourceProjectId) : null
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

        await tx.projectDoc.create({
          data: {
            workspaceId,
            projectId: projectId ?? undefined,
            title: doc.title,
            body: doc.body,
            status: doc.status,
            archivedAt: doc.status === "ARCHIVED" ? doc.archivedAt ?? new Date() : undefined,
            createdById: actorUserId,
            updatedById: actorUserId,
          },
        })
        createdProjectDocs += 1
      }

      for (const view of importPlan.savedViews) {
        const projectId = view.sourceProjectId ? projectMap.get(view.sourceProjectId) : null
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
          projectDocsMissingProjects: importPlan.relationIssues.projectDocsMissingProjects,
          tasksMissingNotes: importPlan.relationIssues.tasksMissingNotes,
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

      await completeWorkspaceImportOperation(tx, {
        workspaceId,
        claimId: operation.claimId,
        result: result as Prisma.InputJsonValue,
      })

      return result
      })

      return NextResponse.json(summary, { status: 201 })
    } catch (error) {
      await releaseWorkspaceImportOperation(db, {
        workspaceId,
        claimId: operation.claimId,
      }).catch(() => false)
      throw error
    }
  } catch (error) {
    return serverError("Failed to import local workspace data", String(error))
  }
}
