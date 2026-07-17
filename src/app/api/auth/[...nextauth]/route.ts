import NextAuth from "next-auth"
import { NextRequest, NextResponse } from "next/server"

import { consumeLoginThrottle, tooManyRequests } from "@/lib/auth-throttle"
import { authOptions } from "@/lib/auth-options"
import { normalizeEmail } from "@/lib/local-auth-email"

const handler = NextAuth(authOptions)

export { handler as GET }

export async function postNextAuthRequest(
  request: NextRequest,
  context: Parameters<typeof handler>[1],
  throttleLogin: typeof consumeLoginThrottle = consumeLoginThrottle,
  nextHandler: typeof handler = handler,
) {
  if (!request.nextUrl.pathname.endsWith("/callback/credentials")) {
    return nextHandler(request, context)
  }

  try {
    const form = await request.clone().formData()
    const email = form.get("email")
    const account = typeof email === "string" && email.length <= 320
      ? normalizeEmail(email) ?? "invalid-account"
      : "invalid-account"
    const throttle = await throttleLogin(account)
    if (!throttle.allowed) return tooManyRequests(throttle)
  } catch {
    return NextResponse.json(
      { error: "Authentication temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    )
  }

  return nextHandler(request, context)
}

export function POST(
  request: NextRequest,
  context: Parameters<typeof handler>[1],
) {
  return postNextAuthRequest(request, context)
}
