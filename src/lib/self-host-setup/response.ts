import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

export const errors = {
  invalid: [400, "INVALID_REQUEST", "The setup request is invalid."],
  auth: [401, "SETUP_AUTHORIZATION_FAILED", "Setup authorization failed."],
  forbidden: [403, "REQUEST_NOT_ALLOWED", "The setup request is not allowed."],
  notAvailable: [404, "SETUP_NOT_AVAILABLE", "Setup is not available."],
  unavailable: [409, "SETUP_UNAVAILABLE", "Setup is not available."],
  conflict: [409, "SETUP_CONFLICT", "Setup could not be completed."],
  expired: [410, "SETUP_CLAIM_EXPIRED", "The setup claim has expired."],
  failed: [500, "SETUP_FAILED", "Setup could not be completed."],
  temporary: [503, "SETUP_TEMPORARILY_UNAVAILABLE", "Setup is temporarily unavailable."],
} as const

export const setupHeaders = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  Vary: "Cookie, Origin",
}

export function setupError(error: readonly [number, string, string]) {
  return NextResponse.json(
    { error: { code: error[1], message: error[2] }, requestId: randomUUID() },
    { status: error[0], headers: setupHeaders },
  )
}

export function methodNotAllowed(allow: string) {
  return NextResponse.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "The setup request method is not allowed." }, requestId: randomUUID() },
    { status: 405, headers: { ...setupHeaders, Allow: allow } },
  )
}
