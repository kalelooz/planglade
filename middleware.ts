import { NextResponse, type NextRequest } from "next/server"

import { DEMO_MODE_MESSAGE } from "@/lib/demo-data"

const DEMO_HEADER = "x-planglade-demo-mode"
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/api") &&
    !SAFE_METHODS.has(request.method.toUpperCase()) &&
    request.headers.get(DEMO_HEADER)?.toLowerCase() === "true"
  ) {
    return NextResponse.json({ error: DEMO_MODE_MESSAGE }, { status: 403 })
  }

  return undefined
}

export const config = {
  matcher: "/api/:path*",
}
