import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/errors'
import { reloadCollaborativeQueryOnConflict, reloadTaskQueriesOnConflict } from '@/lib/api/conflict-refresh'
import { getNotes, updateNote } from '@/lib/api/notes'
import { deleteTask, getInboxItems, getTaskSnapshot } from '@/lib/api/tasks'
import type { BackendWorkItem, WorkItemLaneVersions } from '@/lib/api/contracts'

afterEach(() => vi.unstubAllGlobals())

describe('collaborative conflict refresh', () => {
  it('reloads an active stale query with the winning server state', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    const queryKey = ['notes', 'workspace-1'] as const
    const stale = [{ id: 'note-1', title: 'Stale draft' }]
    const winning = [{ id: 'note-1', title: 'Saved elsewhere' }]
    let requests = 0
    queryClient.setQueryData(queryKey, stale)
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: async () => {
        requests += 1
        return winning
      },
      staleTime: Infinity,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    try {
      await reloadCollaborativeQueryOnConflict(
        queryClient,
        new ApiError('conflict', 409, 'The request could not be completed.'),
        queryKey,
      )
      expect(requests).toBe(1)
      expect(queryClient.getQueryData(queryKey)).toEqual(winning)
    } finally {
      unsubscribe()
      queryClient.clear()
    }
  })

  it('replaces a stale note cache after the real API client receives a 409', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    const queryKey = ['notes', 'workspace-1'] as const
    const stale = {
      id: 'note-1', workspaceId: 'workspace-1', projectId: null, title: 'Stale draft', body: null,
      visibility: 'WORKSPACE' as const, pinned: false, tags: [], createdById: 'user-1', updatedById: 'user-1',
      createdAt: '2026-09-02T10:00:00.000Z', updatedAt: '2026-09-02T10:00:00.000Z',
    }
    const winning = { ...stale, title: 'Saved elsewhere', updatedAt: '2026-09-02T10:00:01.000Z' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: 'Note changed since it was loaded', current: winning }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ notes: [winning] }))
    vi.stubGlobal('fetch', fetchMock)
    queryClient.setQueryData(queryKey, [stale])
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: ({ signal }) => getNotes('workspace-1', signal),
      staleTime: Infinity,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    try {
      const error = await updateNote('workspace-1', stale, { title: 'My stale edit' }).catch((caught) => caught)
      expect(error).toMatchObject({ kind: 'conflict', status: 409 })
      await reloadCollaborativeQueryOnConflict(queryClient, error, queryKey)
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(queryClient.getQueryData(queryKey)).toEqual([winning])
    } finally {
      unsubscribe()
      queryClient.clear()
    }
  })

  it('reloads active Tasks and Inbox projections after the real delete client receives a 409', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    const laneVersions: WorkItemLaneVersions = { BACKLOG: 1, TODO: 2, IN_PROGRESS: 3, IN_REVIEW: 4, DONE: 5 }
    const baseTask: BackendWorkItem = {
      id: 'task-1', workspaceId: 'workspace-1', projectId: null, title: 'Inbox draft', description: null,
      checklist: null, noteIds: null, status: 'BACKLOG', isInbox: true, priority: 'MEDIUM', startDate: null,
      dueDate: null, completedAt: null, sortOrder: 0, position: 1, createdById: 'user-1', assigneeId: null,
      parentId: null, createdAt: '2026-09-02T10:00:00.000Z', updatedAt: '2026-09-02T10:00:00.000Z', labels: [],
    }
    const otherTask = { ...baseTask, id: 'task-2', title: 'Stale task', isInbox: false, status: 'TODO' as const }
    const winningInbox = { ...baseTask, title: 'Inbox draft saved elsewhere', updatedAt: '2026-09-02T10:00:01.000Z' }
    const winningTask = { ...otherTask, title: 'Task saved elsewhere', updatedAt: '2026-09-02T10:00:01.000Z' }
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'DELETE') {
        return Response.json({ error: 'Work item changed since it was loaded', current: winningInbox, laneVersions }, { status: 409 })
      }
      if (url.includes('isInbox=true')) return Response.json({ workItems: [winningInbox], laneVersions })
      return Response.json({ workItems: [winningTask], laneVersions })
    })
    vi.stubGlobal('fetch', fetchMock)

    const tasksKey = ['tasks', 'workspace-1'] as const
    const inboxKey = ['inbox', 'workspace-1'] as const
    queryClient.setQueryData(tasksKey, { workItems: [otherTask], laneVersions })
    queryClient.setQueryData(inboxKey, [baseTask])
    const tasksObserver = new QueryObserver(queryClient, {
      queryKey: tasksKey,
      queryFn: ({ signal }) => getTaskSnapshot('workspace-1', signal),
      staleTime: Infinity,
    })
    const inboxObserver = new QueryObserver(queryClient, {
      queryKey: inboxKey,
      queryFn: ({ signal }) => getInboxItems('workspace-1', signal),
      staleTime: Infinity,
    })
    const unsubscribeTasks = tasksObserver.subscribe(() => undefined)
    const unsubscribeInbox = inboxObserver.subscribe(() => undefined)

    try {
      const error = await deleteTask('workspace-1', baseTask, undefined).catch((caught) => caught)
      expect(error).toMatchObject({ kind: 'conflict', status: 409 })
      await reloadTaskQueriesOnConflict(queryClient, error, 'workspace-1')
      expect(fetchMock).toHaveBeenCalledTimes(3)
      expect(queryClient.getQueryData(tasksKey)).toEqual({ workItems: [winningTask], laneVersions })
      expect(queryClient.getQueryData(inboxKey)).toEqual([winningInbox])
    } finally {
      unsubscribeTasks()
      unsubscribeInbox()
      queryClient.clear()
    }
  })
})
