export type SubmissionOperation = Readonly<{ id: number; generation: number }>

type SubmissionSnapshot = Readonly<{ pending: boolean }>

export interface SubmissionLifecycle {
  begin(): SubmissionOperation | null
  finish(operation: SubmissionOperation): boolean
  invalidate(): void
  getSnapshot(): SubmissionSnapshot
  subscribe(listener: () => void): () => void
}

export function createSubmissionLifecycle(): SubmissionLifecycle {
  let generation = 0
  let nextId = 0
  let pending: SubmissionOperation | null = null
  let snapshot: SubmissionSnapshot = { pending: false }
  const listeners = new Set<() => void>()

  const publish = () => {
    const next = { pending: pending !== null }
    if (next.pending === snapshot.pending) return
    snapshot = next
    listeners.forEach((listener) => listener())
  }

  return {
    begin() {
      if (pending) return null
      pending = { id: ++nextId, generation }
      publish()
      return pending
    },
    finish(operation) {
      if (pending?.id === operation.id) pending = null
      publish()
      return operation.generation === generation
    },
    invalidate() {
      generation += 1
    },
    getSnapshot() {
      return snapshot
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export async function runSubmission<TInput, TResult>(
  lifecycle: SubmissionLifecycle,
  input: TInput,
  execute: (input: TInput) => Promise<TResult>,
  succeeded: (result: TResult) => boolean,
  onSuccess: (result: TResult, input: TInput) => void,
): Promise<boolean> {
  const operation = lifecycle.begin()
  if (!operation) return false
  let finished = false
  try {
    const result = await execute(input)
    const current = lifecycle.finish(operation)
    finished = true
    const success = succeeded(result)
    if (success && current) onSuccess(result, input)
    return success
  } finally {
    if (!finished) lifecycle.finish(operation)
  }
}
