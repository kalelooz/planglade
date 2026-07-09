import { NextRequest, NextResponse } from "next/server"

import { logActivityEvent } from "@/lib/activity"
import {
  badRequest,
  forbidden,
  hasMinimumWorkspaceRole,
  notFound,
  parseJsonBody,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { updateWorkspaceInviteSchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { canResendInvite } from "@/lib/workspace-invite-guards"
import { deliverWorkspaceInviteEmail } from "@/lib/workspace-invite-mailer"
import {
  buildInviteExpiry,
  buildInviteToken,
  normalizeInviteEmail,
  resolveInviteStatus,
} from "@/lib/workspace-invite-utils"
import {
  canInviteEmailByDomain,
  DEFAULT_INVITE_POLICY,
  getOrCreateWorkspaceInvitePolicy,
  normalizeDomainList,
  renderInviteTemplate,
  resolveInviteTemplateFromPolicy,
} from "@/lib/workspace-invite-policy"
import { isGenericWorkspaceRole } from "@/lib/workspace-member-guards"

type Params = { params: Promise<{ inviteId: string }> }

function deriveInviteeName(inputName: string | undefined, email: string) {
  const trimmedName = inputName?.trim() ?? ""
  if (trimmedName.length > 0) return trimmedName
  const localPart = email.trim().split("@")[0] ?? ""
  const normalized = localPart.replace(/[._-]+/g, " ").trim()
  if (!normalized) return email
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { inviteId } = await params
  if (!inviteId) return badRequest("inviteId route param is required")

  const parsed = await parseJsonBody(request, updateWorkspaceInviteSchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId

    const policy = await getOrCreateWorkspaceInvitePolicy(parsed.data.workspaceId)
    if (!hasMinimumWorkspaceRole(access.actor.role, policy.minimumInviterRole)) {
      return forbidden(`This workspace requires ${policy.minimumInviterRole} role or higher to manage invites`)
    }

    const invite = await db.workspaceInvite.findFirst({
      where: {
        id: inviteId,
        workspaceId: parsed.data.workspaceId,
      },
      include: {
        workspace: { select: { id: true, name: true } },
      },
    })
    if (!invite) return notFound("Workspace invite not found")

    if (parsed.data.action === "revoke") {
      const updated = await db.$transaction(async (tx) => {
        const revoked = await tx.workspaceInvite.update({
          where: { id: invite.id },
          data: { status: "REVOKED" },
        })

        await logActivityEvent(tx, {
          workspaceId: parsed.data.workspaceId,
          actorId: actorUserId,
          action: "UPDATED",
          entityType: "WORKSPACE",
          entityId: parsed.data.workspaceId,
          summary: `Revoked invite for ${invite.email}`,
          metadata: {
            inviteId: invite.id,
            email: invite.email,
            status: revoked.status,
          },
        })

        return revoked
      })

      return NextResponse.json({
        invite: {
          id: updated.id,
          email: updated.email,
          role: updated.role,
          status: resolveInviteStatus(updated),
          expiresAt: updated.expiresAt,
          createdAt: updated.createdAt,
          updatedAt: updated.updatedAt,
        },
      })
    }

    if (!canResendInvite(invite.status)) {
      return badRequest("Accepted invite cannot be resent")
    }

    const domainCheck = canInviteEmailByDomain({
      email: normalizeInviteEmail(invite.email),
      allowExternalDomains: policy.allowExternalDomains,
      allowedDomains: normalizeDomainList(
        Array.isArray(policy.allowedDomains) ? (policy.allowedDomains as string[]) : []
      ),
      blockedDomains: normalizeDomainList(
        Array.isArray(policy.blockedDomains) ? (policy.blockedDomains as string[]) : []
      ),
    })
    if (!domainCheck.ok) return badRequest(domainCheck.reason)

    const inviter = await db.user.findUnique({
      where: { id: actorUserId },
      select: { name: true, email: true },
    })

    const role = parsed.data.role ?? invite.role
    if (!isGenericWorkspaceRole(role)) {
      return forbidden("Ownership cannot be granted through invitations")
    }
    const expiresAt = buildInviteExpiry(policy.inviteExpiryDays)
    const token = buildInviteToken()
    const customMessage = parsed.data.customMessage ?? invite.customMessage ?? ""
    const requestedTemplateKey = parsed.data.templateKey ?? invite.templateKey ?? "default"
    const inviteUrl = `${request.nextUrl.origin}/login?inviteToken=${token}`

    const selectedTemplate = resolveInviteTemplateFromPolicy({
      templateKey: requestedTemplateKey,
      policyEmailSubjectTemplate:
        policy.emailSubjectTemplate ?? DEFAULT_INVITE_POLICY.emailSubjectTemplate,
      policyEmailBodyTemplate:
        policy.emailBodyTemplate ?? DEFAULT_INVITE_POLICY.emailBodyTemplate,
      policyTemplateCatalog: policy.templateCatalog,
    })
    const templateContext = {
      workspaceName: invite.workspace.name,
      inviterName: inviter?.name ?? inviter?.email ?? actorUserId,
      inviteeName: deriveInviteeName(parsed.data.name, invite.email),
      inviteeEmail: invite.email,
      role,
      inviteUrl,
      customMessage,
      inviteExpiryDays: policy.inviteExpiryDays,
    }

    const messageSubject = renderInviteTemplate(
      selectedTemplate.subjectTemplate,
      templateContext
    )
    const messageBody = renderInviteTemplate(selectedTemplate.bodyTemplate, templateContext)

    const updated = await db.$transaction(async (tx) => {
      const resent = await tx.workspaceInvite.update({
        where: { id: invite.id },
        data: {
          role,
          status: "PENDING",
          token,
          expiresAt,
          invitedById: actorUserId,
          acceptedById: null,
          customMessage,
          templateKey: selectedTemplate.key,
          messageSubject,
          messageBody,
        },
      })

      await logActivityEvent(tx, {
        workspaceId: parsed.data.workspaceId,
        actorId: actorUserId,
        action: "UPDATED",
        entityType: "WORKSPACE",
        entityId: parsed.data.workspaceId,
        summary: `Resent invite for ${invite.email}`,
        metadata: {
          inviteId: invite.id,
          email: invite.email,
          role: resent.role,
          status: resent.status,
          expiresAt: resent.expiresAt.toISOString(),
          templateKey: selectedTemplate.key,
        },
      })

      return resent
    })

    const delivery = await deliverWorkspaceInviteEmail({
      workspaceId: parsed.data.workspaceId,
      inviteId: updated.id,
      email: updated.email,
      role: updated.role,
      subject: updated.messageSubject ?? `You're invited to join ${invite.workspace.name}`,
      body:
        updated.messageBody ??
        `${inviter?.name ?? inviter?.email ?? actorUserId} invited you to join ${invite.workspace.name} as ${updated.role}.`,
    })
    if (!delivery.ok) {
      await db.workspaceInvite.update({
        where: { id: updated.id },
        data: {
          lastDeliveryProvider: delivery.provider,
          lastDeliveryError: delivery.error,
          lastDeliveryMessageId: null,
          lastDeliveredAt: null,
        },
      })
      return NextResponse.json(
        {
          error: `Invite updated but email delivery failed: ${delivery.error}`,
          inviteId: updated.id,
        },
        { status: 502 }
      )
    }

    const updatedWithDelivery = await db.workspaceInvite.update({
      where: { id: updated.id },
      data: {
        lastDeliveryProvider: delivery.provider,
        lastDeliveryMessageId: delivery.messageId,
        lastDeliveryError: null,
        lastDeliveredAt: new Date(),
      },
    })

    return NextResponse.json({
      invite: {
        id: updatedWithDelivery.id,
        email: updatedWithDelivery.email,
        role: updatedWithDelivery.role,
        status: resolveInviteStatus(updatedWithDelivery),
        expiresAt: updatedWithDelivery.expiresAt,
        createdAt: updatedWithDelivery.createdAt,
        updatedAt: updatedWithDelivery.updatedAt,
        customMessage: updatedWithDelivery.customMessage,
        templateKey: updatedWithDelivery.templateKey,
        lastDeliveryProvider: updatedWithDelivery.lastDeliveryProvider,
        lastDeliveryMessageId: updatedWithDelivery.lastDeliveryMessageId,
        lastDeliveryError: updatedWithDelivery.lastDeliveryError,
        lastDeliveredAt: updatedWithDelivery.lastDeliveredAt,
      },
      inviteToken: updatedWithDelivery.token,
      messagePreview: {
        subject: updatedWithDelivery.messageSubject,
        body: updatedWithDelivery.messageBody,
      },
      delivery: {
        provider: delivery.provider,
        messageId: delivery.messageId,
      },
    })
  } catch (error) {
    return serverError("Failed to update workspace invite", String(error))
  }
}
