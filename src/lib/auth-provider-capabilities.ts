export type ProviderCapabilities = {
  localCredentials: boolean
  google: boolean
  github: boolean
  anyConfigured: boolean
}

function readLocalCredentialsEnabled() {
  const value = process.env.PLANGLADE_LOCAL_AUTH_ENABLED
  if (value === undefined) return false
  if (value === "true") return true
  if (value === "false") return false
  throw new Error("Invalid PLANGLADE_LOCAL_AUTH_ENABLED. Use true or false.")
}

export function getProviderCapabilities(): ProviderCapabilities {
  const localCredentials = readLocalCredentialsEnabled()
  const google = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
  const github = Boolean(process.env.GITHUB_ID && process.env.GITHUB_SECRET)

  return {
    localCredentials,
    google,
    github,
    anyConfigured: localCredentials || google || github,
  }
}
