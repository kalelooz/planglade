export type DataMode = 'api' | 'reference'

export function resolveDataMode(mode = import.meta.env.MODE): DataMode {
  return mode === 'reference' ? 'reference' : 'api'
}

export const dataMode = resolveDataMode()
