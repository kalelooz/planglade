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
      workspaceMembers: "/api/workspace/members",
      authSession: "/api/auth/session",
      search: "/api/search",
      attachments: "/api/attachments",
      attachmentUploadUrl: "/api/attachments/upload-url",
      attachmentUploadBinary: "/api/attachments/upload-binary (local provider only)",
      attachmentDownloadUrl: "/api/attachments/:attachmentId/download-url",
      attachmentDownloadBinary: "/api/attachments/download-binary (local provider only)",
      workItemRelations: "/api/work-item-relations",
    },
  })
}
