import { NextResponse } from "next/server"

import { hasAuthProviders } from "@/lib/auth-options"
import { getAuthConfigErrors } from "@/lib/auth-config"
import { getStorageConfigErrors } from "@/lib/storage"

export async function GET() {
  const authConfig = getAuthConfigErrors()
  const authProvidersConfigured = hasAuthProviders()
  const storageConfig = getStorageConfigErrors()
  const isAuthReady =
    authConfig.mode !== "invalid" &&
    authConfig.errors.length === 0 &&
    (authConfig.mode !== "nextauth" || authProvidersConfigured)
  const isStorageReady = storageConfig.provider !== "invalid" && storageConfig.errors.length === 0

  return NextResponse.json({
    status: isAuthReady && isStorageReady ? "ok" : "degraded",
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
                "PLANGLADE_AUTH_MODE=nextauth requires at least one configured provider (Google or GitHub).",
              ]
            : authConfig.errors,
      },
      storage: {
        ready: isStorageReady,
        provider: storageConfig.provider,
        errors: storageConfig.errors,
      },
    },
  })
}
