import { Prisma } from "@prisma/client"
import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  forbidden,
  parseJsonBody,
  parseQuery,
  requireWorkspaceRole,
  serverError,
} from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { createWorkItemRelationSchema, workItemRelationListQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { normalizeProjectFeatureFlags } from "@/lib/project-flags"

async function ensureRelationsEnabled(workspaceId: string, projectIds: Array<string | null | undefined>) {
  const uniqueProjectIds = Array.from(
    new Set(projectIds.filter((projectId): projectId is string => typeof projectId === "string" && projectId.length > 0))
  )
  if (uniqueProjectIds.length === 0) return null

  const projects = await db.project.findMany({
    where: { id: { in: uniqueProjectIds } },
    select: { id: true, workspaceId: true, featureFlags: true },
  })
  if (projects.length !== uniqueProjectIds.length) {
    return badRequest("One or more related projects were not found")
  }
  if (projects.some((project) => project.workspaceId !== workspaceId)) {
    return badRequest("One or more related projects are outside this workspace")
  }

  const blocked = projects.find((project) => !normalizeProjectFeatureFlags(project.featureFlags).relations)
  if (blocked) {
    return forbidden("Work-item relations are disabled for one or more related projects")
  }
  return null
}

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      sourceId: request.nextUrl.searchParams.get("sourceId") ?? undefined,
      targetId: request.nextUrl.searchParams.get("targetId") ?? undefined,
      relationType: request.nextUrl.searchParams.get("relationType") ?? undefined,
    },
    workItemRelationListQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response

    const relations = await db.workItemRelation.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        ...(query.data.sourceId ? { sourceId: query.data.sourceId } : {}),
        ...(query.data.targetId ? { targetId: query.data.targetId } : {}),
        ...(query.data.relationType ? { relationType: query.data.relationType } : {}),
      },
      include: {
        source: { select: { id: true, title: true, projectId: true } },
        target: { select: { id: true, title: true, projectId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    })

    return NextResponse.json({ relations })
  } catch (error) {
    return serverError("Failed to load work-item relations", String(error))
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createWorkItemRelationSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    if (parsed.data.sourceId === parsed.data.targetId) {
      return badRequest("Source and target work items must be different")
    }

    const [source, target] = await Promise.all([
      db.workItem.findUnique({
        where: { id: parsed.data.sourceId },
        select: { id: true, workspaceId: true, title: true, projectId: true },
      }),
      db.workItem.findUnique({
        where: { id: parsed.data.targetId },
        select: { id: true, workspaceId: true, title: true, projectId: true },
      }),
    ])
    if (!source || source.workspaceId !== parsed.data.workspaceId) {
      return badRequest("Source work item not found in workspace")
    }
    if (!target || target.workspaceId !== parsed.data.workspaceId) {
      return badRequest("Target work item not found in workspace")
    }

    const flagError = await ensureRelationsEnabled(parsed.data.workspaceId, [source.projectId, target.projectId])
    if (flagError) return flagError

    const relation = await db.$transaction(async (tx) => {
      const createdRelation = await tx.workItemRelation.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          sourceId: parsed.data.sourceId,
          targetId: parsed.data.targetId,
          relationType: parsed.data.relationType,
        },
        include: {
          source: { select: { id: true, title: true, projectId: true } },
          target: { select: { id: true, title: true, projectId: true } },
        },
      })

      await logActivityEvent(tx, {
        workspaceId: parsed.data.workspaceId,
        actorId: actorUserId,
        action: "UPDATED",
        entityType: "WORK_ITEM",
        entityId: source.id,
        summary: `Linked "${source.title}" ${parsed.data.relationType} "${target.title}"`,
        metadata: {
          relationId: createdRelation.id,
          relationType: createdRelation.relationType,
          sourceId: source.id,
          targetId: target.id,
        },
      })

      return createdRelation
    })

    return NextResponse.json({ relation }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return badRequest("This work-item relation already exists")
    }
    return serverError("Failed to create work-item relation", String(error))
  }
}
