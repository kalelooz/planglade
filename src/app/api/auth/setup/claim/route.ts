import { NextResponse } from "next/server"

import { parseSetupClaimRequest } from "@/lib/self-host-setup/contract"
import { errors, methodNotAllowed, setupError, setupHeaders } from "@/lib/self-host-setup/response"
import { getProviderCapabilities } from "@/lib/auth-provider-capabilities"
import { claimSetup } from "@/lib/self-host-setup/service"
import { authorizeSetupToken, canonicalOrigin, CLAIM_COOKIE, CLAIM_PATH, cookieOptions, createCsrfToken, CSRF_COOKIE, CSRF_PATH, readCookie, sha256Base64url, validateCsrfToken, validateSetupRequest } from "@/lib/self-host-setup/security"

export async function POST(request: Request) {
  if (!getProviderCapabilities().localCredentials) return setupError(errors.notAvailable)
  const parsed = await parseSetupClaimRequest(request)
  if (!parsed.ok) return setupError([parsed.error.status, parsed.error.code, parsed.error.message])
  if (!canonicalOrigin()) return setupError(errors.temporary)
  if (!validateSetupRequest(request, true)) return setupError(errors.forbidden)
  const nextAuthSecret = process.env.NEXTAUTH_SECRET
  const csrf = readCookie(request, CSRF_COOKIE)
  if (!nextAuthSecret || !validateCsrfToken(csrf, request.headers.get("x-planglade-csrf"), "claim", nextAuthSecret)) {
    return setupError(errors.forbidden)
  }
  if (!authorizeSetupToken(parsed.data.setupToken, process.env.PLANGLADE_SETUP_TOKEN)) return setupError(errors.auth)
  const claim = await claimSetup()
  if (!claim.ok) return setupError(claim.reason === "temporary" ? errors.temporary : errors.unavailable)
  const response = NextResponse.json({ status: "claimed" }, { status: 201, headers: setupHeaders })
  response.cookies.set(CLAIM_COOKIE, claim.secret, cookieOptions(CLAIM_PATH, true))
  response.cookies.set(CSRF_COOKIE, createCsrfToken("complete", claim.secret, sha256Base64url(claim.secret)), cookieOptions(CSRF_PATH, false))
  return response
}

export const GET = () => methodNotAllowed("POST")
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
export const HEAD = GET
