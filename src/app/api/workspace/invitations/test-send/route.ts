import { NextRequest, NextResponse } from "next/server"

import {
  badRequest,
  parseJsonBody,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import { sendWorkspaceInviteTestEmailSchema } from "@/lib/contracts"
import { db } from "@/lib/db"
import { deliverWorkspaceInviteEmail } from "@/lib/workspace-invite-mailer"
import {
  DEFAULT_INVITE_POLICY,
  getOrCreateWorkspaceInvitePolicy,
  renderInviteTemplate,
  resolveInviteTemplateFromPolicy,
} from "@/lib/workspace-invite-policy"

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

  try {
    const actorUserId = await resolveRequestActorUserId(request)
    const access = await requireWorkspaceRole(parsed.data.workspaceId, actorUserId, "ADMIN")
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

    const selectedTemplate = resolveInviteTemplateFromPolicy({
      templateKey: parsed.data.templateKey ?? "default",
      policyEmailSubjectTemplate:
        policy.emailSubjectTemplate ?? DEFAULT_INVITE_POLICY.emailSubjectTemplate,
      policyEmailBodyTemplate:
        policy.emailBodyTemplate ?? DEFAULT_INVITE_POLICY.emailBodyTemplate,
      policyTemplateCatalog: policy.templateCatalog,
    })

    const toEmail = parsed.data.toEmail ?? actor.email
    const role = parsed.data.role ?? policy.defaultInviteRole
    const inviteUrl = `${request.nextUrl.origin}/login?invitePreview=1`
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
    const subject = renderInviteTemplate(subjectTemplate, context)
    const body = renderInviteTemplate(bodyTemplate, context)

    const delivery = await deliverWorkspaceInviteEmail({
      workspaceId: workspace.id,
      inviteId: `test-${Date.now()}`,
      email: toEmail,
      role,
      subject,
      body,
    })

    if (!delivery.ok) {
      return NextResponse.json(
        {
          error: `Test email delivery failed: ${delivery.error}`,
          preview: { subject, body },
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
      preview: { subject, body },
      delivery: {
        provider: delivery.provider,
        messageId: delivery.messageId,
      },
    })
  } catch (error) {
    return serverError("Failed to send test invite email", String(error))
  }
}
