import type { WorkspaceRole } from "@prisma/client"

export function isGenericWorkspaceRole(role: WorkspaceRole) {
  return role !== "OWNER"
}

export function validateWorkspaceMemberRoleChange(input: {
  workspaceOwnerId: string
  targetUserId: string
  nextRole: WorkspaceRole
}) {
  if (!isGenericWorkspaceRole(input.nextRole)) {
    return {
      ok: false as const,
      message: "Ownership cannot be granted through member management",
    }
  }

  if (input.workspaceOwnerId === input.targetUserId) {
    return {
      ok: false as const,
      message: "Workspace owner role cannot be downgraded",
    }
  }

  return { ok: true as const }
}

export function validateWorkspaceMemberRemoval(input: {
  workspaceOwnerId: string
  actorUserId: string
  targetUserId: string
}) {
  if (input.workspaceOwnerId === input.targetUserId) {
    return {
      ok: false as const,
      message: "Workspace owner cannot be removed",
    }
  }

  if (input.actorUserId === input.targetUserId) {
    return {
      ok: false as const,
      message: "Use a different admin/owner account to remove yourself",
    }
  }

  return { ok: true as const }
}
