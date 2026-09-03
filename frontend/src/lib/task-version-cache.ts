import type { BackendWorkItem } from '@/lib/api/contracts'

export function replaceWorkspaceTaskVersions(
  versions: Map<string, string>,
  workspaceId: string,
  ...groups: Array<BackendWorkItem[] | undefined>
) {
  for (const key of versions.keys()) {
    if (key.startsWith(`${workspaceId}:`)) versions.delete(key)
  }
  for (const task of groups.flatMap((group) => group ?? [])) {
    versions.set(`${workspaceId}:${task.id}`, task.updatedAt)
  }
}

export async function refreshWorkspaceTaskVersions(
  versions: Map<string, string>,
  workspaceId: string,
  loadTasks: () => Promise<BackendWorkItem[]>,
  loadInbox: () => Promise<BackendWorkItem[]>,
  cancelInFlight: () => Promise<unknown>,
  resetFailed: (query: 'tasks' | 'inbox') => Promise<unknown> | unknown,
) {
  replaceWorkspaceTaskVersions(versions, workspaceId)
  await cancelInFlight()
  const results = await Promise.allSettled([loadTasks(), loadInbox()])
  await Promise.all(results.map((result, index) => result.status === 'rejected'
    ? resetFailed(index === 0 ? 'tasks' : 'inbox')
    : undefined))
  const refreshed = results.flatMap((result) => result.status === 'fulfilled' ? result.value : [])
  replaceWorkspaceTaskVersions(versions, workspaceId, refreshed)
}

export function currentWorkspaceTaskGeneration(generations: Map<string, number>, workspaceId: string) {
  return generations.get(workspaceId) ?? 0
}

export function advanceWorkspaceTaskGeneration(generations: Map<string, number>, workspaceId: string) {
  const generation = currentWorkspaceTaskGeneration(generations, workspaceId) + 1
  generations.set(workspaceId, generation)
  return generation
}

export function refreshSupersededWorkspaceTaskMutation(
  generations: Map<string, number>,
  workspaceId: string,
  mutationGeneration: number,
  refresh: () => Promise<void>,
) {
  return mutationGeneration === currentWorkspaceTaskGeneration(generations, workspaceId)
    ? null
    : refresh()
}
