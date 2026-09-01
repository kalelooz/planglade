import * as React from 'react'

export const OverlayPortalContainer = React.createContext<HTMLElement | null>(null)

export function assignElementRef(ref: React.Ref<HTMLDivElement> | undefined, value: HTMLDivElement | null) {
  if (typeof ref === 'function') ref(value)
  else if (ref) ref.current = value
}
