"use client"

import { create } from "zustand"

export type ViewId = "dashboard" | "inbox" | "projects" | "timeline" | "calendar" | "my-tasks" | "notes" | "graph-view" | "activity-log" | "team" | "settings" | "project-report"

interface NavState {
  activeView: ViewId
  setActiveView: (view: ViewId) => void
  /** When navigating to Notes view from another view, pre-select this note */
  selectedNoteId: string | null
  setSelectedNoteId: (id: string | null) => void
  /** When navigating to Project Report view, pre-select this project */
  selectedProjectId: string | null
  setSelectedProjectId: (id: string | null) => void
}

export const useNavStore = create<NavState>((set) => ({
  activeView: "dashboard",
  setActiveView: (view) => set({ activeView: view }),
  selectedNoteId: null,
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),
  selectedProjectId: null,
  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
}))
