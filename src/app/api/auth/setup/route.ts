import { NextResponse } from "next/server"

import { getProviderCapabilities } from "@/lib/auth-provider-capabilities"
import { errors, methodNotAllowed, setupError, setupHeaders } from "@/lib/self-host-setup/response"
import { resolveSetupEligibility } from "@/lib/self-host-setup/service"
import { authorizeSetupToken, canonicalOrigin, cookieOptions, createCsrfToken, CSRF_COOKIE, CSRF_PATH, validateSetupRequest } from "@/lib/self-host-setup/security"

export async function GET(request: Request) {
  if (!getProviderCapabilities().localCredentials) return setupError(errors.notAvailable)
  if (!canonicalOrigin()) return setupError(errors.temporary)
  if (!validateSetupRequest(request, false)) return setupError(errors.forbidden)
  if (Number(request.headers.get("content-length") ?? 0) > 0) return setupError(errors.invalid)
  const usableConfig = authorizeSetupToken(process.env.PLANGLADE_SETUP_TOKEN, process.env.PLANGLADE_SETUP_TOKEN) && Boolean(process.env.NEXTAUTH_SECRET)
  try {
    const status = await resolveSetupEligibility()
    const available = status === "eligible" && usableConfig
    const response = NextResponse.json({ status: available ? "available" : "unavailable" }, { headers: setupHeaders })
    const secret = process.env.NEXTAUTH_SECRET
    if (available && secret) {
      response.cookies.set(CSRF_COOKIE, createCsrfToken("claim", secret), cookieOptions(CSRF_PATH, false))
    }
    return response
  } catch {
    return setupError(errors.temporary)
  }
}

export const POST = () => methodNotAllowed("GET")
export const PUT = POST
export const PATCH = POST
export const DELETE = POST
export const HEAD = POST
