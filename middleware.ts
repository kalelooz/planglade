import { NextResponse, type NextRequest } from "next/server"

import { DEMO_MODE_MESSAGE } from "@/lib/demo-data"
import { getProviderCapabilityResult } from "@/lib/auth-provider-capabilities"

const DEMO_HEADER = "x-planglade-demo-mode"
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"])

function readPlanGladeEnv(name: string) {
  return process.env[`PLANGLADE_${name}`] ?? process.env[`FLOWBOARD_${name}`]
}

function isPublicOnlyProductionApp() {
  return (
    process.env.NODE_ENV === "production" &&
    readPlanGladeEnv("AUTH_MODE")?.toLowerCase() === "nextauth" &&
    !getProviderCapabilityResult().capabilities.anyConfigured
  )
}

export function middleware(request: NextRequest) {
  if (
    request.nextUrl.pathname.startsWith("/app") &&
    isPublicOnlyProductionApp()
  ) {
    return NextResponse.redirect(new URL("/", request.url))
  }

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
  matcher: ["/api/:path*", "/app/:path*", "/demo", "/demo/:path*"],
}
