import type { WorkspaceRole } from "@prisma/client"

import { sendEmail } from "@/lib/email-delivery"

type DeliverWorkspaceInviteEmailInput = {
  workspaceId: string
  inviteId: string
  email: string
  role: WorkspaceRole
  subject: string
  body: string
}

export async function deliverWorkspaceInviteEmail(input: DeliverWorkspaceInviteEmailInput) {
  return sendEmail({
    to: input.email,
    subject: input.subject,
    text: input.body,
    idempotencyKey: `workspace-invite:${input.workspaceId}:${input.inviteId}:${input.email}:${input.role}`,
  })
}
