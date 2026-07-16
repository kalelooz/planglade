import { NextRequest, NextResponse } from "next/server"

import { logActivityEvent } from "@/lib/activity"
import { consumeWorkspaceThrottle, tooManyRequests } from "@/lib/auth-throttle"
import {
  badRequest,
  forbidden,
  hasMinimumWorkspaceRole,
  parseJsonBody,
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import {
  createWorkspaceInviteRequestSchema,
  workspaceInviteListQuerySchema,
} from "@/lib/contracts"
import { db } from "@/lib/db"
import { deliverWorkspaceInviteEmail } from "@/lib/workspace-invite-mailer"
import type { WorkspaceRole } from "@prisma/client"
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

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
      status: request.nextUrl.searchParams.get("status") ?? undefined,
    },
    workspaceInviteListQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response

    const invites = await db.workspaceInvite.findMany({
      where: {
        workspaceId: query.data.workspaceId,
        ...(query.data.status ? { status: query.data.status } : {}),
      },
      include: {
        invitedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      invites: invites.map((invite) => ({
        id: invite.id,
        email: invite.email,
        role: invite.role,
        status: resolveInviteStatus(invite),
        expiresAt: invite.expiresAt,
        createdAt: invite.createdAt,
        updatedAt: invite.updatedAt,
        invitedBy: invite.invitedBy,
        customMessage: invite.customMessage,
        templateKey: invite.templateKey,
        lastDeliveryProvider: invite.lastDeliveryProvider,
        lastDeliveryMessageId: invite.lastDeliveryMessageId,
        lastDeliveryError: invite.lastDeliveryError,
        lastDeliveredAt: invite.lastDeliveredAt,
      })),
    })
  } catch (error) {
    return serverError("Failed to load workspace invitations", String(error))
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, createWorkspaceInviteRequestSchema)
  if (!parsed.ok) return parsed.response

  try {
    const requestData = parsed.data as {
      workspaceId: string
      name?: string
      email?: string
      role?: WorkspaceRole
      invites?: Array<{ name?: string; email: string; role?: WorkspaceRole }>
      customMessage?: string
      templateKey?: string
      subjectTemplateOverride?: string
      bodyTemplateOverride?: string
    }
    const isBatch = Array.isArray(requestData.invites)
    const inviteEntries: Array<{
      name?: string
      email: string
      role?: WorkspaceRole
      customMessage?: string
      templateKey?: string
      subjectTemplateOverride?: string
      bodyTemplateOverride?: string
    }> = []

    if (isBatch) {
      const batchInvites = requestData.invites ?? []
      for (const entry of batchInvites) {
        inviteEntries.push({
          name: entry.name,
          email: entry.email,
          role: entry.role,
          customMessage: requestData.customMessage,
          templateKey: requestData.templateKey,
          subjectTemplateOverride: requestData.subjectTemplateOverride,
          bodyTemplateOverride: requestData.bodyTemplateOverride,
        })
      }
    } else {
      inviteEntries.push({
        name: requestData.name,
        email: requestData.email ?? "",
        role: requestData.role,
        customMessage: requestData.customMessage,
        templateKey: requestData.templateKey,
        subjectTemplateOverride: requestData.subjectTemplateOverride,
        bodyTemplateOverride: requestData.bodyTemplateOverride,
      })
    }

    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      await resolveRequestActorUserId(request),
      "MEMBER"
    )
    if (!access.ok) return access.response
    const actorUserId = access.actor.userId
    const throttle = await consumeWorkspaceThrottle(
      "invite-create",
      actorUserId,
      parsed.data.workspaceId,
      inviteEntries.length,
    )
    if (!throttle.allowed) return tooManyRequests(throttle)

    const policy = await getOrCreateWorkspaceInvitePolicy(parsed.data.workspaceId)
    if (!hasMinimumWorkspaceRole(access.actor.role, policy.minimumInviterRole)) {
      return forbidden(`This workspace requires ${policy.minimumInviterRole} role or higher to send invites`)
    }

    const allowedDomains = normalizeDomainList(
      Array.isArray(policy.allowedDomains) ? (policy.allowedDomains as string[]) : []
    )
    const blockedDomains = normalizeDomainList(
      Array.isArray(policy.blockedDomains) ? (policy.blockedDomains as string[]) : []
    )

    const [workspace, inviter] = await Promise.all([
      db.workspace.findUnique({
        where: { id: parsed.data.workspaceId },
        select: { id: true, name: true },
      }),
      db.user.findUnique({
        where: { id: actorUserId },
        select: { name: true, email: true },
      }),
    ])

    if (!workspace) return badRequest("Workspace not found")

    const sent: Array<{
      invite: {
        id: string
        email: string
        role: WorkspaceRole
        status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED"
        expiresAt: Date
        createdAt: Date
        updatedAt: Date
        customMessage: string | null
        templateKey: string | null
        lastDeliveryProvider: string | null
        lastDeliveryMessageId: string | null
        lastDeliveryError: string | null
        lastDeliveredAt: Date | null
      }
      inviteToken: string
      messagePreview: { subject: string | null; body: string | null }
      wasPendingRegenerated: boolean
      delivery: {
        provider: "resend" | "console" | "disabled"
        messageId: string
      }
    }> = []
    const failed: Array<{ email: string; error: string; inviteId?: string }> = []

    for (const entry of inviteEntries) {
      const inviteEmail = normalizeInviteEmail(entry.email)
      const domainCheck = canInviteEmailByDomain({
        email: inviteEmail,
        allowExternalDomains: policy.allowExternalDomains,
        allowedDomains,
        blockedDomains,
      })
      if (!domainCheck.ok) {
        failed.push({ email: inviteEmail, error: domainCheck.reason })
        continue
      }

      const existingMember = await db.workspaceMember.findFirst({
        where: {
          workspaceId: parsed.data.workspaceId,
          user: { email: inviteEmail },
        },
        select: { userId: true },
      })
      if (existingMember) {
        failed.push({ email: inviteEmail, error: "User is already a workspace member" })
        continue
      }

      const existingPendingInvite = await db.workspaceInvite.findFirst({
        where: {
          workspaceId: parsed.data.workspaceId,
          email: inviteEmail,
          status: "PENDING",
        },
        orderBy: { createdAt: "desc" },
      })

      const role = entry.role ?? policy.defaultInviteRole
      if (!isGenericWorkspaceRole(role)) {
        failed.push({
          email: inviteEmail,
          error: "Ownership cannot be granted through invitations",
        })
        continue
      }
      const expiresAt = buildInviteExpiry(policy.inviteExpiryDays)
      const token = buildInviteToken()
      const inviteUrl = `${request.nextUrl.origin}/login?inviteToken=${token}`
      const selectedTemplate = resolveInviteTemplateFromPolicy({
        templateKey: entry.templateKey ?? "default",
        policyEmailSubjectTemplate:
          policy.emailSubjectTemplate ?? DEFAULT_INVITE_POLICY.emailSubjectTemplate,
        policyEmailBodyTemplate:
          policy.emailBodyTemplate ?? DEFAULT_INVITE_POLICY.emailBodyTemplate,
        policyTemplateCatalog: policy.templateCatalog,
      })
      const templateContext = {
        workspaceName: workspace.name,
        inviterName: inviter?.name ?? inviter?.email ?? actorUserId,
        inviteeName: deriveInviteeName(entry.name, inviteEmail),
        inviteeEmail: inviteEmail,
        role,
        inviteUrl,
        customMessage: entry.customMessage ?? "",
        inviteExpiryDays: policy.inviteExpiryDays,
      }

      const subjectTemplate =
        entry.subjectTemplateOverride?.trim() || selectedTemplate.subjectTemplate
      const bodyTemplate =
        entry.bodyTemplateOverride?.trim() || selectedTemplate.bodyTemplate
      const messageSubject = renderInviteTemplate(subjectTemplate, templateContext)
      const messageBody = renderInviteTemplate(bodyTemplate, templateContext)

      try {
        const invite = await db.$transaction(async (tx) => {
          const createdOrUpdated = existingPendingInvite
            ? await tx.workspaceInvite.update({
                where: { id: existingPendingInvite.id },
                data: {
                  role,
                  token,
                  expiresAt,
                  invitedById: actorUserId,
                  status: "PENDING",
                  acceptedById: null,
                  customMessage: entry.customMessage ?? null,
                  messageSubject,
                  messageBody,
                  templateKey: selectedTemplate.key,
                },
              })
            : await tx.workspaceInvite.create({
                data: {
                  workspaceId: parsed.data.workspaceId,
                  email: inviteEmail,
                  role,
                  token,
                  status: "PENDING",
                  expiresAt,
                  invitedById: actorUserId,
                  customMessage: entry.customMessage ?? null,
                  messageSubject,
                  messageBody,
                  templateKey: selectedTemplate.key,
                },
              })

          await logActivityEvent(tx, {
            workspaceId: parsed.data.workspaceId,
            actorId: actorUserId,
            action: existingPendingInvite ? "UPDATED" : "CREATED",
            entityType: "WORKSPACE",
            entityId: parsed.data.workspaceId,
            summary: existingPendingInvite
              ? `Regenerated workspace invite for ${inviteEmail}`
              : `Invited ${inviteEmail} to workspace`,
            metadata: {
              inviteId: createdOrUpdated.id,
              email: inviteEmail,
              role: createdOrUpdated.role,
              status: createdOrUpdated.status,
              expiresAt: createdOrUpdated.expiresAt.toISOString(),
              templateKey: createdOrUpdated.templateKey ?? "default",
            },
          })

          return createdOrUpdated
        })

        const subjectForSend = invite.messageSubject ?? `You're invited to join ${workspace.name}`
        const bodyForSend =
          invite.messageBody ??
          `${inviter?.name ?? inviter?.email ?? actorUserId} invited you to join ${workspace.name} as ${invite.role}.`
        const delivery = await deliverWorkspaceInviteEmail({
          workspaceId: parsed.data.workspaceId,
          inviteId: invite.id,
          email: invite.email,
          role: invite.role,
          subject: subjectForSend,
          body: bodyForSend,
        })

        if (!delivery.ok) {
          await db.workspaceInvite.update({
            where: { id: invite.id },
            data: {
              lastDeliveryProvider: delivery.provider,
              lastDeliveryError: delivery.error,
              lastDeliveryMessageId: null,
              lastDeliveredAt: null,
            },
          })
          failed.push({
            email: inviteEmail,
            inviteId: invite.id,
            error: `Invite created but email delivery failed: ${delivery.error}`,
          })
          continue
        }

        const inviteWithDelivery = await db.workspaceInvite.update({
          where: { id: invite.id },
          data: {
            lastDeliveryProvider: delivery.provider,
            lastDeliveryMessageId: delivery.messageId,
            lastDeliveryError: null,
            lastDeliveredAt: new Date(),
          },
        })

        sent.push({
          invite: {
            id: inviteWithDelivery.id,
            email: inviteWithDelivery.email,
            role: inviteWithDelivery.role,
            status: resolveInviteStatus(inviteWithDelivery),
            expiresAt: inviteWithDelivery.expiresAt,
            createdAt: inviteWithDelivery.createdAt,
            updatedAt: inviteWithDelivery.updatedAt,
            customMessage: inviteWithDelivery.customMessage,
            templateKey: inviteWithDelivery.templateKey,
            lastDeliveryProvider: inviteWithDelivery.lastDeliveryProvider,
            lastDeliveryMessageId: inviteWithDelivery.lastDeliveryMessageId,
            lastDeliveryError: inviteWithDelivery.lastDeliveryError,
            lastDeliveredAt: inviteWithDelivery.lastDeliveredAt,
          },
          inviteToken: inviteWithDelivery.token,
          messagePreview: {
            subject: inviteWithDelivery.messageSubject,
            body: inviteWithDelivery.messageBody,
          },
          wasPendingRegenerated: Boolean(existingPendingInvite),
          delivery: {
            provider: delivery.provider,
            messageId: delivery.messageId,
          },
        })
      } catch (error) {
        failed.push({
          email: inviteEmail,
          error: error instanceof Error ? error.message : "Failed to create workspace invitation",
        })
      }
    }

    if (!isBatch) {
      if (sent.length === 0) {
        return NextResponse.json(
          { error: failed[0]?.error ?? "Failed to create workspace invitation", failed },
          { status: 502 }
        )
      }
      const first = sent[0]
      return NextResponse.json(
        {
          invite: first.invite,
          inviteToken: first.inviteToken,
          messagePreview: first.messagePreview,
          delivery: first.delivery,
        },
        { status: first.wasPendingRegenerated ? 200 : 201 }
      )
    }

    const statusCode = sent.length === inviteEntries.length ? 201 : sent.length > 0 ? 207 : 400
    return NextResponse.json(
      {
        total: inviteEntries.length,
        successCount: sent.length,
        failureCount: failed.length,
        sent,
        failed,
      },
      { status: statusCode }
    )
  } catch (error) {
    return serverError("Failed to create workspace invitation", String(error))
  }
}
