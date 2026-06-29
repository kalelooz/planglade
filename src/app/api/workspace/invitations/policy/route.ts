import { NextRequest, NextResponse } from "next/server"

import {
  parseJsonBody,
  parseQuery,
  requireWorkspaceRole,
  resolveRequestActorUserId,
  serverError,
} from "@/lib/api-utils"
import {
  updateWorkspaceInvitePolicySchema,
  workspaceQuerySchema,
} from "@/lib/contracts"
import { db } from "@/lib/db"
import {
  DEFAULT_INVITE_POLICY,
  getOrCreateWorkspaceInvitePolicy,
  normalizeDomainList,
  normalizeTemplateCatalog,
} from "@/lib/workspace-invite-policy"

export async function GET(request: NextRequest) {
  const query = parseQuery(
    {
      workspaceId: request.nextUrl.searchParams.get("workspaceId") ?? undefined,
    },
    workspaceQuerySchema
  )
  if (!query.ok) return query.response

  try {
    const access = await requireWorkspaceRole(
      query.data.workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response

    const policy = await getOrCreateWorkspaceInvitePolicy(query.data.workspaceId)
    return NextResponse.json({
      policy: {
        id: policy.id,
        workspaceId: policy.workspaceId,
        allowExternalDomains: policy.allowExternalDomains,
        allowedDomains: normalizeDomainList(
          Array.isArray(policy.allowedDomains) ? (policy.allowedDomains as string[]) : []
        ),
        blockedDomains: normalizeDomainList(
          Array.isArray(policy.blockedDomains) ? (policy.blockedDomains as string[]) : []
        ),
        minimumInviterRole: policy.minimumInviterRole,
        defaultInviteRole: policy.defaultInviteRole,
        inviteExpiryDays: policy.inviteExpiryDays,
        emailSubjectTemplate:
          policy.emailSubjectTemplate ?? DEFAULT_INVITE_POLICY.emailSubjectTemplate,
        emailBodyTemplate: policy.emailBodyTemplate ?? DEFAULT_INVITE_POLICY.emailBodyTemplate,
        templateCatalog: normalizeTemplateCatalog(policy.templateCatalog),
      },
    })
  } catch (error) {
    return serverError("Failed to load workspace invite policy", String(error))
  }
}

export async function PUT(request: NextRequest) {
  const parsed = await parseJsonBody(request, updateWorkspaceInvitePolicySchema)
  if (!parsed.ok) return parsed.response

  try {
    const access = await requireWorkspaceRole(
      parsed.data.workspaceId,
      await resolveRequestActorUserId(request),
      "ADMIN"
    )
    if (!access.ok) return access.response

    const existing = await getOrCreateWorkspaceInvitePolicy(parsed.data.workspaceId)

    const updated = await db.workspaceInvitePolicy.update({
      where: { workspaceId: parsed.data.workspaceId },
      data: {
        ...(parsed.data.allowExternalDomains !== undefined
          ? { allowExternalDomains: parsed.data.allowExternalDomains }
          : {}),
        ...(parsed.data.allowedDomains
          ? { allowedDomains: normalizeDomainList(parsed.data.allowedDomains) }
          : {}),
        ...(parsed.data.blockedDomains
          ? { blockedDomains: normalizeDomainList(parsed.data.blockedDomains) }
          : {}),
        ...(parsed.data.minimumInviterRole
          ? { minimumInviterRole: parsed.data.minimumInviterRole }
          : {}),
        ...(parsed.data.defaultInviteRole
          ? { defaultInviteRole: parsed.data.defaultInviteRole }
          : {}),
        ...(parsed.data.inviteExpiryDays !== undefined
          ? { inviteExpiryDays: parsed.data.inviteExpiryDays }
          : {}),
        ...(parsed.data.emailSubjectTemplate !== undefined
          ? { emailSubjectTemplate: parsed.data.emailSubjectTemplate }
          : {}),
        ...(parsed.data.emailBodyTemplate !== undefined
          ? { emailBodyTemplate: parsed.data.emailBodyTemplate }
          : {}),
        ...(parsed.data.templateCatalog
          ? { templateCatalog: normalizeTemplateCatalog(parsed.data.templateCatalog) }
          : {}),
        updatedById: access.actor.userId,
      },
    })

    return NextResponse.json({
      policy: {
        id: updated.id,
        workspaceId: updated.workspaceId,
        allowExternalDomains: updated.allowExternalDomains,
        allowedDomains: normalizeDomainList(
          Array.isArray(updated.allowedDomains) ? (updated.allowedDomains as string[]) : []
        ),
        blockedDomains: normalizeDomainList(
          Array.isArray(updated.blockedDomains) ? (updated.blockedDomains as string[]) : []
        ),
        minimumInviterRole: updated.minimumInviterRole,
        defaultInviteRole: updated.defaultInviteRole,
        inviteExpiryDays: updated.inviteExpiryDays,
        emailSubjectTemplate:
          updated.emailSubjectTemplate ?? existing.emailSubjectTemplate ?? DEFAULT_INVITE_POLICY.emailSubjectTemplate,
        emailBodyTemplate:
          updated.emailBodyTemplate ?? existing.emailBodyTemplate ?? DEFAULT_INVITE_POLICY.emailBodyTemplate,
        templateCatalog: normalizeTemplateCatalog(updated.templateCatalog),
      },
    })
  } catch (error) {
    return serverError("Failed to update workspace invite policy", String(error))
  }
}
