import type { NotificationType, Prisma } from "@prisma/client"

type NotificationWriter = {
  notification: {
    create: (args: Prisma.NotificationCreateArgs) => Promise<unknown>
    upsert: (args: Prisma.NotificationUpsertArgs) => Promise<unknown>
  }
}

export type NotificationCreateInput = {
  workspaceId: string
  userId: string
  actorId?: string
  workItemId?: string
  type: NotificationType
  title: string
  body: string
  sourceKey?: string
}

export async function createNotificationRecord(client: NotificationWriter, input: NotificationCreateInput) {
  if (input.sourceKey) {
    await client.notification.upsert({
      where: {
        workspaceId_userId_sourceKey: {
          workspaceId: input.workspaceId,
          userId: input.userId,
          sourceKey: input.sourceKey,
        },
      },
      create: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        actorId: input.actorId,
        workItemId: input.workItemId,
        type: input.type,
        title: input.title,
        body: input.body,
        sourceKey: input.sourceKey,
      },
      update: {
        actorId: input.actorId,
        workItemId: input.workItemId,
        title: input.title,
        body: input.body,
      },
    })
    return
  }

  await client.notification.create({
    data: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      actorId: input.actorId,
      workItemId: input.workItemId,
      type: input.type,
      title: input.title,
      body: input.body,
    },
  })
}

