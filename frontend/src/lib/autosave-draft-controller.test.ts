import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAutosaveDraftController } from '@/lib/autosave-draft-controller'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((next) => { resolve = next })
  return { promise, resolve }
}

describe('autosave draft controller', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('clears pending for a stale completion without clearing the newer draft', async () => {
    const first = deferred<boolean>()
    const save = vi.fn().mockReturnValueOnce(first.promise)
    const controller = createAutosaveDraftController({
      initialValue: 'server',
      save,
      delayMs: 10,
      valid: (value) => Boolean(value),
    })

    controller.edit('first')
    await vi.advanceTimersByTimeAsync(10)
    expect(controller.getSnapshot().saving).toBe(true)

    controller.edit('')
    first.resolve(true)
    await first.promise
    await Promise.resolve()

    expect(controller.getSnapshot()).toMatchObject({ value: '', dirty: true, saving: false, error: null })
  })

  it('awaits a pending stale write and persists the reverted normalized value before flush resolves', async () => {
    const stale = deferred<boolean>()
    const corrective = deferred<boolean>()
    const save = vi.fn()
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(corrective.promise)
    const controller = createAutosaveDraftController({
      initialValue: 'A',
      save,
      delayMs: 10,
      normalize: (value) => value.trim(),
    })

    controller.edit(' B ')
    await vi.advanceTimersByTimeAsync(10)
    controller.edit(' A ')

    let flushed = false
    const flush = controller.flush().then((saved) => {
      flushed = true
      return saved
    })
    await Promise.resolve()
    expect(flushed).toBe(false)

    stale.resolve(true)
    await stale.promise
    await vi.advanceTimersByTimeAsync(0)

    expect(save).toHaveBeenNthCalledWith(2, 'A')
    expect(controller.getSnapshot()).toMatchObject({ value: ' A ', dirty: true, saving: true, error: null })
    expect(flushed).toBe(false)

    corrective.resolve(true)
    await expect(flush).resolves.toBe(true)
    expect(controller.getSnapshot()).toMatchObject({ value: ' A ', dirty: false, saving: false, error: null })
  })

  it('immediately queues a corrective save when a stale completion leaves the current value dirty', async () => {
    const stale = deferred<boolean>()
    const corrective = deferred<boolean>()
    const save = vi.fn()
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(corrective.promise)
    const controller = createAutosaveDraftController({ initialValue: 'A', save, delayMs: 100 })

    controller.edit('B')
    await vi.advanceTimersByTimeAsync(100)
    controller.edit('C')

    stale.resolve(true)
    await stale.promise
    await vi.advanceTimersByTimeAsync(0)

    expect(save).toHaveBeenNthCalledWith(2, 'C')
    expect(controller.getSnapshot()).toMatchObject({ value: 'C', dirty: true, saving: true })

    corrective.resolve(true)
    await corrective.promise
    await Promise.resolve()
    expect(controller.getSnapshot()).toMatchObject({ value: 'C', dirty: false, saving: false, error: null })
  })

  it('flushes a valid draft immediately and leaves a visible error when persistence fails', async () => {
    const save = vi.fn().mockResolvedValue(false)
    const controller = createAutosaveDraftController({ initialValue: 'server', save, delayMs: 500 })

    controller.edit('draft')
    await expect(controller.flush()).resolves.toBe(false)

    expect(save).toHaveBeenCalledWith('draft')
    expect(controller.getSnapshot()).toMatchObject({ value: 'draft', dirty: true, saving: false, error: 'This change was not saved. Edit again to retry.' })
  })

  it('does not silently discard an invalid draft during flush', async () => {
    const controller = createAutosaveDraftController({
      initialValue: 'server',
      save: vi.fn().mockResolvedValue(true),
      valid: (value) => Boolean(value.trim()),
      invalidMessage: 'A title is required.',
    })

    controller.edit('   ')
    await expect(controller.flush()).resolves.toBe(false)
    expect(controller.getSnapshot()).toMatchObject({ value: '   ', dirty: true, error: 'A title is required.' })
  })
})
