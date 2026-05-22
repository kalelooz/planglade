import { NextResponse } from "next/server"

import { hasAuthProviders } from "@/lib/auth-options"
import { getAuthConfigErrors } from "@/lib/auth-config"

export async function GET() {
  const authConfig = getAuthConfigErrors({ includeProductionDevBlock: true })
  const authProvidersConfigured = hasAuthProviders()
  const isAuthReady =
    authConfig.mode !== "invalid" &&
    authConfig.errors.length === 0 &&
    (authConfig.mode !== "nextauth" || authProvidersConfigured)

  return NextResponse.json({
    status: isAuthReady ? "ok" : "degraded",
    service: "flowboard-api",
    time: new Date().toISOString(),
    checks: {
      auth: {
        ready: isAuthReady,
        mode: authConfig.mode,
        publicMode: authConfig.publicMode,
        providersConfigured: authProvidersConfigured,
        errors:
          authConfig.mode === "nextauth" && !authProvidersConfigured
            ? [
                ...authConfig.errors,
                "FLOWBOARD_AUTH_MODE=nextauth requires at least one configured provider (Google or GitHub).",
              ]
            : authConfig.errors,
      },
    },
  })
}
