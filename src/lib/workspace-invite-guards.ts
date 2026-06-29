import type { InviteStatus } from "@prisma/client"

import { normalizeInviteEmail, resolveInviteStatus } from "@/lib/workspace-invite-utils"

export type InviteAcceptanceDecision =
  | { kind: "allow" }
  | { kind: "expired" }
  | { kind: "revoked" }
  | { kind: "accepted_self" }
  | { kind: "accepted_other" }
  | { kind: "email_mismatch" }

export function evaluateInviteAcceptance(input: {
  status: InviteStatus
  expiresAt: Date
  acceptedById: string | null
  inviteEmail: string
  actorEmail: string
  actorUserId: string
}): InviteAcceptanceDecision {
  const currentStatus = resolveInviteStatus({
    status: input.status,
    expiresAt: input.expiresAt,
  })

  if (currentStatus === "EXPIRED") return { kind: "expired" }
  if (currentStatus === "REVOKED") return { kind: "revoked" }

  if (currentStatus === "ACCEPTED") {
    if (input.acceptedById === input.actorUserId) {
      return { kind: "accepted_self" }
    }
    return { kind: "accepted_other" }
  }

  if (normalizeInviteEmail(input.actorEmail) !== normalizeInviteEmail(input.inviteEmail)) {
    return { kind: "email_mismatch" }
  }

  return { kind: "allow" }
}

export function canResendInvite(status: InviteStatus) {
  return status !== "ACCEPTED"
}
