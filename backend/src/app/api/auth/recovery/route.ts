import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"

import { parseJsonBody } from "@/lib/api-utils"
import { getProviderCapabilities } from "@/lib/auth-provider-capabilities"
import { recoverLocalAccountSchema } from "@/lib/contracts"
import { normalizeEmail } from "@/lib/local-auth-email"
import { recoverLocalAccount } from "@/lib/local-auth-recovery"
import { claimRecoveryVerification, clearRecoveryAccountThrottle } from "@/lib/local-auth-throttle"

const headers = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  Vary: "Origin",
}

function response(status: number, code: string, message: string) {
  return NextResponse.json(
    { error: { code, message }, requestId: randomUUID() },
    { status, headers },
  )
}

export async function POST(request: Request) {
  if (!getProviderCapabilities().localCredentials) {
    return response(404, "RECOVERY_NOT_AVAILABLE", "Local account recovery is not available.")
  }

  const parsed = await parseJsonBody(request, recoverLocalAccountSchema, {
    maxBytes: 4096,
    maxDepth: 2,
    maxNodes: 10,
  })
  if (!parsed.ok) return response(400, "INVALID_REQUEST", "The recovery request is invalid.")

  const normalizedEmail = normalizeEmail(parsed.data.email)
  if (!await claimRecoveryVerification(normalizedEmail)) {
    return response(429, "RECOVERY_RATE_LIMITED", "Too many recovery attempts. Wait 30 minutes and try again.")
  }

  const result = await recoverLocalAccount(parsed.data)
  if (!result.ok) {
    return result.reason === "temporary"
      ? response(503, "RECOVERY_TEMPORARILY_UNAVAILABLE", "Account recovery is temporarily unavailable.")
      : response(400, "RECOVERY_FAILED", "The email or recovery code is incorrect, expired, or already used.")
  }

  await clearRecoveryAccountThrottle(result.normalizedEmail).catch(() => undefined)
  return NextResponse.json({ status: "complete" }, { status: 200, headers })
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: { code: "METHOD_NOT_ALLOWED", message: "The recovery request method is not allowed." }, requestId: randomUUID() },
    { status: 405, headers: { ...headers, Allow: "POST" } },
  )
}

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const DELETE = methodNotAllowed
export const HEAD = methodNotAllowed
