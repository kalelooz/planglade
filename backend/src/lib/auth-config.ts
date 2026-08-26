import { evaluateAuthConfiguration } from "@/lib/production-config.mjs"

export const VALID_AUTH_MODES = ["dev", "firebase", "nextauth"] as const
export type PlanGladeAuthMode = (typeof VALID_AUTH_MODES)[number]

function evaluateRuntimeAuth() {
  return evaluateAuthConfiguration(process.env, {
    productionLike: process.env.NODE_ENV === "production",
  })
}

export function getConfiguredAuthMode(): PlanGladeAuthMode | "invalid" {
  return evaluateRuntimeAuth().mode
}

export function getPublicConfiguredAuthMode(): PlanGladeAuthMode | "invalid" {
  return evaluateRuntimeAuth().publicMode
}

export function getAuthConfigErrors() {
  const { mode, publicMode, errors, isProduction } = evaluateRuntimeAuth()
  return { mode, publicMode, errors, isProduction }
}
