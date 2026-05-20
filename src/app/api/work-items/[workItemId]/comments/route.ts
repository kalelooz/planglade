import { NextRequest, NextResponse } from "next/server"

import { badRequest, parseJsonBody, requireWorkspaceRole, serverError } from "@/lib/api-utils"
import { logActivityEvent } from "@/lib/activity"
import { createCommentSchema, workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { extractMentionUserIds } from "@/lib/mentions"

type Params = { params: Promise<{ workItemId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  const { workItemId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response

    const workItem = await db.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, workspaceId: true },
    })
    if (!workItem || workItem.workspaceId !== query.data.workspaceId) {
      return NextResponse.json({ comments: [] })
    }

    const comments = await db.comment.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        workItemId,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({
      comments: comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
        author: comment.author,
      })),
    })
  } catch (error) {
    return serverError("Failed to load comments", String(error))
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  const { workItemId } = await params
  const query = workspaceQuerySchema.safeParse({
    workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
  })
  if (!query.success) return badRequest("workspaceId query is required", query.error.flatten())

  const parsed = await parseJsonBody(request, createCommentSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      request.headers.get("x-flowboard-user-id") ?? undefined,
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const workItem = await db.workItem.findUnique({
      where: { id: workItemId },
      select: { id: true, workspaceId: true, title: true },
    })
    if (!workItem || workItem.workspaceId !== query.data.workspaceId) {
      return badRequest("Work item not found in workspace")
    }

    const members = await db.workspaceMember.findMany({
      where: { workspaceId: query.data.workspaceId },
      select: {
        userId: true,
        user: { select: { name: true, email: true } },
      },
    })
    const mentionUserIds = extractMentionUserIds(parsed.data.body, members).filter((userId) => userId !== actorUserId)

    const created = await db.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: {
          workspaceId: query.data.workspaceId,
          workItemId,
          authorId: actorUserId,
          body: parsed.data.body,
        },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      })

      await logActivityEvent(tx, {
        workspaceId: query.data.workspaceId,
        actorId: actorUserId,
        action: "COMMENTED",
        entityType: "WORK_ITEM",
        entityId: workItemId,
        summary: `Commented on work item "${workItem.title}"`,
        metadata: {
          commentId: comment.id,
          preview:
            parsed.data.body.length > 160
              ? `${parsed.data.body.slice(0, 160)}...`
              : parsed.data.body,
          mentionUserIds,
        },
      })

      return comment
    })

    return NextResponse.json(
      {
        comment: {
          id: created.id,
          body: created.body,
          createdAt: created.createdAt,
          updatedAt: created.updatedAt,
          author: created.author,
          mentionUserIds,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    return serverError("Failed to create comment", String(error))
  }
}
