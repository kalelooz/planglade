type Pending<TResult> = {
  key: string
  promise: Promise<TResult>
}

export function createTaskMutationQueue<TPatch, TResult = boolean>(run: (id: string, patch: TPatch) => Promise<TResult>) {
  const pending = new Map<string, Pending<TResult>>()

  return (id: string, patch: TPatch) => {
    const key = JSON.stringify(patch)
    const current = pending.get(id)
    if (current?.key === key) return current.promise

    const previous = current?.promise ?? Promise.resolve(undefined as TResult)
    const promise = previous.then(() => run(id, patch))
    pending.set(id, { key, promise })
    void promise.finally(() => {
      if (pending.get(id)?.promise === promise) pending.delete(id)
    })
    return promise
  }
}
