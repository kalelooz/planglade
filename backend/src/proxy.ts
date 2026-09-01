import { NextResponse, type NextRequest } from "next/server"

import { evaluateCanonicalPublicUrl } from "@/lib/production-config.mjs"

const DEMO_HEADER = "x-planglade-demo-mode"
const DEMO_MODE_MESSAGE = "Demo mode - changes are disabled."
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function unsafeRequestIsCrossOrigin(request: NextRequest) {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase()
  if (fetchSite === "cross-site") return true

  const origin = request.headers.get("origin")
  if (origin) {
    const canonical = evaluateCanonicalPublicUrl(process.env.NEXTAUTH_URL)
    const trustedOrigin = canonical.origin ?? (process.env.NODE_ENV === "production" ? null : request.nextUrl.origin)
    return !trustedOrigin || origin !== trustedOrigin
  }

  return fetchSite === "same-site"
}

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isApiPath = pathname === "/api" || pathname.startsWith("/api/")
  if (!isApiPath) return new NextResponse(null, { status: 404 })
  if (!SAFE_METHODS.has(request.method.toUpperCase()) && request.headers.get(DEMO_HEADER)?.toLowerCase() === "true") {
    return NextResponse.json({ error: DEMO_MODE_MESSAGE }, { status: 403 })
  }
  if (!SAFE_METHODS.has(request.method.toUpperCase()) && unsafeRequestIsCrossOrigin(request)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 })
  }
}

export const config = { matcher: ["/:path*"] }
