import { NextRequest, NextResponse } from "next/server"

import { workspaceBootstrapQuerySchema } from "@/lib/contracts"
import { getWorkspaceBootstrap } from "@/lib/workspace-bootstrap"

export async function GET(request: NextRequest) {
  const parsed = workspaceBootstrapQuerySchema.safeParse({
    workspaceSlug: request.nextUrl.searchParams.get("workspaceSlug") ?? undefined,
  })

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid workspace bootstrap query",
        details: parsed.error.flatten(),
      },
      { status: 400 }
    )
  }

  const payload = getWorkspaceBootstrap(parsed.data.workspaceSlug)
  return NextResponse.json(payload)
}
