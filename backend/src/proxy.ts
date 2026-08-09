import { NextResponse, type NextRequest } from "next/server"

const DEMO_HEADER = "x-planglade-demo-mode"
const DEMO_MODE_MESSAGE = "Demo mode - changes are disabled."
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  if (!pathname.startsWith("/api")) return new NextResponse(null, { status: 404 })
  if (pathname.startsWith("/api") && !SAFE_METHODS.has(request.method.toUpperCase()) && request.headers.get(DEMO_HEADER)?.toLowerCase() === "true") {
    return NextResponse.json({ error: DEMO_MODE_MESSAGE }, { status: 403 })
  }
}

export const config = { matcher: ["/:path*"] }
