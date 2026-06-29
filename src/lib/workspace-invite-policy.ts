import { Prisma, type WorkspaceRole } from "@prisma/client"

import { db } from "@/lib/db"

export const DEFAULT_INVITE_POLICY = {
  allowExternalDomains: true,
  allowedDomains: [] as string[],
  blockedDomains: [] as string[],
  minimumInviterRole: "ADMIN" as WorkspaceRole,
  defaultInviteRole: "MEMBER" as WorkspaceRole,
  inviteExpiryDays: 7,
  emailSubjectTemplate: "You're invited to join {{workspaceName}} on PlanGlade",
  emailBodyTemplate:
    "Hi {{inviteeName}},\n\n{{inviterName}} invited you to join {{workspaceName}} as {{role}}.\n{{customMessage}}\nUse this secure invite link: {{inviteUrl}}\n\nThis invite expires in {{inviteExpiryDays}} days.",
}

export type WorkspaceInviteTemplate = {
  key: string
  name: string
  subjectTemplate: string
  bodyTemplate: string
}

export type WorkspaceInvitePolicyLike = {
  id: string
  workspaceId: string
  allowExternalDomains: boolean
  allowedDomains: unknown
  blockedDomains: unknown
  minimumInviterRole: WorkspaceRole
  defaultInviteRole: WorkspaceRole
  inviteExpiryDays: number
  emailSubjectTemplate: string | null
  emailBodyTemplate: string | null
  templateCatalog: unknown
  updatedById: string | null
  createdAt: Date
  updatedAt: Date
}

function normalizeTemplateKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-")
}

export function normalizeTemplateCatalog(values: unknown): WorkspaceInviteTemplate[] {
  if (!Array.isArray(values)) return []
  const normalized: WorkspaceInviteTemplate[] = []
  const seen = new Set<string>()

  for (const raw of values) {
    if (!raw || typeof raw !== "object") continue
    const entry = raw as Record<string, unknown>
    const keyRaw = typeof entry.key === "string" ? entry.key : ""
    const nameRaw = typeof entry.name === "string" ? entry.name : ""
    const subjectRaw =
      typeof entry.subjectTemplate === "string" ? entry.subjectTemplate : ""
    const bodyRaw = typeof entry.bodyTemplate === "string" ? entry.bodyTemplate : ""

    const key = normalizeTemplateKey(keyRaw).slice(0, 64)
    const name = nameRaw.trim().slice(0, 80)
    const subjectTemplate = subjectRaw.trim().slice(0, 240)
    const bodyTemplate = bodyRaw.trim().slice(0, 6000)
    if (!key || !name || !subjectTemplate || !bodyTemplate) continue
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push({ key, name, subjectTemplate, bodyTemplate })
  }

  return normalized
}

export function normalizeDomain(value: string) {
  return value.trim().toLowerCase().replace(/^@/, "")
}

export function normalizeDomainList(values: string[] | null | undefined) {
  if (!values) return [] as string[]
  const unique = new Set<string>()
  for (const value of values) {
    const domain = normalizeDomain(value)
    if (!domain) continue
    unique.add(domain)
  }
  return [...unique]
}

export function extractEmailDomain(email: string) {
  const at = email.lastIndexOf("@")
  if (at < 0) return ""
  return normalizeDomain(email.slice(at + 1))
}

export function renderInviteTemplate(
  template: string,
  context: Record<string, string | number>
) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key: string) => {
    if (!(key in context)) return match
    return String(context[key] ?? "")
  })
}

function isInvitePolicyStorageMissingError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  return error.code === "P2021" || error.code === "P2022"
}

function buildEphemeralInvitePolicy(workspaceId: string): WorkspaceInvitePolicyLike {
  const now = new Date()
  return {
    id: `ephemeral-policy:${workspaceId}`,
    workspaceId,
    allowExternalDomains: DEFAULT_INVITE_POLICY.allowExternalDomains,
    allowedDomains: DEFAULT_INVITE_POLICY.allowedDomains,
    blockedDomains: DEFAULT_INVITE_POLICY.blockedDomains,
    minimumInviterRole: DEFAULT_INVITE_POLICY.minimumInviterRole,
    defaultInviteRole: DEFAULT_INVITE_POLICY.defaultInviteRole,
    inviteExpiryDays: DEFAULT_INVITE_POLICY.inviteExpiryDays,
    emailSubjectTemplate: DEFAULT_INVITE_POLICY.emailSubjectTemplate,
    emailBodyTemplate: DEFAULT_INVITE_POLICY.emailBodyTemplate,
    templateCatalog: [],
    updatedById: null,
    createdAt: now,
    updatedAt: now,
  }
}

export async function getOrCreateWorkspaceInvitePolicy(
  workspaceId: string
): Promise<WorkspaceInvitePolicyLike> {
  const invitePolicyDelegate = db.workspaceInvitePolicy
  if (!invitePolicyDelegate) {
    return buildEphemeralInvitePolicy(workspaceId)
  }

  try {
    const existing = await invitePolicyDelegate.findUnique({
      where: { workspaceId },
    })
    if (existing) return existing

    return await invitePolicyDelegate.create({
      data: {
        workspaceId,
        allowExternalDomains: DEFAULT_INVITE_POLICY.allowExternalDomains,
        allowedDomains: DEFAULT_INVITE_POLICY.allowedDomains,
        blockedDomains: DEFAULT_INVITE_POLICY.blockedDomains,
        minimumInviterRole: DEFAULT_INVITE_POLICY.minimumInviterRole,
        defaultInviteRole: DEFAULT_INVITE_POLICY.defaultInviteRole,
        inviteExpiryDays: DEFAULT_INVITE_POLICY.inviteExpiryDays,
        emailSubjectTemplate: DEFAULT_INVITE_POLICY.emailSubjectTemplate,
        emailBodyTemplate: DEFAULT_INVITE_POLICY.emailBodyTemplate,
        templateCatalog: [],
      },
    })
  } catch (error) {
    if (isInvitePolicyStorageMissingError(error)) {
      return buildEphemeralInvitePolicy(workspaceId)
    }
    throw error
  }
}

export function resolveInviteTemplateFromPolicy(input: {
  templateKey?: string | null
  policyEmailSubjectTemplate?: string | null
  policyEmailBodyTemplate?: string | null
  policyTemplateCatalog?: unknown
}) {
  const defaultTemplate = {
    key: "default",
    name: "Default",
    subjectTemplate:
      input.policyEmailSubjectTemplate ?? DEFAULT_INVITE_POLICY.emailSubjectTemplate,
    bodyTemplate: input.policyEmailBodyTemplate ?? DEFAULT_INVITE_POLICY.emailBodyTemplate,
  }

  const requestedKey = normalizeTemplateKey(input.templateKey ?? "default")
  if (!requestedKey || requestedKey === "default") return defaultTemplate

  const catalog = normalizeTemplateCatalog(input.policyTemplateCatalog)
  const matched = catalog.find((entry) => entry.key === requestedKey)
  if (!matched) return defaultTemplate

  return matched
}

export function canInviteEmailByDomain(input: {
  email: string
  allowExternalDomains: boolean
  allowedDomains: string[]
  blockedDomains: string[]
}) {
  const domain = extractEmailDomain(input.email)
  if (!domain) return { ok: false as const, reason: "Invite email domain is invalid" }

  const blocked = new Set(normalizeDomainList(input.blockedDomains))
  if (blocked.has(domain)) {
    return { ok: false as const, reason: `Domain ${domain} is blocked by workspace policy` }
  }

  const allowed = normalizeDomainList(input.allowedDomains)
  if (allowed.length > 0) {
    if (!allowed.includes(domain)) {
      return { ok: false as const, reason: `Domain ${domain} is not in the workspace allowlist` }
    }
    return { ok: true as const }
  }

  if (!input.allowExternalDomains) {
    return { ok: false as const, reason: "External domains are disabled by workspace policy" }
  }

  return { ok: true as const }
}
