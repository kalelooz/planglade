import { db } from "@/lib/db"

export async function validateWorkspaceLabelIds(input: {
  workspaceId: string
  labelIds: string[] | undefined
}) {
  if (input.labelIds === undefined) {
    return { ok: true as const, labelIds: undefined }
  }

  const labelIds = [...new Set(input.labelIds)]
  if (labelIds.length === 0) return { ok: true as const, labelIds }

  const matchingCount = await db.label.count({
    where: {
      workspaceId: input.workspaceId,
      id: { in: labelIds },
    },
  })

  return matchingCount === labelIds.length
    ? { ok: true as const, labelIds }
    : { ok: false as const, labelIds: undefined }
}

export async function workspaceProjectExists(
  workspaceId: string,
  projectId: string | null | undefined
) {
  if (!projectId) return true
  const project = await db.project.findFirst({
    where: { id: projectId, workspaceId },
    select: { id: true },
  })
  return Boolean(project)
}

export async function workspaceMemberExists(
  workspaceId: string,
  userId: string | null | undefined
) {
  if (!userId) return true
  const membership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    select: { userId: true },
  })
  return Boolean(membership)
}
