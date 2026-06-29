import { NextRequest, NextResponse } from "next/server"

import { logActivityEvent } from "@/lib/activity"
import {
  badRequest,
  forbidden,
  parseJsonBody,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { acceptWorkspaceInviteSchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { evaluateInviteAcceptance } from "@/lib/workspace-invite-guards"

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, acceptWorkspaceInviteSchema)
  if (!parsed.ok) return parsed.response

  try {
    const actorUserId = await resolveRequestActorUserId(request)
    if (!actorUserId) return forbidden("Authentication required to accept invite")

    const actor = await db.user.findUnique({
      where: { id: actorUserId },
      select: { id: true, email: true, name: true },
    })
    if (!actor) return forbidden("Signed-in user not found")

    const invite = await db.workspaceInvite.findUnique({
      where: { token: parsed.data.token },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
    })
    if (!invite) return badRequest("Invite token is invalid")

    const decision = evaluateInviteAcceptance({
      status: invite.status,
      expiresAt: invite.expiresAt,
      acceptedById: invite.acceptedById,
      inviteEmail: invite.email,
      actorEmail: actor.email,
      actorUserId: actor.id,
    })

    if (decision.kind === "expired") {
      await db.workspaceInvite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      })
      return NextResponse.json({ error: "Invite has expired" }, { status: 410 })
    }

    if (decision.kind === "revoked") return forbidden("Invite has been revoked")

    if (decision.kind === "accepted_self") {
        const membership = await db.workspaceMember.findUnique({
          where: {
            workspaceId_userId: {
              workspaceId: invite.workspaceId,
              userId: actor.id,
            },
          },
          select: { role: true, joinedAt: true },
        })
        if (!membership) return badRequest("Invite was accepted but membership is missing")

        return NextResponse.json({
          accepted: true,
          workspace: invite.workspace,
          member: {
            userId: actor.id,
            role: membership.role,
            joinedAt: membership.joinedAt,
          },
        })
      }
    if (decision.kind === "accepted_other") {
      return forbidden("Invite has already been accepted by a different account")
    }
    if (decision.kind === "email_mismatch") {
      return forbidden("Invite email does not match the signed-in account email")
    }

    const accepted = await db.$transaction(async (tx) => {
      const membership = await tx.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: actor.id,
          },
        },
        update: {
          role: invite.role,
        },
        create: {
          workspaceId: invite.workspaceId,
          userId: actor.id,
          role: invite.role,
        },
      })

      const updatedInvite = await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: {
          status: "ACCEPTED",
          acceptedById: actor.id,
        },
      })

      await logActivityEvent(tx, {
        workspaceId: invite.workspaceId,
        actorId: actor.id,
        action: "UPDATED",
        entityType: "WORKSPACE",
        entityId: invite.workspaceId,
        summary: `${actor.name ?? actor.email} accepted workspace invite`,
        metadata: {
          inviteId: invite.id,
          email: invite.email,
          role: membership.role,
          status: updatedInvite.status,
        },
      })

      return { membership, updatedInvite }
    })

    return NextResponse.json({
      accepted: true,
      workspace: invite.workspace,
      member: {
        userId: actor.id,
        role: accepted.membership.role,
        joinedAt: accepted.membership.joinedAt,
      },
      invite: {
        id: accepted.updatedInvite.id,
        status: accepted.updatedInvite.status,
      },
    })
  } catch (error) {
    return serverError("Failed to accept workspace invite", String(error))
  }
}
