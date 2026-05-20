import { NextRequest, NextResponse } from "next/server"

import { badRequest, parseDateValue, parseJsonBody, parseQuery, resolveActorUserId, serverError } from "@/lib/api-utils"
import { createProjectSchema, projectListQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

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
    const actorUserId = await resolveActorUserId(
      parsed.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined
    )
    if (!actorUserId) return badRequest("Workspace not found")

    const project = await db.project.create({
      data: {
        workspaceId: parsed.data.workspaceId,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description,
        status: parsed.data.status,
        color: parsed.data.color,
        startDate: parseDateValue(parsed.data.startDate) ?? undefined,
        dueDate: parseDateValue(parsed.data.dueDate) ?? undefined,
        createdById: actorUserId,
      },
    })

    return NextResponse.json({ project }, { status: 201 })
  } catch (error) {
    return serverError("Failed to create project", String(error))
  }
}
