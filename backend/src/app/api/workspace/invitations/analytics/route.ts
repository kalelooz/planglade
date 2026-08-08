import { NextRequest, NextResponse } from "next/server"

import {
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { workspaceInviteAnalyticsQuerySchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { resolveInviteStatus } from "@/lib/workspace-invite-utils"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      days: request.nextUrl.searchParams.get("days") ?? undefined,
    },
    workspaceInviteAnalyticsQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response

    const now = new Date()
    const start = new Date(now)
    start.setDate(now.getDate() - query.data.days + 1)
    start.setHours(0, 0, 0, 0)

    const invites = await db.workspaceInvite.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        createdAt: { gte: start },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        expiresAt: true,
        createdAt: true,
      },
    })

    const totals = {
      sent: invites.length,
      pending: 0,
      accepted: 0,
      revoked: 0,
      expired: 0,
    }

    const byRole = new Map<string, number>()
    const byDomain = new Map<string, number>()
    const byDay = new Map<string, { sent: number; accepted: number }>()

    for (const invite of invites) {
      const resolvedStatus = resolveInviteStatus(invite, now)
      if (resolvedStatus === "PENDING") totals.pending += 1
      if (resolvedStatus === "ACCEPTED") totals.accepted += 1
      if (resolvedStatus === "REVOKED") totals.revoked += 1
      if (resolvedStatus === "EXPIRED") totals.expired += 1

      byRole.set(invite.role, (byRole.get(invite.role) ?? 0) + 1)
      const domain = invite.email.includes("@")
        ? invite.email.split("@").pop()!.toLowerCase()
        : "unknown"
      byDomain.set(domain, (byDomain.get(domain) ?? 0) + 1)

      const dayKey = invite.createdAt.toISOString().slice(0, 10)
      const current = byDay.get(dayKey) ?? { sent: 0, accepted: 0 }
      current.sent += 1
      if (resolvedStatus === "ACCEPTED") current.accepted += 1
      byDay.set(dayKey, current)
    }

    const acceptanceRate = totals.sent > 0 ? Number((totals.accepted / totals.sent).toFixed(4)) : 0
    const expiryRate = totals.sent > 0 ? Number((totals.expired / totals.sent).toFixed(4)) : 0

    return NextResponse.json({
      windowDays: query.data.days,
      totals,
      acceptanceRate,
      expiryRate,
      byRole: [...byRole.entries()].map(([role, count]) => ({ role, count })),
      topDomains: [...byDomain.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([domain, count]) => ({ domain, count })),
      trend: [...byDay.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, values]) => ({
          date,
          sent: values.sent,
          accepted: values.accepted,
        })),
    })
  } catch (error) {
    return serverError("Failed to compute workspace invite analytics", String(error))
  }
}
