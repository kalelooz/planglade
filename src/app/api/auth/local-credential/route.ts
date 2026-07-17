import { NextResponse } from "next/server"

import { resolveRequestActorUserId } from "@/lib/api-utils"
import { consumeRecoveryThrottle, tooManyRequests } from "@/lib/auth-throttle"
import { getProviderCapabilities } from "@/lib/auth-provider-capabilities"
import {
  enrollLocalCredential,
  getLocalCredentialEnrollmentStatus,
} from "@/lib/local-auth-recovery"
import { parseLocalCredentialEnrollmentRequest } from "@/lib/self-host-setup/contract"

const headers = { "Cache-Control": "no-store" }
const unauthorized = () => NextResponse.json({ error: "Authentication required." }, { status: 401, headers })
const forbidden = () => NextResponse.json({ error: "Owner access required." }, { status: 403, headers })
const unavailable = () => NextResponse.json({ status: "unavailable" }, { headers })
const temporary = () => NextResponse.json(
  { error: "Local credential enrollment is temporarily unavailable." },
  { status: 503, headers },
)

async function actorUserId(request: Request) {
  return resolveRequestActorUserId(request)
}

export async function GET(request: Request) {
  try {
    const userId = await actorUserId(request)
    if (!userId) return unauthorized()
    if (!getProviderCapabilities().localCredentials) return unavailable()
    const status = await getLocalCredentialEnrollmentStatus(userId)
    if (status === "owner-required") return forbidden()
    return NextResponse.json({ status }, { headers })
  } catch {
    return temporary()
  }
}

export async function POST(request: Request) {
  try {
    const userId = await actorUserId(request)
    if (!userId) return unauthorized()
    if (!getProviderCapabilities().localCredentials) return unavailable()
    const status = await getLocalCredentialEnrollmentStatus(userId)
    if (status === "owner-required") return forbidden()
    if (status === "enrolled") {
      return NextResponse.json({ error: "Local credentials are already enrolled." }, { status: 409, headers })
    }
    const throttle = await consumeRecoveryThrottle("enroll", userId)
    if (!throttle.allowed) return tooManyRequests(throttle)
    const parsed = await parseLocalCredentialEnrollmentRequest(request)
    if (!parsed.ok) {
      return NextResponse.json({ error: "Credential request is invalid." }, { status: 400, headers })
    }
    const result = await enrollLocalCredential(userId, parsed.data.password)
    if (!result.ok) {
      if (result.reason === "owner-required") return forbidden()
      if (result.reason === "enrolled") {
        return NextResponse.json({ error: "Local credentials are already enrolled." }, { status: 409, headers })
      }
      return temporary()
    }
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
