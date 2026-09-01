import { NextRequest, NextResponse } from "next/server"

import { reapExpiredAttachmentUploads } from "@/lib/attachment-reaper"
import { readPlanGladeEnv } from "@/lib/env-config"

function isAuthorized(request: NextRequest) {
  const configured = readPlanGladeEnv("MAINTENANCE_TOKEN")
  const authorization = request.headers.get("authorization")
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : null
  const provided = bearer ?? request.headers.get("x-planglade-maintenance-token") ?? ""
  return Boolean(configured && provided && provided === configured)
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized maintenance token" }, { status: 401 })
  }
  try {
    const result = await reapExpiredAttachmentUploads()
    return NextResponse.json({ ok: true, ...result, executedAt: new Date().toISOString() })
  } catch (error) {
    console.error("Failed to reap expired attachment uploads", error)
    return NextResponse.json({ error: "Failed to reap expired attachment uploads" }, { status: 500 })
  }
}
