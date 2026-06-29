import { NextRequest, NextResponse } from "next/server"

import { db } from "@/lib/db"

function isAuthorizedMaintenanceRequest(request: NextRequest) {
  const configured = process.env.FLOWBOARD_MAINTENANCE_TOKEN
  if (!configured) return false

  const authHeader = request.headers.get("authorization")
  const tokenFromBearer = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : null
  const tokenFromCustomHeader = request.headers.get("x-flowboard-maintenance-token")

  const provided = tokenFromBearer ?? tokenFromCustomHeader ?? ""
  return provided.length > 0 && provided === configured
}

export async function POST(request: NextRequest) {
  if (!isAuthorizedMaintenanceRequest(request)) {
    return NextResponse.json({ error: "Unauthorized maintenance token" }, { status: 401 })
  }

  try {
    const now = new Date()
    const workspaceId = request.nextUrl.searchParams.get("workspaceId") ?? undefined

    const result = await db.workspaceInvite.updateMany({
      where: {
        status: "PENDING",
        expiresAt: { lte: now },
        ...(workspaceId ? { workspaceId } : {}),
      },
      data: {
        status: "EXPIRED",
      },
    })

    return NextResponse.json({
      ok: true,
      workspaceId: workspaceId ?? null,
      expiredCount: result.count,
      executedAt: now.toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to expire stale invites", details: String(error) },
      { status: 500 }
    )
  }
}
