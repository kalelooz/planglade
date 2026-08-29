import { useCallback, useState, useSyncExternalStore } from 'react'
import { createSubmissionLifecycle, runSubmission } from '@/lib/submission-lifecycle'

export function useSubmissionLifecycle() {
  const [lifecycle] = useState(createSubmissionLifecycle)
  const { pending } = useSyncExternalStore(lifecycle.subscribe, lifecycle.getSnapshot, lifecycle.getSnapshot)
  const invalidate = useCallback(() => lifecycle.invalidate(), [lifecycle])
  const submit = useCallback(<TInput, TResult>(
    input: TInput,
    execute: (input: TInput) => Promise<TResult>,
    succeeded: (result: TResult) => boolean,
    onSuccess: (result: TResult, input: TInput) => void,
  ) => runSubmission(lifecycle, input, execute, succeeded, onSuccess), [lifecycle])

  return { invalidate, pending, submit }
}
