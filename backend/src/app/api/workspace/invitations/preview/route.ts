import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  forbidden,
  parseJsonBody,
  resolveRequestActorUserId,
  serverError,
  unauthorized,
} from "@/lib/api-utils"
import { previewWorkspaceInviteSchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { evaluateInviteAcceptance } from "@/lib/workspace-invite-guards"
import { isGenericWorkspaceRole } from "@/lib/workspace-member-guards"

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, previewWorkspaceInviteSchema)
  if (!parsed.ok) return parsed.response

  try {
    const actorUserId = await resolveRequestActorUserId(request)
    if (!actorUserId) return unauthorized("Authentication required to review invite")

    const actor = await db.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, email: true },
    })
    if (!actor) return forbidden("Signed-in user not found")

    const invite = await db.workspaceInvite.findUnique({
      where: { token: parsed.data.token },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        invitedBy: { select: { id: true, name: true, email: true } },
      },
    })
    if (!invite) return badRequest("Invite token is invalid")
    if (!isGenericWorkspaceRole(invite.role)) {
      return forbidden("Ownership cannot be granted through invitations")
    }

    const decision = evaluateInviteAcceptance({
      status: invite.status,
      expiresAt: invite.expiresAt,
      acceptedById: invite.acceptedById,
      inviteEmail: invite.email,
      actorEmail: actor.email,
      actorUserId: actor.id,
    })

    if (decision.kind === "expired") {
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 })
    }
    if (decision.kind === "revoked") return forbidden("Invite has been revoked")
    if (decision.kind === "accepted_other") {
      return forbidden("Invite has already been accepted by a different account")
    }
    if (decision.kind === "email_mismatch") {
      return forbidden("Invite email does not match the signed-in account email")
    }

    return NextResponse.json({
      review: {
        email: invite.email,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
        customMessage: invite.customMessage,
        alreadyAccepted: decision.kind === "accepted_self",
        workspace: invite.workspace,
        invitedBy: invite.invitedBy,
      },
    })
  } catch (error) {
    return serverError("Failed to review workspace invite", String(error))
  }
}
