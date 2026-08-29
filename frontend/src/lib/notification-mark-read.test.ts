import { describe, expect, it } from 'vitest'
import {
  beginNotificationMarkRead,
  completeNotificationMarkRead,
  createNotificationMarkReadRequest,
  failNotificationMarkRead,
  initialNotificationMarkReadState,
  retryNotificationMarkRead,
} from '@/lib/notification-mark-read'

describe('notification mark-read operations', () => {
  it('uses the newest fetched notification timestamp for mark-all', () => {
    const request = createNotificationMarkReadRequest('workspace-1', [
      { createdAt: '2026-08-29T10:00:00.000Z' },
      { createdAt: '2026-08-29T12:00:00.000Z' },
      { createdAt: '2026-08-29T11:00:00.000Z' },
    ])

    expect(request).toEqual({
      workspaceId: 'workspace-1',
      lastReadAt: '2026-08-29T12:00:00.000Z',
    })
  })

  it('marks selected notifications without adding a client-clock cursor', () => {
    expect(createNotificationMarkReadRequest(
      'workspace-1',
      [{ createdAt: '2026-08-29T12:00:00.000Z' }],
      ['notification-1'],
    )).toEqual({
      workspaceId: 'workspace-1',
      notificationIds: ['notification-1'],
    })
  })

  it('prevents overlap and retains the failed request until its retry succeeds', () => {
    const first = { workspaceId: 'workspace-1', notificationIds: ['notification-1'] }
    const second = { workspaceId: 'workspace-1', notificationIds: ['notification-2'] }
    const pending = beginNotificationMarkRead(initialNotificationMarkReadState, first)

    expect(beginNotificationMarkRead(pending, second)).toBe(pending)

    const failed = failNotificationMarkRead(pending, first)
    expect(failed.failedRequest).toBe(first)
    expect(beginNotificationMarkRead(failed, second)).toBe(failed)

    const retrying = retryNotificationMarkRead(failed)
    expect(retrying.pendingRequest).toBe(first)
    expect(retrying.failedRequest).toBe(first)
    expect(completeNotificationMarkRead(retrying, first)).toEqual(initialNotificationMarkReadState)
  })
})
