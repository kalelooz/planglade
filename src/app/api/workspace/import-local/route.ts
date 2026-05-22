import { NextRequest, NextResponse } from "next/server"

import { parseDateValue, parseJsonBody, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { importLocalWorkspaceSchema } from "@/lib/contracts"
import { db } from "@/lib/db"

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

  const { workspaceId, mode, projects, workItems, notes } = parsed.data

  try {
    const access = await requireWorkspaceRole(
      workspaceId,
      request.headers.get("x-flowboard-user-id") ?? parsed.data.actorUserId,
      "ADMIN"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const summary = await db.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.workItem.deleteMany({ where: { workspaceId } })
        await tx.note.deleteMany({ where: { workspaceId } })
        await tx.project.deleteMany({ where: { workspaceId } })
      }

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
            workspaceId,
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

      return {
        workspaceId,
        mode,
        imported: {
          projects: createdProjects,
          workItems: createdWorkItems,
          notes: createdNotes,
        },
        skipped: {
          workItems: skippedWorkItems,
          notes: skippedNotes,
        },
      }
    })

    return NextResponse.json(summary, { status: 201 })
  } catch (error) {
    return serverError("Failed to import local workspace data", String(error))
  }
}
