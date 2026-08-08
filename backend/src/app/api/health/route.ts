import { NextResponse } from "next/server"

import { getAuthConfigErrors } from "@/lib/auth-config"
import { getProviderCapabilityResult } from "@/lib/auth-provider-capabilities"
import { getStorageConfigErrors } from "@/lib/storage"

export async function GET() {
  try {
    const authConfig = getAuthConfigErrors()
    const { capabilities: providerCapabilities } = getProviderCapabilityResult()
    const authProvidersConfigured = providerCapabilities.anyConfigured
    const storageConfig = getStorageConfigErrors()
    const isAuthReady =
      authConfig.mode !== "invalid" &&
      authConfig.errors.length === 0 &&
      (authConfig.mode !== "nextauth" || authProvidersConfigured)
    const isStorageReady = storageConfig.provider !== "invalid" && storageConfig.errors.length === 0
    let isDatabaseReady = false
    try {
      const { db } = await import("@/lib/db")
      await db.$queryRawUnsafe("SELECT 1")
      isDatabaseReady = true
    } catch (error) {
      console.error("Health database check failed", error)
    }
    const isReady = isAuthReady && isStorageReady && isDatabaseReady

    return NextResponse.json(
      {
        status: isReady ? "ok" : "degraded",
        service: "flowboard-api",
        time: new Date().toISOString(),
        checks: {
          auth: {
            ready: isAuthReady,
            mode: authConfig.mode,
            publicMode: authConfig.publicMode,
            providersConfigured: authProvidersConfigured,
            providers: providerCapabilities,
            errors:
              authConfig.mode === "nextauth" && !authProvidersConfigured
                ? [
                    ...authConfig.errors,
                    "PLANGLADE_AUTH_MODE=nextauth requires at least one configured provider.",
                  ]
                : authConfig.errors,
          },
          storage: {
            ready: isStorageReady,
            provider: storageConfig.provider,
            errors: storageConfig.errors,
          },
          database: {
            ready: isDatabaseReady,
          },
        },
      },
      { status: isReady ? 200 : 503 }
    )
  } catch (error) {
    console.error("Health check failed", error)
    return NextResponse.json(
      {
        status: "error",
        service: "flowboard-api",
        time: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
