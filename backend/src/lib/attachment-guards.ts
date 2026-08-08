import { normalizeProjectFeatureFlags } from "@/lib/project-flags"

type AttachmentProjectRecord = {
  id: string
  workspaceId: string
  featureFlags: unknown
}

type AttachmentProjectBoundaryResult =
  | { ok: true }
  | {
      ok: false
      kind: "bad_request" | "forbidden"
      message: string
    }

export function validateAttachmentProjectBoundary(input: {
  workspaceId: string
  project: AttachmentProjectRecord | null
}): AttachmentProjectBoundaryResult {
  if (!input.project) {
    return { ok: true }
  }

  if (input.project.workspaceId !== input.workspaceId) {
    return {
      ok: false,
      kind: "bad_request",
      message: "Project not found in workspace",
    }
  }

  const flags = normalizeProjectFeatureFlags(input.project.featureFlags)
  if (!flags.attachments) {
    return {
      ok: false,
      kind: "forbidden",
      message: "Attachments are disabled for this project",
    }
  }

  return { ok: true }
}
