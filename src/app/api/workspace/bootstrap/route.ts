import { NextResponse } from "next/server"

import { getWorkspaceBootstrap } from "@/lib/workspace-bootstrap"

export function GET() {
  return NextResponse.json(getWorkspaceBootstrap())
}
