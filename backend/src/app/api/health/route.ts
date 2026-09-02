import { NextResponse } from "next/server"

import { evaluateProductionConfiguration } from "@/lib/production-config.mjs"

type HealthStatus = "ok" | "degraded" | "error"

function safeErrorMetadata(error: unknown) {
  const record = typeof error === "object" && error !== null
    ? error as { name?: unknown; code?: unknown }
    : null
  const name = typeof record?.name === "string" && /^[A-Za-z][A-Za-z0-9._-]{0,63}$/.test(record.name)
    ? record.name
    : "UnknownError"
  const code = typeof record?.code === "string" && /^[A-Z0-9_-]{1,32}$/.test(record.code)
    ? record.code
    : null
  return code ? { name, code } : { name }
}

function publicBuildRevision() {
  try {
    const revision = process.env.PLANGLADE_BUILD_REVISION?.trim() ?? ""
    return /^[0-9a-f]{40}$/.test(revision) ? revision : "unknown"
  } catch {
    return "unknown"
  }
}

function publicHealthResponse(status: HealthStatus, statusCode: number) {
  return NextResponse.json(
    {
      status,
      service: "planglade-api",
      revision: publicBuildRevision(),
    },
    { status: statusCode }
  )
}

export async function GET() {
  try {
    const configuration = evaluateProductionConfiguration(process.env, {
      productionLike: process.env.NODE_ENV === "production",
    })
    const authConfig = configuration.auth
    const providerCapabilities = authConfig.providers
    const authProvidersConfigured = providerCapabilities.anyConfigured
    const storageConfig = configuration.storage
    const emailConfig = configuration.email
    const isAuthReady =
      authConfig.mode !== "invalid" &&
      authConfig.errors.length === 0 &&
      (authConfig.mode !== "nextauth" || authProvidersConfigured)
    const isStorageReady = storageConfig.provider !== "invalid" && storageConfig.errors.length === 0
    const isEmailReady = emailConfig.provider !== "invalid" && emailConfig.errors.length === 0
    let isDatabaseReady = false
    try {
      const { db } = await import("@/lib/db")
      await db.$queryRawUnsafe("SELECT 1")
      isDatabaseReady = true
    } catch (error) {
      console.error("Health database check failed", safeErrorMetadata(error))
    }
    const isReady = isAuthReady && isStorageReady && isEmailReady && isDatabaseReady

    if (!isReady) {
      console.error("Health readiness check failed", {
        auth: {
          ready: isAuthReady,
          errors:
            authConfig.mode === "nextauth" && !authProvidersConfigured
              ? [
                  ...authConfig.errors,
                  "PLANGLADE_AUTH_MODE=nextauth requires at least one configured provider.",
                ]
              : authConfig.errors,
        },
        storage: { ready: isStorageReady, errors: storageConfig.errors },
        email: { ready: isEmailReady, errors: emailConfig.errors },
        database: { ready: isDatabaseReady },
      })
    }

    return publicHealthResponse(isReady ? "ok" : "degraded", isReady ? 200 : 503)
  } catch (error) {
    console.error("Health check failed", safeErrorMetadata(error))
    return publicHealthResponse("error", 500)
  }
}
