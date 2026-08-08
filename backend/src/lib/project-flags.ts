import type { Prisma } from "@prisma/client"
import type { ProjectMode } from "@prisma/client"

export const PROJECT_FEATURE_KEYS = [
  "comments",
  "mentions",
  "notifications",
  "subtasks",
  "relations",
  "docs",
  "attachments",
  "customFields",
  "sla",
] as const

export type ProjectFeatureKey = (typeof PROJECT_FEATURE_KEYS)[number]
export type ProjectFeatureFlags = Record<ProjectFeatureKey, boolean>

export const DEFAULT_PROJECT_FEATURE_FLAGS: ProjectFeatureFlags = {
  comments: true,
  mentions: true,
  notifications: true,
  subtasks: true,
  relations: true,
  docs: false,
  attachments: false,
  customFields: false,
  sla: false,
}

export function normalizeProjectFeatureFlags(
  input: unknown,
  options?: { mode?: ProjectMode | "STANDARD" | "SERVICE_DESK" | null }
): ProjectFeatureFlags {
  const merged: ProjectFeatureFlags = { ...DEFAULT_PROJECT_FEATURE_FLAGS }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    if (options?.mode !== "SERVICE_DESK") {
      merged.sla = false
    }
    return merged
  }

  for (const key of PROJECT_FEATURE_KEYS) {
    const value = (input as Record<string, unknown>)[key]
    if (typeof value === "boolean") {
      merged[key] = value
    }
  }
  if (options?.mode !== "SERVICE_DESK") {
    merged.sla = false
  }
  return merged
}

export function toProjectFeatureFlagsJson(
  input: unknown,
  options?: { mode?: ProjectMode | "STANDARD" | "SERVICE_DESK" | null }
): Prisma.InputJsonValue {
  const normalized = normalizeProjectFeatureFlags(input, options)
  return normalized as Prisma.InputJsonValue
}
