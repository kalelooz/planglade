"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

import {
  createQuickCaptureTask,
  getSeedWorkspaceData,
  toggleTaskDone,
  type WorkspaceData,
  type WorkspaceTask,
} from "@/components/flowboard/workspace-model"

interface WorkspaceStore extends WorkspaceData {
  quickCaptureTask: (title: string) => WorkspaceTask | null
  toggleTaskDone: (taskId: string) => void
  resetWorkspace: () => void
}

const seedWorkspaceData = getSeedWorkspaceData()

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set, get) => ({
      ...seedWorkspaceData,
      quickCaptureTask: (title) => {
        const task = createQuickCaptureTask({ title })
        if (!task) return null

        set((state) => ({
          tasks: [task, ...state.tasks],
        }))

        return task
      },
      toggleTaskDone: (taskId) => {
        set((state) => ({
          tasks: toggleTaskDone(state.tasks, taskId),
        }))
      },
      resetWorkspace: () => {
        set(getSeedWorkspaceData())
      },
    }),
    {
      name: "flowboard-workspace-v1",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        tasks: state.tasks,
        projects: state.projects,
      }),
    }
  )
)
