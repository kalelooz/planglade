import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/errors'
import { reloadCollaborativeQueryOnConflict } from '@/lib/api/conflict-refresh'
import { getNotes, updateNote } from '@/lib/api/notes'

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
})
