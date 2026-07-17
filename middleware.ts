import { NextResponse, type NextRequest } from "next/server"

import { DEMO_MODE_MESSAGE } from "@/lib/demo-data"
import { getProviderCapabilityResult } from "@/lib/auth-provider-capabilities"

const DEMO_READ_ONLY_HEADER = "x-planglade-demo-read-only"
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

function isDemoReadOnlyDeployment() {
  return (
    process.env.PLANGLADE_DEMO_READ_ONLY ??
    process.env.FLOWBOARD_DEMO_READ_ONLY ??
    process.env.PLANGLADE_BUILD_DEMO_READ_ONLY
  )?.trim().toLowerCase() === "true"
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
    isDemoReadOnlyDeployment()
  ) {
    return NextResponse.json(
      { error: DEMO_MODE_MESSAGE },
      { status: 403, headers: { [DEMO_READ_ONLY_HEADER]: "true" } },
    )
  }

  return undefined
}

export const config = {
  matcher: ["/api/:path*", "/app/:path*", "/demo", "/demo/:path*"],
}
