export interface AppCommandMap {
  'open-command-palette': undefined
  'open-support': undefined
  'open-task': { taskId: string }
  'task-deleted': { taskId: string }
}

type CommandName = keyof AppCommandMap
type CommandArgs<K extends CommandName> = AppCommandMap[K] extends undefined
  ? [command: K]
  : [command: K, payload: AppCommandMap[K]]

export interface AppCommandDispatcher {
  dispatch<K extends CommandName>(...args: CommandArgs<K>): void
  subscribe<K extends CommandName>(command: K, handler: (payload: AppCommandMap[K]) => void): () => void
}

export function createAppCommandDispatcher(): AppCommandDispatcher {
  const listeners = new Map<CommandName, Set<(payload: unknown) => void>>()

  return {
    dispatch: (...args) => {
      const [command, payload] = args as [CommandName, unknown]
      for (const handler of listeners.get(command) ?? []) handler(payload)
    },
    subscribe: (command, handler) => {
      const handlers = listeners.get(command) ?? new Set<(payload: unknown) => void>()
      handlers.add(handler as (payload: unknown) => void)
      listeners.set(command, handlers)
      return () => {
        handlers.delete(handler as (payload: unknown) => void)
        if (handlers.size === 0) listeners.delete(command)
      }
    },
  }
}
