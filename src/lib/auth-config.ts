import { readPlanGladeEnv, readPublicPlanGladeEnv } from "@/lib/env-config"
import { getProviderCapabilityResult } from "@/lib/auth-provider-capabilities"

export const VALID_AUTH_MODES = ["dev", "firebase", "nextauth"] as const
export type PlanGladeAuthMode = (typeof VALID_AUTH_MODES)[number]

function lower(value: string | undefined, fallback: string) {
  return (value ?? fallback).toLowerCase()
}

function getDefaultAuthMode() {
  return process.env.NODE_ENV === "production" ? "nextauth" : "dev"
}

export function getConfiguredAuthMode(): PlanGladeAuthMode | "invalid" {
  const mode = lower(readPlanGladeEnv("AUTH_MODE"), getDefaultAuthMode())
  if ((VALID_AUTH_MODES as readonly string[]).includes(mode)) {
    return mode as PlanGladeAuthMode
  }
  return "invalid"
}

export function getPublicConfiguredAuthMode(): PlanGladeAuthMode | "invalid" {
  const mode = lower(readPublicPlanGladeEnv("AUTH_MODE"), getDefaultAuthMode())
  if ((VALID_AUTH_MODES as readonly string[]).includes(mode)) {
    return mode as PlanGladeAuthMode
  }
  return "invalid"
}

export function getAuthConfigErrors() {
  const mode = getConfiguredAuthMode()
  const publicMode = getPublicConfiguredAuthMode()
  const isProduction = process.env.NODE_ENV === "production"
  const errors: string[] = []

  if (mode === "invalid") {
    errors.push("Invalid PLANGLADE_AUTH_MODE. Use one of: dev, firebase, nextauth.")
    return { mode, publicMode, errors, isProduction }
  }

  if (publicMode === "invalid") {
    errors.push("Invalid NEXT_PUBLIC_PLANGLADE_AUTH_MODE. Use one of: dev, firebase, nextauth.")
  }

  if (publicMode !== "invalid" && publicMode !== mode) {
    errors.push("PLANGLADE_AUTH_MODE and NEXT_PUBLIC_PLANGLADE_AUTH_MODE must match.")
  }

  if (isProduction && mode === "dev") {
    errors.push("PLANGLADE_AUTH_MODE=dev is disabled in production.")
  }

  if (mode === "firebase") {
    const required = [
      "FIREBASE_PROJECT_ID",
      "FIREBASE_STORAGE_BUCKET",
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "NEXT_PUBLIC_FIREBASE_APP_ID",
    ]
    for (const key of required) {
      if (!process.env[key]) {
        errors.push(`Missing required env var: ${key}`)
      }
    }
  }

  if (mode === "nextauth") {
    if (!process.env.NEXTAUTH_SECRET) {
      errors.push("Missing NEXTAUTH_SECRET for nextauth mode.")
    }
    if (!process.env.NEXTAUTH_URL) {
      errors.push("Missing NEXTAUTH_URL for nextauth mode.")
    }
    errors.push(...getProviderCapabilityResult().errors)
  }

  return { mode, publicMode, errors, isProduction }
}
