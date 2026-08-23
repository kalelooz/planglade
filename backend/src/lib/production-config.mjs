import {
  getOptionalSecretConfigError,
  getSecretConfigError,
} from "./production-secret-policy.mjs"

const VALID_AUTH_MODES = ["dev", "firebase", "nextauth"]
const VALID_STORAGE_PROVIDERS = ["firebase", "local"]
const VALID_EMAIL_PROVIDERS = ["resend", "console", "disabled"]
const MAX_TRUSTED_PROXY_HOPS = 10

function readPlanGladeEnv(env, name) {
  return env[`PLANGLADE_${name}`]
}

function readPublicPlanGladeEnv(env, name) {
  return env[`NEXT_PUBLIC_PLANGLADE_${name}`]
}

function lower(value, fallback) {
  return (value ?? fallback).toLowerCase()
}

function unique(errors) {
  return [...new Set(errors.filter(Boolean))]
}

function resolveProductionLike(env, options) {
  return options?.productionLike ?? (env.NODE_ENV === "production" || env.CI === "true")
}

export function evaluateTrustedProxyConfiguration(env = process.env) {
  const value = env.PLANGLADE_TRUST_PROXY_HOPS
  const invalid = value !== undefined && value !== "" && (
    !/^\d+$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > MAX_TRUSTED_PROXY_HOPS
  )
  return {
    hops: invalid || !value ? 0 : Number(value),
    errors: invalid
      ? ["PLANGLADE_TRUST_PROXY_HOPS must be an integer from 0 to 10."]
      : [],
  }
}

export function evaluateProviderConfiguration(env = process.env, options = {}) {
  const productionLike = resolveProductionLike(env, options)
  const localValue = env.PLANGLADE_LOCAL_AUTH_ENABLED
  const localCredentials = localValue === "true"
  const errors = []
  if (localValue !== undefined && localValue !== "true" && localValue !== "false") {
    errors.push("Invalid PLANGLADE_LOCAL_AUTH_ENABLED. Use true or false.")
  }
  let google = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET)
  let github = Boolean(env.GITHUB_ID && env.GITHUB_SECRET)
  if (productionLike && google) {
    const idError = getSecretConfigError("GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID, { minBytes: 1 })
    const secretError = getSecretConfigError("GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET, { minBytes: 16 })
    if (secretError) errors.push(secretError)
    if (idError) errors.push(idError)
    google = !idError && !secretError
  }
  if (productionLike && github) {
    const idError = getSecretConfigError("GITHUB_ID", env.GITHUB_ID, { minBytes: 1 })
    const secretError = getSecretConfigError("GITHUB_SECRET", env.GITHUB_SECRET, { minBytes: 16 })
    if (secretError) errors.push(secretError)
    if (idError) errors.push(idError)
    github = !idError && !secretError
  }
  return {
    capabilities: {
      localCredentials,
      google,
      github,
      anyConfigured: localCredentials || google || github,
    },
    errors: unique(errors),
  }
}

export function evaluateAuthConfiguration(env = process.env, options = {}) {
  const productionLike = resolveProductionLike(env, options)
  const defaultMode = productionLike ? "nextauth" : "dev"
  const configuredMode = lower(readPlanGladeEnv(env, "AUTH_MODE"), defaultMode)
  const configuredPublicMode = lower(readPublicPlanGladeEnv(env, "AUTH_MODE"), defaultMode)
  const mode = VALID_AUTH_MODES.includes(configuredMode) ? configuredMode : "invalid"
  const publicMode = VALID_AUTH_MODES.includes(configuredPublicMode) ? configuredPublicMode : "invalid"
  const providers = evaluateProviderConfiguration(env, { productionLike })
  const proxy = evaluateTrustedProxyConfiguration(env)
  const errors = [...proxy.errors]
  if (mode === "invalid") {
    errors.push("Invalid PLANGLADE_AUTH_MODE. Use one of: dev, firebase, nextauth.")
  }
  if (publicMode === "invalid") {
    errors.push("Invalid NEXT_PUBLIC_PLANGLADE_AUTH_MODE. Use one of: dev, firebase, nextauth.")
  }
  if (mode !== "invalid" && publicMode !== "invalid" && mode !== publicMode) {
    errors.push("PLANGLADE_AUTH_MODE and NEXT_PUBLIC_PLANGLADE_AUTH_MODE must match.")
  }
  if (productionLike && mode === "dev") {
    errors.push("PLANGLADE_AUTH_MODE=dev is disabled in production.")
  }
  if (mode === "firebase") {
    for (const key of [
      "FIREBASE_PROJECT_ID",
      "FIREBASE_STORAGE_BUCKET",
      "NEXT_PUBLIC_FIREBASE_API_KEY",
      "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
      "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
      "NEXT_PUBLIC_FIREBASE_APP_ID",
    ]) {
      if (!env[key]) errors.push(`Missing required env var: ${key}`)
    }
  }
  if (mode === "nextauth") {
    if (!env.NEXTAUTH_SECRET) {
      errors.push("Missing NEXTAUTH_SECRET for nextauth mode.")
    } else if (productionLike) {
      const secretError = getSecretConfigError("NEXTAUTH_SECRET", env.NEXTAUTH_SECRET)
      if (secretError) errors.push(secretError)
    }
    if (!env.NEXTAUTH_URL) errors.push("Missing NEXTAUTH_URL for nextauth mode.")
    errors.push(...providers.errors)
  }
  return {
    mode,
    publicMode,
    providers: providers.capabilities,
    errors: unique(errors),
    isProduction: productionLike,
  }
}

export function evaluateStorageConfiguration(env = process.env, options = {}) {
  const productionLike = resolveProductionLike(env, options)
  const configured = lower(readPlanGladeEnv(env, "STORAGE_PROVIDER"), "local")
  const provider = VALID_STORAGE_PROVIDERS.includes(configured) ? configured : "invalid"
  const errors = []
  if (provider === "invalid") {
    errors.push("Invalid PLANGLADE_STORAGE_PROVIDER. Use one of: firebase, local.")
  } else if (provider === "firebase") {
    if (!env.FIREBASE_PROJECT_ID) errors.push("Missing FIREBASE_PROJECT_ID for firebase storage provider.")
    if (!env.FIREBASE_STORAGE_BUCKET) errors.push("Missing FIREBASE_STORAGE_BUCKET for firebase storage provider.")
  } else if (productionLike) {
    const configuredSecret = readPlanGladeEnv(env, "STORAGE_SIGNING_SECRET")
    const sourceSecret = configuredSecret ?? env.NEXTAUTH_SECRET
    if (!sourceSecret) {
      errors.push("Missing PLANGLADE_STORAGE_SIGNING_SECRET (or NEXTAUTH_SECRET) for local storage URL signing.")
    } else {
      const secretName = configuredSecret ? "PLANGLADE_STORAGE_SIGNING_SECRET" : "NEXTAUTH_SECRET"
      const secretError = getSecretConfigError(secretName, sourceSecret)
      if (secretError) errors.push(secretError)
      if (configuredSecret && configuredSecret === env.NEXTAUTH_SECRET) {
        errors.push("PLANGLADE_STORAGE_SIGNING_SECRET must not reuse NEXTAUTH_SECRET.")
      }
    }
  }
  return { provider, errors: unique(errors) }
}

export function evaluateEmailConfiguration(env = process.env, options = {}) {
  const productionLike = resolveProductionLike(env, options)
  const fallback = productionLike ? "disabled" : "console"
  const configured = lower(readPlanGladeEnv(env, "EMAIL_PROVIDER"), fallback)
  const provider = VALID_EMAIL_PROVIDERS.includes(configured) ? configured : "invalid"
  const errors = []
  if (provider === "invalid") {
    errors.push("Invalid PLANGLADE_EMAIL_PROVIDER. Use one of: resend, console, disabled.")
  } else if (provider === "console" && productionLike) {
    errors.push("PLANGLADE_EMAIL_PROVIDER=console is not allowed in production-like environments.")
  } else if (provider === "resend") {
    if (!env.RESEND_API_KEY) errors.push("Missing RESEND_API_KEY for resend email provider.")
    if (!readPlanGladeEnv(env, "EMAIL_FROM")) errors.push("Missing PLANGLADE_EMAIL_FROM for resend email provider.")
  }
  return { provider, errors: unique(errors) }
}

export function evaluateProductionConfiguration(env = process.env, options = {}) {
  const productionLike = resolveProductionLike(env, options)
  const auth = evaluateAuthConfiguration(env, { productionLike })
  const storage = evaluateStorageConfiguration(env, { productionLike })
  const email = evaluateEmailConfiguration(env, { productionLike })
  const optionalSecretErrors = []
  if (productionLike) {
    for (const [name, value, minBytes] of [
      ["PLANGLADE_MAINTENANCE_TOKEN", readPlanGladeEnv(env, "MAINTENANCE_TOKEN"), 32],
      ["PLANGLADE_SETUP_TOKEN", readPlanGladeEnv(env, "SETUP_TOKEN"), 32],
      ["GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET, 16],
      ["GITHUB_SECRET", env.GITHUB_SECRET, 16],
      ["RESEND_API_KEY", env.RESEND_API_KEY, 16],
    ]) {
      const error = getOptionalSecretConfigError(name, value, { minBytes })
      if (error) optionalSecretErrors.push(error)
    }
  }
  return {
    productionLike,
    auth,
    storage,
    email,
    errors: unique([...auth.errors, ...storage.errors, ...email.errors, ...optionalSecretErrors]),
  }
}
