import { Prisma, type PrismaClient, type WorkItemStatus } from "@prisma/client"

export const WORK_ITEM_STATUSES: WorkItemStatus[] = [
  "BACKLOG",
  "TODO",
  "IN_PROGRESS",
  "IN_REVIEW",
  "DONE",
]

export type WorkItemLaneVersions = Record<WorkItemStatus, number>

export class StaleWorkItemLaneMutationError extends Error {}

type LaneVersionClient = Pick<Prisma.TransactionClient, "workItemLaneVersion">

export async function getWorkItemLaneVersions(
  client: LaneVersionClient,
  workspaceId: string,
): Promise<WorkItemLaneVersions> {
  const rows = await client.workItemLaneVersion.findMany({
    where: { workspaceId },
    select: { status: true, version: true },
  })
  const versions = Object.fromEntries(WORK_ITEM_STATUSES.map((status) => [status, 0])) as WorkItemLaneVersions
  for (const row of rows) versions[row.status] = row.version
  return versions
}

export async function claimWorkItemLaneVersions(
  client: LaneVersionClient,
  workspaceId: string,
  expected: Partial<WorkItemLaneVersions>,
) {
  const statuses = WORK_ITEM_STATUSES.filter((status) => expected[status] !== undefined)
  for (const status of statuses) {
    await client.workItemLaneVersion.upsert({
      where: { workspaceId_status: { workspaceId, status } },
      create: { workspaceId, status },
      update: {},
    })
    const claim = await client.workItemLaneVersion.updateMany({
      where: { workspaceId, status, version: expected[status] },
      data: { version: { increment: 1 } },
    })
    if (claim.count !== 1) throw new StaleWorkItemLaneMutationError()
  }
}

export async function bumpWorkItemLaneVersion(
  client: LaneVersionClient,
  workspaceId: string,
  status: WorkItemStatus,
) {
  await client.workItemLaneVersion.upsert({
    where: { workspaceId_status: { workspaceId, status } },
    create: { workspaceId, status, version: 1 },
    update: { version: { increment: 1 } },
  })
}

export async function runSerializableWorkItemMutation<T>(
  client: Pick<PrismaClient, "$transaction">,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await client.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError
        && ["P1008", "P2002", "P2034"].includes(error.code)
      if (!retryable || attempt === 2) throw error
    }
  }
  throw new Error("Work-item mutation retry exhausted")
}
