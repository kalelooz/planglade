import type { ActivityActionType, ActivityEntityType, Prisma } from "@prisma/client"

type ActivityWriter = {
  activityEvent: {
    create: (args: Prisma.ActivityEventCreateArgs) => Promise<unknown>
  }
}

export type ActivityLogInput = {
  workspaceId: string
  actorId?: string
  action: ActivityActionType
  entityType: ActivityEntityType
  entityId: string
  summary?: string
  metadata?: Prisma.InputJsonValue
}

export async function logActivityEvent(client: ActivityWriter, input: ActivityLogInput) {
  await client.activityEvent.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata,
    },
  })
}
