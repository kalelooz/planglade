import { NextRequest, NextResponse } from "next/server"

import { parseDateValue, parseJsonBody, parseQuery, requireWorkspaceRole, resolveRequestActorUserId, serverError } from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { createProjectSchema, projectListQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { toProjectFeatureFlagsJson } from "@/lib/project-flags"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
    },
    projectListQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "VIEWER"
    )
    if (!access.ok) return access.response

    const projects = await db.project.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        ...(query.data.status ? { status: query.data.status } : {}),
      },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json({ projects })
  } catch (error) {
    return serverError("Failed to load projects", String(error))
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createProjectSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const project = await db.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          workspaceId: parsed.data.workspaceId,
          name: parsed.data.name,
          slug: parsed.data.slug,
          description: parsed.data.description,
          status: parsed.data.status,
          mode: parsed.data.mode,
          featureFlags:
            parsed.data.featureFlags !== undefined
              ? toProjectFeatureFlagsJson(parsed.data.featureFlags, { mode: parsed.data.mode })
              : undefined,
          color: parsed.data.color,
          startDate: parseDateValue(parsed.data.startDate) ?? undefined,
          dueDate: parseDateValue(parsed.data.dueDate) ?? undefined,
          createdById: actorUserId,
        },
      })

      await logActivityEvent(tx, {
        workspaceId: parsed.data.workspaceId,
        actorId: actorUserId,
        action: "CREATED",
        entityType: "PROJECT",
        entityId: createdProject.id,
        summary: `Created project "${createdProject.name}"`,
        metadata: {
          status: createdProject.status,
          slug: createdProject.slug,
          mode: createdProject.mode,
        },
      })

      return createdProject
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    return serverError("Failed to create project", String(error))
  }
}
