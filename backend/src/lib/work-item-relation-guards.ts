import { normalizeProjectFeatureFlags } from "@/lib/project-flags"

type RelationProjectRecord = {
  id: string
  workspaceId: string
  featureFlags: unknown
}

type RelationGuardResult =
  | { ok: true }
  | {
      ok: false
      kind: "bad_request" | "forbidden"
      message: string
    }

export function validateRelationProjectsBoundary(input: {
  workspaceId: string
  projectIds: Array<string | null | undefined>
  projects: RelationProjectRecord[]
}): RelationGuardResult {
  const uniqueProjectIds = Array.from(
    new Set(
      input.projectIds.filter(
        (projectId): projectId is string => typeof projectId === "string" && projectId.length > 0
      )
    )
  )

  if (uniqueProjectIds.length === 0) {
    return { ok: true }
  }

  if (input.projects.length !== uniqueProjectIds.length) {
    return {
      ok: false,
      kind: "bad_request",
      message: "One or more related projects were not found",
    }
  }

  if (input.projects.some((project) => project.workspaceId !== input.workspaceId)) {
    return {
      ok: false,
      kind: "bad_request",
      message: "One or more related projects are outside this workspace",
    }
  }

  const blocked = input.projects.find((project) => !normalizeProjectFeatureFlags(project.featureFlags).relations)
  if (blocked) {
    return {
      ok: false,
      kind: "forbidden",
      message: "Work-item relations are disabled for one or more related projects",
    }
  }

  return { ok: true }
}
