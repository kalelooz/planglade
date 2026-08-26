const PLACEHOLDER_PATTERNS = [
  /placeholder/i,
  /^replace[-_ ]?(with|in)/i,
  /^change[-_ ]?me$/i,
  /^your[-_ ]/i,
]

export function getSecretConfigError(name, value, { minBytes = 32 } = {}) {
  const secret = value?.trim()
  if (!secret) return `${name} is required.`
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(secret))) {
    return `${name} uses a known placeholder value.`
  }
  if (Buffer.byteLength(secret, "utf8") < minBytes) {
    return `${name} must be at least ${minBytes} bytes.`
  }
  return null
}

export function getOptionalSecretConfigError(name, value, options) {
  return value?.trim() ? getSecretConfigError(name, value, options) : null
}
