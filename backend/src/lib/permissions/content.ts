import type { WorkspaceRole } from "@prisma/client"

import { hasMinimumWorkspaceRole } from "@/lib/permissions/principal"

export function canDeleteWorkspaceContent(input: {
  role: WorkspaceRole
  actorUserId: string
  creatorUserId?: string | null
}) {
  return (
    hasMinimumWorkspaceRole(input.role, "ADMIN") ||
    (typeof input.creatorUserId === "string" && input.creatorUserId === input.actorUserId)
  )
}
