import { z } from 'zod'
import { deleteJson, getJson, sendJson } from '@/lib/api/client'

const workspaceRoleSchema = z.enum(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
const inviteRoleSchema = z.enum(['ADMIN', 'MEMBER', 'VIEWER'])
const inviteStatusSchema = z.enum(['PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED'])
const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullable(),
}).passthrough()
const memberSchema = z.object({
  userId: z.string(),
  role: workspaceRoleSchema,
  joinedAt: z.string(),
  user: userSchema,
}).passthrough()
const inviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: workspaceRoleSchema,
  status: inviteStatusSchema,
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  invitedBy: userSchema.optional(),
  customMessage: z.string().nullable().optional(),
  templateKey: z.string().nullable().optional(),
  lastDeliveryProvider: z.string().nullable().optional(),
  lastDeliveryMessageId: z.string().nullable().optional(),
  lastDeliveryError: z.string().nullable().optional(),
  lastDeliveredAt: z.string().nullable().optional(),
}).passthrough()
const inviteReviewSchema = z.object({
  email: z.string().email(),
  role: inviteRoleSchema,
  status: inviteStatusSchema,
  expiresAt: z.string(),
  customMessage: z.string().nullable(),
  alreadyAccepted: z.boolean(),
  workspace: z.object({ id: z.string(), name: z.string(), slug: z.string() }).passthrough(),
  invitedBy: userSchema,
}).passthrough()
const teamEventSchema = z.object({
  id: z.string(),
  action: z.enum(['CREATED', 'UPDATED', 'MOVED', 'COMPLETED', 'DELETED', 'COMMENTED', 'ASSIGNED', 'UNASSIGNED']),
  summary: z.string().nullable(),
  createdAt: z.string(),
  metadata: z.unknown().nullable(),
  actor: userSchema.nullable(),
}).passthrough()

export type WorkspaceMember = z.infer<typeof memberSchema>
export type WorkspaceInvite = z.infer<typeof inviteSchema>
export type WorkspaceInviteRole = z.infer<typeof inviteRoleSchema>
export type WorkspaceInviteReview = z.infer<typeof inviteReviewSchema>

export async function getWorkspaceMembers(workspaceId: string, signal?: AbortSignal) {
  const response = await getJson(
    `/api/workspace/members?workspaceId=${encodeURIComponent(workspaceId)}`,
    z.object({ members: z.array(memberSchema) }).passthrough(),
    signal,
  )
  return response.members
}

export async function getWorkspaceInvites(workspaceId: string, status?: z.infer<typeof inviteStatusSchema>, signal?: AbortSignal) {
  const statusQuery = status === undefined ? '' : `&status=${encodeURIComponent(status)}`
  const response = await getJson(
    `/api/workspace/invitations?workspaceId=${encodeURIComponent(workspaceId)}${statusQuery}`,
    z.object({ invites: z.array(inviteSchema) }).passthrough(),
    signal,
  )
  return response.invites
}

export function createWorkspaceInvite(input: { workspaceId: string; email: string; role: WorkspaceInviteRole; customMessage?: string }, signal?: AbortSignal) {
  const body = z.object({
    workspaceId: z.string().min(1),
    email: z.string().email(),
    role: inviteRoleSchema,
    customMessage: z.string().optional(),
  }).parse(input)
  return sendJson(
    '/api/workspace/invitations',
    'POST',
    body,
    z.object({ invite: inviteSchema }).passthrough(),
    signal,
  ).then((response) => response.invite)
}

export function updateWorkspaceInvite(workspaceId: string, inviteId: string, action: 'revoke' | 'resend', signal?: AbortSignal) {
  return sendJson(
    `/api/workspace/invitations/${encodeURIComponent(inviteId)}`,
    'PATCH',
    { workspaceId, action },
    z.object({ invite: inviteSchema }).passthrough(),
    signal,
  ).then((response) => response.invite)
}

export function updateWorkspaceMemberRole(workspaceId: string, memberUserId: string, role: WorkspaceInviteRole, signal?: AbortSignal) {
  return sendJson(
    `/api/workspace/members/${encodeURIComponent(memberUserId)}`,
    'PATCH',
    { workspaceId, role },
    z.object({ member: memberSchema }).passthrough(),
    signal,
  ).then((response) => response.member)
}

export function removeWorkspaceMember(workspaceId: string, memberUserId: string, signal?: AbortSignal) {
  return deleteJson(
    `/api/workspace/members/${encodeURIComponent(memberUserId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    z.object({ deleted: z.literal(true) }).passthrough(),
    signal,
  )
}

export function previewWorkspaceInvite(token: string, signal?: AbortSignal) {
  const inviteToken = z.string().trim().min(20).max(256).parse(token)
  return sendJson(
    '/api/workspace/invitations/preview',
    'POST',
    { token: inviteToken },
    z.object({ review: inviteReviewSchema }).passthrough(),
    signal,
  ).then((response) => response.review)
}

export function acceptWorkspaceInvite(token: string, signal?: AbortSignal) {
  const inviteToken = z.string().trim().min(20).max(256).parse(token)
  return sendJson(
    '/api/workspace/invitations/accept',
    'POST',
    { token: inviteToken, confirmed: true },
    z.object({
      accepted: z.literal(true),
      workspace: z.object({ id: z.string(), name: z.string(), slug: z.string() }).passthrough(),
      member: z.object({ userId: z.string(), role: workspaceRoleSchema, joinedAt: z.string() }).passthrough(),
    }).passthrough(),
    signal,
  )
}

export async function getWorkspaceTeamEvents(workspaceId: string, limit?: number, signal?: AbortSignal) {
  const limitQuery = limit === undefined ? '' : `&limit=${encodeURIComponent(String(limit))}`
  const response = await getJson(
    `/api/workspace/team-events?workspaceId=${encodeURIComponent(workspaceId)}${limitQuery}`,
    z.object({ events: z.array(teamEventSchema) }).passthrough(),
    signal,
  )
  return response.events
}
