import type { WorkspaceRole } from "@prisma/client"

import { db } from "@/lib/db"

export const ROLE_RANK: Record<WorkspaceRole, number> = {
  OWNER: 4,
  ADMIN: 3,
  MEMBER: 2,
  VIEWER: 1,
}

export function hasMinimumWorkspaceRole(actual: WorkspaceRole, minimum: WorkspaceRole) {
  return ROLE_RANK[actual] >= ROLE_RANK[minimum]
}

export async function resolveWorkspaceActor(workspaceId: string, sessionUserId: string) {
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: sessionUserId } },
    select: { userId: true, role: true },
  })
  if (!membership) return null

  return { userId: membership.userId, role: membership.role }
}
