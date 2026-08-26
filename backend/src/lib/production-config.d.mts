export type ConfigurationEnvironment = Record<string, string | undefined>
export type ConfigurationOptions = { productionLike?: boolean }

export type ProviderCapabilities = {
  localCredentials: boolean
  google: boolean
  github: boolean
  anyConfigured: boolean
}

export function evaluateTrustedProxyConfiguration(env?: ConfigurationEnvironment): {
  hops: number
  errors: string[]
}

export function evaluateProviderConfiguration(env?: ConfigurationEnvironment, options?: ConfigurationOptions): {
  capabilities: ProviderCapabilities
  errors: string[]
}

export function evaluateAuthConfiguration(env?: ConfigurationEnvironment, options?: ConfigurationOptions): {
  mode: "dev" | "firebase" | "nextauth" | "invalid"
  publicMode: "dev" | "firebase" | "nextauth" | "invalid"
  providers: ProviderCapabilities
  errors: string[]
  isProduction: boolean
}

export function evaluateStorageConfiguration(env?: ConfigurationEnvironment, options?: ConfigurationOptions): {
  provider: "firebase" | "local" | "invalid"
  errors: string[]
}

export function evaluateEmailConfiguration(env?: ConfigurationEnvironment, options?: ConfigurationOptions): {
  provider: "resend" | "console" | "disabled" | "invalid"
  errors: string[]
}

export function evaluateProductionConfiguration(env?: ConfigurationEnvironment, options?: ConfigurationOptions): {
  productionLike: boolean
  auth: ReturnType<typeof evaluateAuthConfiguration>
  storage: ReturnType<typeof evaluateStorageConfiguration>
  email: ReturnType<typeof evaluateEmailConfiguration>
  errors: string[]
}
