import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'

import type { BackendWorkItem } from '@/lib/api/contracts'
import {
  advanceWorkspaceTaskGeneration,
  currentWorkspaceTaskGeneration,
  refreshSupersededWorkspaceTaskMutation,
  refreshWorkspaceTaskVersions,
  replaceWorkspaceTaskVersions,
} from '@/lib/task-version-cache'

function task(id: string, updatedAt: string) {
  return { id, updatedAt } as BackendWorkItem
}

describe('replaceWorkspaceTaskVersions', () => {
  it('drops stale workspace versions and repopulates task and inbox results', () => {
    const versions = new Map([
      ['workspace-a:stale', 'old'],
      ['workspace-b:kept', 'other'],
    ])

    replaceWorkspaceTaskVersions(
      versions,
      'workspace-a',
      [task('task-1', 'fresh-task')],
      [task('inbox-1', 'fresh-inbox')],
    )

    expect(Object.fromEntries(versions)).toEqual({
      'workspace-a:task-1': 'fresh-task',
      'workspace-a:inbox-1': 'fresh-inbox',
      'workspace-b:kept': 'other',
    })
  })

  it('keeps stale versions cleared when task and inbox refreshes fail', async () => {
    const versions = new Map([
      ['workspace-a:stale', 'old'],
      ['workspace-b:kept', 'other'],
    ])

    await refreshWorkspaceTaskVersions(
      versions,
      'workspace-a',
      async () => { throw new Error('task refresh failed') },
      async () => { throw new Error('inbox refresh failed') },
      async () => undefined,
      async () => undefined,
    )

    expect(Object.fromEntries(versions)).toEqual({ 'workspace-b:kept': 'other' })
  })

  it('records only confirmed successful refresh results', async () => {
    const versions = new Map([['workspace-a:stale', 'old']])

    await refreshWorkspaceTaskVersions(
      versions,
      'workspace-a',
      async () => [task('task-1', 'fresh-task')],
      async () => { throw new Error('inactive inbox') },
      async () => undefined,
      async () => undefined,
    )

    expect(Object.fromEntries(versions)).toEqual({ 'workspace-a:task-1': 'fresh-task' })
  })

  it('cancels older fetches before starting post-mutation refreshes', async () => {
    const events: string[] = []

    await refreshWorkspaceTaskVersions(
      new Map(),
      'workspace-a',
      async () => { events.push('tasks'); return [] },
      async () => { events.push('inbox'); return [] },
      async () => { events.push('cancel') },
      async () => undefined,
    )

    expect(events[0]).toBe('cancel')
    expect(events.slice(1).sort()).toEqual(['inbox', 'tasks'])
  })

  it('resets stale QueryClient data when a post-delete fetch fails', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const queryKey = ['tasks', 'workspace-a'] as const
    const staleSnapshot = { workItems: [task('deleted-note-link', 'stale')], laneVersions: {} }
    queryClient.setQueryData(queryKey, staleSnapshot)
    const observer = new QueryObserver(queryClient, {
      queryKey,
      queryFn: async () => { throw new Error('offline after delete') },
      enabled: false,
    })
    const unsubscribe = observer.subscribe(() => undefined)

    await refreshWorkspaceTaskVersions(
      new Map([['workspace-a:deleted-note-link', 'stale']]),
      'workspace-a',
      async () => {
        await queryClient.fetchQuery({
          queryKey,
          queryFn: async () => { throw new Error('offline after delete') },
          retry: false,
        })
        return []
      },
      async () => [],
      async () => undefined,
      (failedQuery) => queryClient.resetQueries({
        queryKey: [failedQuery, 'workspace-a'],
        exact: true,
      }),
    )

    expect(queryClient.getQueryData(queryKey)).toBeUndefined()
    expect(observer.getCurrentResult().data).toBeUndefined()
    unsubscribe()
    queryClient.clear()
  })

  it('invalidates operation generations started before an external task rewrite', () => {
    const generations = new Map<string, number>()
    const startedBeforeDeletion = currentWorkspaceTaskGeneration(generations, 'workspace-a')

    const afterDeletion = advanceWorkspaceTaskGeneration(generations, 'workspace-a')

    expect(startedBeforeDeletion).toBe(0)
    expect(afterDeletion).toBe(1)
    expect(startedBeforeDeletion).not.toBe(currentWorkspaceTaskGeneration(generations, 'workspace-a'))
    expect(currentWorkspaceTaskGeneration(generations, 'workspace-b')).toBe(0)
  })

  it('refreshes a valid mutation that commits after the deletion refresh', async () => {
    const generations = new Map<string, number>()
    const mutationGeneration = currentWorkspaceTaskGeneration(generations, 'workspace-a')
    const committedTask = task('task-after-delete', 'committed-after-refresh')
    let serverTasks: BackendWorkItem[] = []
    let cachedTasks: BackendWorkItem[] = [task('before-delete', 'old')]

    advanceWorkspaceTaskGeneration(generations, 'workspace-a')
    cachedTasks = [...serverTasks]
    serverTasks = [committedTask]

    const refresh = refreshSupersededWorkspaceTaskMutation(
      generations,
      'workspace-a',
      mutationGeneration,
      async () => { cachedTasks = [...serverTasks] },
    )
    expect(refresh).not.toBeNull()
    await refresh

    expect(cachedTasks).toEqual([committedTask])
  })
})
