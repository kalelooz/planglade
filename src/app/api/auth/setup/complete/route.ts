import { NextResponse } from "next/server"

import { parseSetupCompletionRequest } from "@/lib/self-host-setup/contract"
import { errors, methodNotAllowed, setupError, setupHeaders } from "@/lib/self-host-setup/response"
import { getProviderCapabilities } from "@/lib/auth-provider-capabilities"
import { completeSetup } from "@/lib/self-host-setup/service"
import { canonicalOrigin, CLAIM_COOKIE, CLAIM_PATH, cookieOptions, CSRF_COOKIE, CSRF_PATH, readCookie, sha256Base64url, validateCsrfToken, validateSetupRequest } from "@/lib/self-host-setup/security"

function clearSetupCookies(response: NextResponse) {
  response.cookies.set(CLAIM_COOKIE, "", cookieOptions(CLAIM_PATH, true, true))
  response.cookies.set(CSRF_COOKIE, "", cookieOptions(CSRF_PATH, false, true))
  return response
}

export async function POST(request: Request) {
  if (!getProviderCapabilities().localCredentials) return setupError(errors.notAvailable)
  const parsed = await parseSetupCompletionRequest(request)
  if (!parsed.ok) return setupError([parsed.error.status, parsed.error.code, parsed.error.message])
  if (!canonicalOrigin()) return setupError(errors.temporary)
  if (!validateSetupRequest(request, true)) return setupError(errors.forbidden)
  const claimant = readCookie(request, CLAIM_COOKIE)
  const csrf = readCookie(request, CSRF_COOKIE)
  if (!claimant || !validateCsrfToken(csrf, request.headers.get("x-planglade-csrf"), "complete", claimant, sha256Base64url(claimant))) {
    return clearSetupCookies(setupError(errors.auth))
  }
  const result = await completeSetup(parsed.data, claimant)
  if (result.ok) {
    return clearSetupCookies(NextResponse.json({ status: "complete", recoveryCodes: result.recoveryCodes }, { status: 201, headers: setupHeaders }))
  }
  const error = result.reason === "expired" ? errors.expired : result.reason === "invalid" ? errors.auth : result.reason === "temporary" ? errors.temporary : result.reason === "conflict" ? errors.conflict : errors.unavailable
  return clearSetupCookies(setupError(error))
}

export const GET = () => methodNotAllowed("POST")
export const PUT = GET
export const PATCH = GET
export const DELETE = GET
export const HEAD = GET
