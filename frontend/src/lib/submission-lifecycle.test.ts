import { describe, expect, it, vi } from 'vitest'
import { createSubmissionLifecycle, runSubmission } from '@/lib/submission-lifecycle'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((next, fail) => {
    resolve = next
    reject = fail
  })
  return { promise, reject, resolve }
}

describe('submission lifecycle', () => {
  it('guards duplicate submissions and always clears pending after failure', async () => {
    const lifecycle = createSubmissionLifecycle()
    const request = deferred<boolean>()
    const execute = vi.fn().mockReturnValue(request.promise)

    const first = runSubmission(lifecycle, { text: 'immutable' }, execute, Boolean, vi.fn())
    const duplicate = runSubmission(lifecycle, { text: 'duplicate' }, execute, Boolean, vi.fn())

    await expect(duplicate).resolves.toBe(false)
    expect(execute).toHaveBeenCalledTimes(1)
    request.reject(new Error('network failed'))
    await expect(first).rejects.toThrow('network failed')
    expect(lifecycle.getSnapshot().pending).toBe(false)
  })

  it('does not let an old completion clear a newer draft generation', async () => {
    const lifecycle = createSubmissionLifecycle()
    const request = deferred<boolean>()
    const onSuccess = vi.fn()
    const input = Object.freeze({ text: 'submitted' })

    const result = runSubmission(lifecycle, input, () => request.promise, Boolean, onSuccess)
    lifecycle.invalidate()
    request.resolve(true)

    await expect(result).resolves.toBe(true)
    expect(onSuccess).not.toHaveBeenCalled()
    expect(lifecycle.getSnapshot().pending).toBe(false)
  })
})
