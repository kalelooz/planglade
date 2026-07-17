import { NextResponse } from "next/server"

import { consumeRecoveryThrottle, tooManyRequests } from "@/lib/auth-throttle"
import { getProviderCapabilities } from "@/lib/auth-provider-capabilities"
import {
  recoverLocalCredential,
  recoveryThrottleSubject,
} from "@/lib/local-auth-recovery"
import { parseLocalCredentialRecoveryRequest } from "@/lib/self-host-setup/contract"

const headers = { "Cache-Control": "no-store" }
const invalid = () => NextResponse.json(
  { error: "Recovery request is invalid or expired." },
  { status: 400, headers },
)
const temporary = () => NextResponse.json(
  { error: "Recovery is temporarily unavailable." },
  { status: 503, headers },
)

export async function POST(request: Request) {
  if (!getProviderCapabilities().localCredentials) return invalid()
  const parsed = await parseLocalCredentialRecoveryRequest(request)
  if (!parsed.ok) return invalid()

  try {
    const throttle = await consumeRecoveryThrottle(
      "reset",
      recoveryThrottleSubject(parsed.data.secret),
    )
    if (!throttle.allowed) return tooManyRequests(throttle)
    const result = await recoverLocalCredential(parsed.data.secret, parsed.data.password)
    if (!result.ok) return result.reason === "temporary" ? temporary() : invalid()
    return NextResponse.json(
      {
        status: "complete",
        reauthenticationRequired: true,
        recoveryCodes: result.recoveryCodes,
      },
      { status: 201, headers },
    )
  } catch {
    return temporary()
  }
}
