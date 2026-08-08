export const NOTIFICATION_KEYS = {
  mentioned: "Mentioned",
  assignedToMe: "Assigned to me",
  commentsOnMyItems: "Comments on my items",
  statusChanges: "Status changes",
  weeklyDigest: "Weekly digest",
} as const

export const NOTIFICATION_META_KEYS = {
  lastReadAt: "__lastReadAt",
  readNotificationIds: "__readNotificationIds",
} as const

export const DEFAULT_NOTIFICATION_PREFERENCES: Record<string, boolean> = {
  [NOTIFICATION_KEYS.mentioned]: true,
  [NOTIFICATION_KEYS.assignedToMe]: true,
  [NOTIFICATION_KEYS.commentsOnMyItems]: true,
  [NOTIFICATION_KEYS.statusChanges]: false,
  [NOTIFICATION_KEYS.weeklyDigest]: false,
}

export function normalizeNotificationPreferences(input: unknown) {
  const merged = { ...DEFAULT_NOTIFICATION_PREFERENCES }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return merged
  }
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "boolean") {
      merged[key] = value
    }
  }
  return merged
}

export function extractNotificationLastReadAt(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null
  const raw = (input as Record<string, unknown>)[NOTIFICATION_META_KEYS.lastReadAt]
  return typeof raw === "string" ? raw : null
}

export function mergeNotificationMetadata(
  base: unknown,
  values: { lastReadAt?: string | null; readNotificationIds?: string[] }
) {
  const next: Record<string, unknown> =
    base && typeof base === "object" && !Array.isArray(base)
      ? { ...(base as Record<string, unknown>) }
      : {}

  if (values.lastReadAt) {
    next[NOTIFICATION_META_KEYS.lastReadAt] = values.lastReadAt
  }
  if (values.readNotificationIds) {
    next[NOTIFICATION_META_KEYS.readNotificationIds] = values.readNotificationIds
  }

  return next
}

export function extractReadNotificationIds(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return []
  const raw = (input as Record<string, unknown>)[NOTIFICATION_META_KEYS.readNotificationIds]
  if (!Array.isArray(raw)) return []
  return raw.filter((entry): entry is string => typeof entry === "string")
}

export function mergeReadNotificationIds(existing: string[], incoming: string[]) {
  const merged = Array.from(new Set([...existing, ...incoming]))
  return merged.slice(-500)
}
