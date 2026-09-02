import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  forbidden,
  hasMinimumWorkspaceRole,
  parseJsonBody,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { sendWorkspaceInviteTestEmailSchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { getCanonicalPublicOrigin } from "@/lib/canonical-public-origin"
import {
  buildWorkspaceInviteTestDeliveryIdempotencyKey,
  deliverWorkspaceInviteEmail,
} from "@/lib/workspace-invite-mailer"
import { normalizeInviteEmail } from "@/lib/workspace-invite-utils"
import { workspaceInviteRateLimitResponse } from "@/lib/workspace-invite-response"
import {
  canInviteEmailByDomain,
  DEFAULT_INVITE_POLICY,
  getOrCreateWorkspaceInvitePolicy,
  normalizeDomainList,
  renderInviteTemplate,
  resolveInviteTemplateFromPolicy,
} from "@/lib/workspace-invite-policy"
import { isGenericWorkspaceRole } from "@/lib/workspace-member-guards"
import { consumeWorkspaceInviteDeliveryRateLimit } from "@/lib/workspace-invite-rate-limit"

function deriveInviteeName(email: string) {
  const localPart = email.trim().split("@")[0] ?? ""
  const normalized = localPart.replace(/[._-]+/g, " ").trim()
  if (!normalized) return email
  return normalized
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

export async function POST(request: NextRequest) {
  const parsed = await parseJsonBody(request, sendWorkspaceInviteTestEmailSchema)
  if (!parsed.ok) return parsed.response

  const requestId = request.headers.get("idempotency-key")
  if (requestId && !/^[A-Za-z0-9._:-]{8,128}$/.test(requestId)) {
    return badRequest("Idempotency-Key must be 8 to 128 letters, numbers, or . _ : -")
  }

  try {
    const actorUserId = await resolveRequestActorUserId(request)
    const access = await requireWorkspaceRole(parsed.data.workspaceId, actorUserId, "MEMBER")
    if (!access.ok) return access.response

    const [workspace, actor, policy] = await Promise.all([
      db.workspace.findUnique({
        where: { id: parsed.data.workspaceId },
        select: { id: true, name: true },
      }),
      db.user.findUnique({
        where: { id: access.actor.userId },
        select: { id: true, email: true, name: true },
      }),
      getOrCreateWorkspaceInvitePolicy(parsed.data.workspaceId),
    ])

    if (!workspace) return badRequest("Workspace not found")
    if (!actor?.email) return badRequest("Signed-in user email is unavailable")
    if (!hasMinimumWorkspaceRole(access.actor.role, policy.minimumInviterRole)) {
      return forbidden(
        `This workspace requires ${policy.minimumInviterRole} role or higher to send invite tests`
      )
    }

    const actorEmail = normalizeInviteEmail(actor.email)
    if (
      parsed.data.toEmail &&
      normalizeInviteEmail(parsed.data.toEmail) !== actorEmail
    ) {
      return badRequest("Test invite emails can only be sent to the signed-in user's email")
    }
    const domainCheck = canInviteEmailByDomain({
      email: actorEmail,
      allowExternalDomains: policy.allowExternalDomains,
      allowedDomains: normalizeDomainList(
        Array.isArray(policy.allowedDomains) ? (policy.allowedDomains as string[]) : []
      ),
      blockedDomains: normalizeDomainList(
        Array.isArray(policy.blockedDomains) ? (policy.blockedDomains as string[]) : []
      ),
    })
    if (!domainCheck.ok) return badRequest(domainCheck.reason)

    const selectedTemplate = resolveInviteTemplateFromPolicy({
      templateKey: parsed.data.templateKey ?? "default",
      policyEmailSubjectTemplate:
        policy.emailSubjectTemplate ?? DEFAULT_INVITE_POLICY.emailSubjectTemplate,
      policyEmailBodyTemplate:
        policy.emailBodyTemplate ?? DEFAULT_INVITE_POLICY.emailBodyTemplate,
      policyTemplateCatalog: policy.templateCatalog,
    })

    const toEmail = actorEmail
    const role = parsed.data.role ?? policy.defaultInviteRole
    if (!isGenericWorkspaceRole(role)) {
      return badRequest("Ownership cannot be granted through invitations")
    }
    const rateLimit = await consumeWorkspaceInviteDeliveryRateLimit({
      action: "test",
      actorUserId: access.actor.userId,
      workspaceId: workspace.id,
      recipientEmail: toEmail,
    })
    if (!rateLimit.allowed) {
      return workspaceInviteRateLimitResponse(rateLimit.retryAfterSeconds)
    }
    const inviteUrl = `${getCanonicalPublicOrigin()}/login?invitePreview=1`
    const customMessage =
      parsed.data.customMessage ??
      "This is a test invite email from PlanGlade. No invite was created."

    const context = {
      workspaceName: workspace.name,
      inviterName: actor.name ?? actor.email,
      inviteeName: deriveInviteeName(toEmail),
      inviteeEmail: toEmail,
      role,
      inviteUrl,
      customMessage,
      inviteExpiryDays: policy.inviteExpiryDays,
    }

    const bodyTemplate =
      parsed.data.bodyTemplateOverride?.trim() || selectedTemplate.bodyTemplate
    const subjectTemplate =
      parsed.data.subjectTemplateOverride?.trim() || selectedTemplate.subjectTemplate
    const previewSubject = renderInviteTemplate(subjectTemplate, context)
    const previewBody = renderInviteTemplate(bodyTemplate, context)
    const deliverySubject = `PlanGlade invitation test for ${workspace.name}`
    const deliveryBody =
      `This is a PlanGlade invitation delivery test for ${workspace.name}.\n\n` +
      "No invitation was created, and no action is required."

    const delivery = await deliverWorkspaceInviteEmail({
      workspaceId: workspace.id,
      inviteId: `test-${Date.now()}`,
      tokenVersion: 1,
      email: toEmail,
      role,
      subject: deliverySubject,
      body: deliveryBody,
      idempotencyKey: buildWorkspaceInviteTestDeliveryIdempotencyKey({
        workspaceId: workspace.id,
        actorUserId: access.actor.userId,
        requestId,
      }),
    })

    if (!delivery.ok) {
      return NextResponse.json(
        {
          error: `Test email delivery failed: ${delivery.error}`,
          preview: { subject: previewSubject, body: previewBody },
          templateKey: selectedTemplate.key,
          toEmail,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      ok: true,
      templateKey: selectedTemplate.key,
      toEmail,
      preview: { subject: previewSubject, body: previewBody },
      delivery: {
        provider: delivery.provider,
        messageId: delivery.messageId,
      },
    })
  } catch (error) {
    return serverError("Failed to send test invite email", String(error))
  }
}
