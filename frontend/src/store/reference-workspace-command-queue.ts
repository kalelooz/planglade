import type { WorkspaceState } from '@/types'

export type ReferenceWorkspaceCommand<TResult> = (state: WorkspaceState) => {
  state: WorkspaceState
  result: TResult
}

export function createReferenceWorkspaceCommandQueue(
  initialState: WorkspaceState,
  persist: (state: WorkspaceState) => void | Promise<void>,
  commit: (state: WorkspaceState) => void,
) {
  let durableState = initialState
  let tail = Promise.resolve()

  return <TResult>(command: ReferenceWorkspaceCommand<TResult>): Promise<TResult> => {
    const run = async () => {
      const outcome = command(structuredClone(durableState))
      const nextState = structuredClone(outcome.state)
      await persist(nextState)
      durableState = nextState
      commit(durableState)
      return outcome.result
    }
    const result = tail.then(run)
    tail = result.then(() => undefined, () => undefined)
    return result
  }
}
