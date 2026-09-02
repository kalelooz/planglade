import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/errors'
import { reloadCollaborativeQueryOnConflict } from '@/lib/api/conflict-refresh'

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
})
