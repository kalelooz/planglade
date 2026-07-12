import { NextResponse } from "next/server"

import { getProviderCapabilities } from "@/lib/auth-provider-capabilities"
import { errors, methodNotAllowed, setupError, setupHeaders } from "@/lib/self-host-setup/response"
import { resolveSetupEligibility } from "@/lib/self-host-setup/service"
import { authorizeSetupToken, canonicalOrigin, cookieOptions, createCsrfToken, CSRF_COOKIE, CSRF_PATH, validateSetupRequest } from "@/lib/self-host-setup/security"

export async function getSetupDiscovery(
  request: Request,
  resolve: typeof resolveSetupEligibility = resolveSetupEligibility,
) {
  if (!canonicalOrigin()) return NextResponse.json({ status: "unavailable" }, { headers: setupHeaders })
  if (!validateSetupRequest(request, false)) return setupError(errors.forbidden)
  if (Number(request.headers.get("content-length") ?? 0) > 0) return setupError(errors.invalid)
  if (!getProviderCapabilities().localCredentials) {
    return NextResponse.json({ status: "unavailable" }, { headers: setupHeaders })
  }
  const usableConfig = authorizeSetupToken(process.env.PLANGLADE_SETUP_TOKEN, process.env.PLANGLADE_SETUP_TOKEN) && Boolean(process.env.NEXTAUTH_SECRET)
  try {
    const status = await resolve()
    const available = status === "eligible" && usableConfig
    const response = NextResponse.json({ status: available ? "available" : "unavailable" }, { headers: setupHeaders })
    const secret = process.env.NEXTAUTH_SECRET
    if (available && secret) {
      response.cookies.set(CSRF_COOKIE, createCsrfToken("claim", secret), cookieOptions(CSRF_PATH, false))
    }
    return response
  } catch {
    return NextResponse.json({ status: "unavailable" }, { headers: setupHeaders })
  }
}

export function GET(request: Request) {
  return getSetupDiscovery(request)
}

export const POST = () => methodNotAllowed("GET")
export const PUT = POST
export const PATCH = POST
export const DELETE = POST
export const HEAD = POST
