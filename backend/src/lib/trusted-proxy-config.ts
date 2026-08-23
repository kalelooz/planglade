import { evaluateTrustedProxyConfiguration } from "@/lib/production-config.mjs"

export function getTrustedProxyHopsConfigError(value = process.env.PLANGLADE_TRUST_PROXY_HOPS) {
  return evaluateTrustedProxyConfiguration({ PLANGLADE_TRUST_PROXY_HOPS: value }).errors[0] ?? null
}

export function getTrustedProxyHops() {
  const configuration = evaluateTrustedProxyConfiguration(process.env)
  if (configuration.errors[0]) throw new Error(configuration.errors[0])
  return configuration.hops
}
