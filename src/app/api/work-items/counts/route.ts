import { NextRequest, NextResponse } from "next/server"

import {
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { workspaceQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"

/**
 * GET /api/work-items/counts?workspaceId=...&projectId=...
 *
 * Returns aggregated counts for the App Shell sidebar:
 *   - inboxCount: work items with status BACKLOG
 *   - todayCount: open items due today
 *   - myTasksCount: open items assigned to the requesting user
 */
export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
    },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  const projectId = request.nextUrl.searchParams.get("projectId") ?? undefined

  try {
    const actorUserId = await resolveRequestActorUserId(request)
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      actorUserId,
      "VIEWER"
    )
    if (!access.ok) return access.response

    const workspaceFilter = {
      workspaceId: query.data.workspaceId,
      ...(projectId ? { projectId } : {}),
    }

    const [inboxCount, todayCount, myTasksCount] = await Promise.all([
      // Inbox: all BACKLOG items in this workspace (ignoring project scope)
      db.workItem.count({
        where: {
          workspaceId: query.data.workspaceId,
          status: "BACKLOG",
        },
      }),

      // Today: open items due today only. Undated tasks live in Home's Next up section.
      (async () => {
        const now = new Date()
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        const todayEnd = new Date(todayStart.getTime() + 86_400_000)

        return db.workItem.count({
          where: {
            ...workspaceFilter,
            status: { not: "DONE" },
            dueDate: { gte: todayStart, lt: todayEnd },
          },
        })
      })(),

      // Mine: open items assigned to the current user
      db.workItem.count({
        where: {
          ...workspaceFilter,
          status: { not: "DONE" },
          assigneeId: access.actor.userId,
        },
      }),
    ])

    return NextResponse.json({ inboxCount, todayCount, myTasksCount })
  } catch (error) {
    return serverError("Failed to load work item counts", String(error))
  }
}
