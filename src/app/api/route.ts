import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    service: "flowboard-api",
    status: "ok",
    version: "0.2.0",
    generatedAt: new Date().toISOString(),
    endpoints: {
      health: "/api/health",
      workspaceBootstrap: "/api/workspace/bootstrap",
    },
  })
}
