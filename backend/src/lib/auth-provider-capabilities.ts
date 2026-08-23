import { evaluateProviderConfiguration } from "@/lib/production-config.mjs"

export type ProviderCapabilities = {
  localCredentials: boolean
  google: boolean
  github: boolean
  anyConfigured: boolean
}

export type ProviderCapabilityResult = {
  capabilities: ProviderCapabilities
  errors: string[]
}

export function getProviderCapabilityResult(): ProviderCapabilityResult {
  return evaluateProviderConfiguration(process.env, {
    productionLike: process.env.NODE_ENV === "production",
  })
}

export function getProviderCapabilities(): ProviderCapabilities {
  return getProviderCapabilityResult().capabilities
}
