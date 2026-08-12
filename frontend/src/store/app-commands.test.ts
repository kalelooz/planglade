import { describe, expect, it, vi } from 'vitest'
import { createAppCommandDispatcher } from './app-command-dispatcher'

describe('app command dispatcher', () => {
  it('delivers typed payloads and stops after unsubscribe', () => {
    const commands = createAppCommandDispatcher()
    const handler = vi.fn()
    const unsubscribe = commands.subscribe('open-task', handler)

    commands.dispatch('open-task', { taskId: 'task-1' })
    unsubscribe()
    commands.dispatch('open-task', { taskId: 'task-2' })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith({ taskId: 'task-1' })
  })
})
