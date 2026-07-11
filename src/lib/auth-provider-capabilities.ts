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

function readLocalCredentialsEnabled() {
  const value = process.env.PLANGLADE_LOCAL_AUTH_ENABLED
  if (value === undefined || value === "false") return { enabled: false, error: null }
  if (value === "true") return { enabled: true, error: null }
  return { enabled: false, error: "Invalid PLANGLADE_LOCAL_AUTH_ENABLED. Use true or false." }
}

export function getProviderCapabilityResult(): ProviderCapabilityResult {
  const localCredentials = readLocalCredentialsEnabled()
  const google = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  const github = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET)

  return {
    capabilities: {
      localCredentials: localCredentials.enabled,
      google,
      github,
      anyConfigured: localCredentials.enabled || google || github,
    },
    errors: localCredentials.error ? [localCredentials.error] : [],
  }
}

export function getProviderCapabilities(): ProviderCapabilities {
  return getProviderCapabilityResult().capabilities
}
