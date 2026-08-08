"use client"

import * as React from "react"

// ---------------------------------------------------------------------------
// Drawer Types
// ---------------------------------------------------------------------------

export type DrawerType = "task" | "project" | "note" | "member"

export interface DrawerEntry {
  type: DrawerType
  id: string
}

interface DrawerState {
  open: boolean
  drawerHistory: DrawerEntry[]
  historyIndex: number
  collapsed: boolean
  /** Navigation direction: 1 = forward, -1 = back. Used for animation. */
  direction: number
}

interface DrawerContextValue {
  /** Current drawer state */
  state: DrawerState
  /** Current entry (derived from history + index) */
  currentEntry: DrawerEntry | null
  /** Open the drawer for a specific entity type + id (pushes onto history) */
  openDrawer: (type: DrawerType, id: string) => void
  /** Close the drawer (clears history) */
  closeDrawer: () => void
  /** Navigate back in history */
  goBack: () => void
  /** Navigate forward in history */
  goForward: () => void
  /** Jump to a specific index in history (for breadcrumb clicks) */
  goToIndex: (index: number) => void
  /** Toggle collapsed/expanded state */
  toggleCollapsed: () => void
  /** Set collapsed state directly */
  setCollapsed: (collapsed: boolean) => void
  /** Can navigate back? */
  canGoBack: boolean
  /** Can navigate forward? */
  canGoForward: boolean
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const DrawerContext = React.createContext<DrawerContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function DrawerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<DrawerState>({
    open: false,
    drawerHistory: [],
    historyIndex: -1,
    collapsed: false,
    direction: 1,
  })

  const currentEntry = React.useMemo<DrawerEntry | null>(() => {
    if (state.historyIndex < 0 || state.drawerHistory.length === 0) return null
    return state.drawerHistory[state.historyIndex] ?? null
  }, [state.drawerHistory, state.historyIndex])

  const canGoBack = state.historyIndex > 0
  const canGoForward = state.historyIndex < state.drawerHistory.length - 1

  const openDrawer = React.useCallback((type: DrawerType, id: string) => {
    setState((prev) => {
      // If drawer is closed, start fresh history
      if (!prev.open) {
        return {
          ...prev,
          open: true,
          drawerHistory: [{ type, id }],
          historyIndex: 0,
          collapsed: false,
          direction: 1,
        }
      }

      // If the same entry is already at the current position, do nothing
      const current = prev.drawerHistory[prev.historyIndex]
      if (current && current.type === type && current.id === id) {
        return prev
      }

      // Push new entry, clearing any forward history (like browser)
      const newHistory = prev.drawerHistory.slice(0, prev.historyIndex + 1)
      newHistory.push({ type, id })

      return {
        ...prev,
        drawerHistory: newHistory,
        historyIndex: newHistory.length - 1,
        collapsed: false,
        direction: 1,
      }
    })
  }, [])

  const closeDrawer = React.useCallback(() => {
    setState((prev) => ({ ...prev, open: false }))
  }, [])

  const goBack = React.useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex <= 0) return prev
      return {
        ...prev,
        historyIndex: prev.historyIndex - 1,
        collapsed: false,
        direction: -1,
      }
    })
  }, [])

  const goForward = React.useCallback(() => {
    setState((prev) => {
      if (prev.historyIndex >= prev.drawerHistory.length - 1) return prev
      return {
        ...prev,
        historyIndex: prev.historyIndex + 1,
        collapsed: false,
        direction: 1,
      }
    })
  }, [])

  const goToIndex = React.useCallback((index: number) => {
    setState((prev) => {
      if (index < 0 || index >= prev.drawerHistory.length || index === prev.historyIndex) return prev
      return {
        ...prev,
        historyIndex: index,
        collapsed: false,
        direction: index > prev.historyIndex ? 1 : -1,
      }
    })
  }, [])

  const toggleCollapsed = React.useCallback(() => {
    setState((prev) => ({ ...prev, collapsed: !prev.collapsed }))
  }, [])

  const setCollapsed = React.useCallback((collapsed: boolean) => {
    setState((prev) => ({ ...prev, collapsed }))
  }, [])

  const value = React.useMemo(() => ({
    state,
    currentEntry,
    openDrawer,
    closeDrawer,
    goBack,
    goForward,
    goToIndex,
    toggleCollapsed,
    setCollapsed,
    canGoBack,
    canGoForward,
  }), [state, currentEntry, openDrawer, closeDrawer, goBack, goForward, goToIndex, toggleCollapsed, setCollapsed, canGoBack, canGoForward])

  return (
    <DrawerContext.Provider value={value}>
      {children}
    </DrawerContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDrawer(): DrawerContextValue {
  const ctx = React.useContext(DrawerContext)
  if (!ctx) {
    throw new Error("useDrawer must be used within a DrawerProvider")
  }
  return ctx
}
