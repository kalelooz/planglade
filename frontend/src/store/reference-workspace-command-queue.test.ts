import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceState } from '@/types'
import { createReferenceWorkspaceCommandQueue } from '@/store/reference-workspace-command-queue'

function fixture(): WorkspaceState {
  return {
    workspaceName: 'Durable', userName: 'Owner', projects: [], tasks: [], notes: [], inbox: [],
    people: [], labels: [], recents: [], settings: { theme: 'system', priorityDisplay: 'icon', weekStartsOn: 1, hideHomeCompleted: false },
  }
}

describe('reference workspace command queue', () => {
  it('publishes state and results only after the snapshot is persisted', async () => {
    let releaseSave: (() => void) | undefined
    const persist = vi.fn(() => new Promise<void>((resolve) => { releaseSave = resolve }))
    const committed: WorkspaceState[] = []
    const queue = createReferenceWorkspaceCommandQueue(fixture(), persist, (state) => committed.push(state))

    const result = queue((state) => ({ state: { ...state, workspaceName: 'Saved' }, result: 'done' }))

    expect(committed).toEqual([])
    await Promise.resolve()
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ workspaceName: 'Saved' }))
    releaseSave?.()
    await expect(result).resolves.toBe('done')
    expect(committed.map((state) => state.workspaceName)).toEqual(['Saved'])
  })

  it('retains the prior durable snapshot after failure and continues with the next command', async () => {
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error('storage full'))
      .mockResolvedValueOnce(undefined)
    const committed: WorkspaceState[] = []
    const queue = createReferenceWorkspaceCommandQueue(fixture(), persist, (state) => committed.push(state))

    const failed = queue((state) => ({ state: { ...state, workspaceName: 'Lost' }, result: false }))
    const recovered = queue((state) => ({ state: { ...state, userName: `${state.workspaceName} owner` }, result: true }))

    await expect(failed).rejects.toThrow('storage full')
    await expect(recovered).resolves.toBe(true)
    expect(persist).toHaveBeenNthCalledWith(2, expect.objectContaining({ workspaceName: 'Durable', userName: 'Durable owner' }))
    expect(committed).toEqual([expect.objectContaining({ workspaceName: 'Durable', userName: 'Durable owner' })])
  })

  it('isolates the durable snapshot from in-place command mutation when persistence fails', async () => {
    const persist = vi.fn()
      .mockRejectedValueOnce(new Error('storage full'))
      .mockResolvedValueOnce(undefined)
    const queue = createReferenceWorkspaceCommandQueue(fixture(), persist, () => undefined)

    const failed = queue((state) => {
      state.workspaceName = 'Mutated'
      return { state, result: false }
    })
    const recovered = queue((state) => ({
      state: { ...state, userName: `${state.workspaceName} owner` },
      result: true,
    }))

    await expect(failed).rejects.toThrow('storage full')
    await expect(recovered).resolves.toBe(true)
    expect(persist).toHaveBeenNthCalledWith(2, expect.objectContaining({
      workspaceName: 'Durable',
      userName: 'Durable owner',
    }))
  })

  it('runs overlapping successful commands in FIFO order from the latest durable state', async () => {
    let releaseFirst: (() => void) | undefined
    const persist = vi.fn()
      .mockImplementationOnce(() => new Promise<void>((resolve) => { releaseFirst = resolve }))
      .mockResolvedValueOnce(undefined)
    const committed: WorkspaceState[] = []
    const queue = createReferenceWorkspaceCommandQueue(fixture(), persist, (state) => committed.push(state))
    let secondRan = false

    const first = queue((state) => ({ state: { ...state, workspaceName: 'First' }, result: 'first' }))
    const second = queue((state) => {
      secondRan = true
      return { state: { ...state, userName: `${state.workspaceName} owner` }, result: 'second' }
    })

    await Promise.resolve()
    expect(secondRan).toBe(false)
    expect(persist).toHaveBeenCalledTimes(1)
    releaseFirst?.()

    await expect(first).resolves.toBe('first')
    await expect(second).resolves.toBe('second')
    expect(persist).toHaveBeenNthCalledWith(2, expect.objectContaining({ workspaceName: 'First', userName: 'First owner' }))
    expect(committed.map((state) => [state.workspaceName, state.userName])).toEqual([
      ['First', 'Owner'],
      ['First', 'First owner'],
    ])
  })
})
