import { afterEach, describe, expect, it, vi } from 'vitest'
import { createWorkItemComment, getWorkItemComments } from '@/lib/api/comments'
import { getNotifications, markNotificationsRead } from '@/lib/api/notifications'
import {
  acceptWorkspaceInvite,
  getWorkspaceMembers,
  previewWorkspaceInvite,
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '@/lib/api/team'

afterEach(() => vi.unstubAllGlobals())

const user = { id: 'user-1', email: 'owner@example.test', name: 'Owner' }
const member = { userId: 'user-1', role: 'OWNER', joinedAt: '2026-08-01T10:00:00.000Z', user }

describe('collaboration API clients', () => {
  it('shapes member management requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ members: [member] }))
      .mockResolvedValueOnce(Response.json({ member: { ...member, role: 'ADMIN' } }))
      .mockResolvedValueOnce(Response.json({ deleted: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getWorkspaceMembers('workspace 1')).resolves.toEqual([member])
    await expect(updateWorkspaceMemberRole('workspace 1', 'member/1', 'ADMIN')).resolves.toMatchObject({ role: 'ADMIN' })
    await expect(removeWorkspaceMember('workspace 1', 'member/1')).resolves.toEqual({ deleted: true })

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/workspace/members?workspaceId=workspace%201',
      '/api/workspace/members/member%2F1',
      '/api/workspace/members/member%2F1?workspaceId=workspace%201',
    ])
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual({ workspaceId: 'workspace 1', role: 'ADMIN' })
  })

  it('shapes comment and notification requests', async () => {
    const comment = { id: 'comment-1', body: 'Ready', createdAt: '2026-08-01T10:00:00.000Z', updatedAt: '2026-08-01T10:00:00.000Z', author: user }
    const feed = { notifications: [], unreadCount: 0, lastReadAt: null, preferences: {} }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ comments: [comment] }))
      .mockResolvedValueOnce(Response.json({ comment }, { status: 201 }))
      .mockResolvedValueOnce(Response.json(feed))
      .mockResolvedValueOnce(Response.json({ markedReadAt: '2026-08-01T10:05:00.000Z' }))
      .mockResolvedValueOnce(Response.json({ markedReadAt: '2026-08-01T10:06:00.000Z' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getWorkItemComments('workspace 1', 'task/1')).resolves.toEqual([comment])
    await expect(createWorkItemComment('workspace 1', 'task/1', { body: 'Ready' })).resolves.toEqual(comment)
    await expect(getNotifications('workspace 1', 10)).resolves.toEqual(feed)
    await expect(markNotificationsRead('workspace 1', ['notification-1'])).resolves.toEqual({ markedReadAt: '2026-08-01T10:05:00.000Z' })
    await expect(markNotificationsRead('workspace 1', undefined, '2026-08-01T10:06:00.000Z')).resolves.toEqual({ markedReadAt: '2026-08-01T10:06:00.000Z' })

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/work-items/task%2F1/comments?workspaceId=workspace%201',
      '/api/work-items/task%2F1/comments?workspaceId=workspace%201',
      '/api/notifications?workspaceId=workspace%201&limit=10',
      '/api/notifications',
      '/api/notifications',
    ])
    expect(JSON.parse(fetchMock.mock.calls[4]?.[1].body)).toEqual({
      workspaceId: 'workspace 1',
      lastReadAt: '2026-08-01T10:06:00.000Z',
    })
  })

  it('treats gone invitation previews and acceptances as unavailable', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ code: 'INVITATION_EXPIRED' }, { status: 410 }))
      .mockResolvedValueOnce(Response.json({ code: 'INVITATION_EXPIRED' }, { status: 410 }))
    vi.stubGlobal('fetch', fetchMock)

    const token = 'invite-review-token-123456'
    await expect(previewWorkspaceInvite(token)).rejects.toMatchObject({ kind: 'not_found', status: 410 })
    await expect(acceptWorkspaceInvite(token)).rejects.toMatchObject({ kind: 'not_found', status: 410 })
  })

  it('previews an invitation before sending explicit acceptance', async () => {
    const review = {
      email: 'member@example.test',
      role: 'MEMBER',
      status: 'PENDING',
      expiresAt: '2026-09-01T10:00:00.000Z',
      customMessage: null,
      alreadyAccepted: false,
      workspace: { id: 'workspace-1', name: 'Launch', slug: 'launch' },
      invitedBy: user,
    }
    const acceptance = {
      accepted: true,
      workspace: review.workspace,
      member: { userId: 'user-2', role: 'MEMBER', joinedAt: '2026-08-01T10:00:00.000Z' },
    }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ review }))
      .mockResolvedValueOnce(Response.json(acceptance))
    vi.stubGlobal('fetch', fetchMock)

    const token = 'invite-review-token-123456'
    await expect(previewWorkspaceInvite(token)).resolves.toEqual(review)
    await expect(acceptWorkspaceInvite(token)).resolves.toEqual(acceptance)
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({ token })
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual({ token, confirmed: true })
  })
})
