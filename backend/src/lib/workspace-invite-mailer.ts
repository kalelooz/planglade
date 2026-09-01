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
}

export function buildWorkspaceInviteDeliveryIdempotencyKey(input: {
  workspaceId: string
  inviteId: string
  tokenVersion: number
}) {
  return `workspace-invite:${input.workspaceId}:${input.inviteId}:v${input.tokenVersion}`
}

export async function deliverWorkspaceInviteEmail(input: DeliverWorkspaceInviteEmailInput) {
  return sendEmail({
    to: input.email,
    subject: input.subject,
    text: input.body,
    idempotencyKey: buildWorkspaceInviteDeliveryIdempotencyKey(input),
  })
}
