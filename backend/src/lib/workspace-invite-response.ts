import { NextResponse } from "next/server"

export const SENSITIVE_INVITE_RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
} as const

export function workspaceInviteRateLimitResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: "Too many invitation emails. Wait before trying again.",
      code: "INVITATION_RATE_LIMITED",
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  )
}
