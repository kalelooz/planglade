const MAX_EMAIL_LENGTH = 320

export function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  if (
    !normalized ||
    normalized.length > MAX_EMAIL_LENGTH ||
    !/^[^\s@]+@[^\s@]+$/.test(normalized)
  ) {
    return null
  }
  return normalized
}
