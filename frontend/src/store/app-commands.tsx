import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createAppCommandDispatcher, type AppCommandDispatcher } from './app-command-dispatcher'

const Context = createContext<AppCommandDispatcher | null>(null)

export function AppCommandsProvider({ children }: { children: ReactNode }) {
  const dispatcher = useMemo(() => createAppCommandDispatcher(), [])
  return <Context.Provider value={dispatcher}>{children}</Context.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppCommands(): AppCommandDispatcher {
  const commands = useContext(Context)
  if (!commands) throw new Error('useAppCommands outside provider')
  return commands
}
