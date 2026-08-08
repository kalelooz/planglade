import { describe, expect, it, vi } from 'vitest'
import { createTaskMutationQueue } from '@/lib/task-mutation-queue'

describe('task mutation queue', () => {
  it('deduplicates the same rapid action and serializes a newer action', async () => {
    const calls: Array<{ id: string; patch: { status: string }; resolve: (value: boolean) => void }> = []
    const run = vi.fn((id: string, patch: { status: string }) => new Promise<boolean>((resolve) => {
      calls.push({ id, patch, resolve })
    }))
    const queue = createTaskMutationQueue(run)

    const first = queue('task-1', { status: 'done' })
    const duplicate = queue('task-1', { status: 'done' })
    const newer = queue('task-1', { status: 'planned' })

    expect(duplicate).toBe(first)
    await Promise.resolve()
    expect(run).toHaveBeenCalledTimes(1)
    calls[0]?.resolve(true)
    await expect(first).resolves.toBe(true)
    await Promise.resolve()
    expect(run).toHaveBeenCalledTimes(2)
    calls[1]?.resolve(true)
    await expect(newer).resolves.toBe(true)
    expect(calls.map(({ id, patch }) => ({ id, patch }))).toEqual([
      { id: 'task-1', patch: { status: 'done' } },
      { id: 'task-1', patch: { status: 'planned' } },
    ])
  })
})
