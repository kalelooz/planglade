const MAX_EMAIL_LENGTH = 320

/** @param {unknown} value */
export function normalizeEmail(value) {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  if (!normalized || normalized.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+$/.test(normalized)) return null
  return normalized
}
