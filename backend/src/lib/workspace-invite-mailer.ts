import { createHash } from "node:crypto"
import type { WorkspaceRole } from "@prisma/client"

import { sendEmail } from "@/lib/email-delivery"

type DeliverWorkspaceInviteEmailInput = {
  workspaceId: string
  inviteId: string
  tokenVersion: number
  email: string
  role: WorkspaceRole
  subject: string
  body: string
  idempotencyKey?: string
}

export function buildWorkspaceInviteDeliveryIdempotencyKey(input: {
  workspaceId: string
  inviteId: string
  tokenVersion: number
}) {
  return `workspace-invite:${input.workspaceId}:${input.inviteId}:v${input.tokenVersion}`
}

export function buildWorkspaceInviteTestDeliveryIdempotencyKey(input: {
  workspaceId: string
  actorUserId: string
  requestId?: string | null
  now?: Date
}) {
  const retryIdentity =
    input.requestId?.trim() ||
    `hour:${Math.floor((input.now ?? new Date()).getTime() / (60 * 60 * 1000))}`
  const digest = createHash("sha256")
    .update(`${input.workspaceId}\0${input.actorUserId}\0${retryIdentity}`, "utf8")
    .digest("hex")
  return `workspace-invite-test:${digest}`
}

export async function deliverWorkspaceInviteEmail(input: DeliverWorkspaceInviteEmailInput) {
  return sendEmail({
    to: input.email,
    subject: input.subject,
    text: input.body,
    idempotencyKey:
      input.idempotencyKey ?? buildWorkspaceInviteDeliveryIdempotencyKey(input),
  })
}
