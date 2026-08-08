import { NextRequest, NextResponse } from "next/server"

import { notFound, parseJsonBody, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { createProjectDocSchema, projectDocListQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { projectBelongsToWorkspace } from "@/lib/project-docs"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      projectId: request.nextUrl.searchParams.get("projectId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
    },
    projectDocListQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "VIEWER"
    )
    if (!access.ok) return access.response

    if (
      query.data.projectId &&
      !(await projectBelongsToWorkspace(query.data.projectId, query.data.workspaceId))
    ) {
      return notFound("Project not found in workspace")
    }

    const docs = await db.projectDoc.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        status: query.data.status,
        ...(query.data.projectId ? { projectId: query.data.projectId } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
    })

    return NextResponse.json({ docs })
  } catch (error) {
    return serverError("Failed to load project docs", String(error))
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createProjectDocSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    if (
      parsed.data.projectId &&
      !(await projectBelongsToWorkspace(parsed.data.projectId, parsed.data.workspaceId))
    ) {
      return notFound("Project not found in workspace")
    }

    const doc = await db.$transaction(async (tx) => {
      const createdDoc = await tx.projectDoc.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          projectId: parsed.data.projectId,
          title: parsed.data.title,
          body: parsed.data.body,
          createdById: actorUserId,
          updatedById: actorUserId,
        },
      })

      await logActivityEvent(tx, {
        workspaceId: parsed.data.workspaceId,
        actorId: actorUserId,
        action: "CREATED",
        entityType: "PROJECT_DOC",
        entityId: createdDoc.id,
        summary: `Created project doc "${createdDoc.title}"`,
        metadata: {
          status: createdDoc.status,
          ...(createdDoc.projectId ? { projectId: createdDoc.projectId } : {}),
        },
      })

      return createdDoc
    })

    return NextResponse.json({ doc }, { status: 201 })
  } catch (error) {
    return serverError("Failed to create project doc", String(error))
  }
}
