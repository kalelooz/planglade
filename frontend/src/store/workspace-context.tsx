/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type {
  WorkspaceState, Task, Note, InboxItem, Project, ProjectStatus, AppSettings, Priority, RecentItem,
} from '@/types'
import type { ProjectMutationPatch } from '@/lib/api/projects'

export type TaskPatch = Partial<Omit<Task, 'id' | 'history' | 'source'>> & { beforeId?: string | null }
export type WorkspaceNotePatch = Pick<Partial<Note>, 'title' | 'content' | 'projectId'>

export type WorkspaceMode =
  | { kind: 'server' }
  | { kind: 'reference'; mutable: true }

export interface WorkspaceIdentity {
  mode: WorkspaceMode
  workspaceId: string | null
  workspaces: Array<{ id: string; slug: string; name: string; role: string }>
  switchWorkspace: (workspaceId: string) => void
  createWorkspace: (name: string) => Promise<boolean>
}

export interface WorkspaceCapabilities {
  canManageWorkspace: boolean
  canMutateTasks: boolean
  taskMutationPending: boolean
  canMutateNotes: boolean
  noteMutationPending: boolean
  supportsBlockedStatus: boolean
  supportsNoPriority: boolean
  supportsTaskHistory: boolean
  supportsCompletedProjectStatus: boolean
  deletionIsRecoverable: boolean
}

export interface WorkspaceData {
  connectionsData: {
    notes: 'loading' | 'ready' | 'error'
    relations: 'loading' | 'ready' | 'error'
    relationLimitReached: boolean
  }
  state: WorkspaceState
  tasks: Task[]
  projects: Project[]
  notes: Note[]
  inbox: InboxItem[]
  getTask: (id: string | null | undefined) => Task | undefined
  getProject: (id: string | null | undefined) => Project | undefined
  getNote: (id: string | null | undefined) => Note | undefined
  subtasksOf: (taskId: string) => Task[]
  isBlocked: (task: Task) => boolean
  blockersOf: (task: Task) => Task[]
  projectProgress: (projectId: string) => { done: number; total: number }
}

export interface WorkspaceActions {
  updateSettings: (patch: Partial<AppSettings>) => void
  setWorkspaceName: (name: string) => Promise<boolean> | void
  capture: (text: string, meta?: { projectId?: string | null; dueDate?: string | null; priority?: Priority }) => Promise<boolean>
  updateInboxItem: (id: string, patch: Partial<InboxItem>) => void
  dismissInboxItem: (id: string) => void
  convertInboxItem: (id: string) => Promise<Task | null>
  bulkConvert: (ids: string[]) => void
  bulkDismiss: (ids: string[]) => void
  bulkAssignProject: (ids: string[], projectId: string | null) => void
  addTask: (partial: Partial<Task> & { title: string }) => Promise<Task | null>
  updateTask: (id: string, patch: TaskPatch, opts?: { silent?: boolean }) => Promise<boolean>
  toggleTask: (id: string) => Promise<boolean>
  deleteTask: (id: string) => Promise<boolean>
  addNote: (partial?: Partial<Note>) => Promise<Note | null>
  updateNote: (id: string, patch: WorkspaceNotePatch, opts?: { silent?: boolean }) => Promise<Note | null>
  deleteNote: (id: string) => Promise<boolean>
  addProject: (partial: { name: string; slug?: string; description?: string; status?: ProjectStatus; color?: string; icon?: string; startDate?: string | null; targetDate?: string | null }) => Promise<Project | null>
  updateProject: (id: string, patch: ProjectMutationPatch) => Promise<boolean>
  deleteProject: (id: string) => Promise<boolean>
  pushRecent: (item: Omit<RecentItem, 'at'>) => void
  resetWorkspace: () => Promise<boolean>
  exportJson: () => string
  signOut: () => void
}

export type WorkspaceApi = WorkspaceIdentity & WorkspaceCapabilities & WorkspaceData & WorkspaceActions

const WorkspaceContext = createContext<WorkspaceApi | null>(null)
const IdentityContext = createContext<WorkspaceIdentity | null>(null)
const CapabilitiesContext = createContext<WorkspaceCapabilities | null>(null)
const DataContext = createContext<WorkspaceData | null>(null)
const ActionsContext = createContext<WorkspaceActions | null>(null)

function required<T>(value: T | null, hook: string): T {
  if (!value) throw new Error(`${hook} outside provider`)
  return value
}

// Compatibility facade for screens that genuinely coordinate several workspace modules.
// New focused callers should use one of the narrow hooks below.
export const useWorkspace = () => required(useContext(WorkspaceContext), 'useWorkspace')
export const useWorkspaceIdentity = () => required(useContext(IdentityContext), 'useWorkspaceIdentity')
export const useWorkspaceCapabilities = () => required(useContext(CapabilitiesContext), 'useWorkspaceCapabilities')
export const useWorkspaceData = () => required(useContext(DataContext), 'useWorkspaceData')
export const useWorkspaceActions = () => required(useContext(ActionsContext), 'useWorkspaceActions')

export function WorkspaceContexts({ value, children }: { value: WorkspaceApi; children: ReactNode }) {
  const identity = useMemo<WorkspaceIdentity>(() => ({
    mode: value.mode,
    workspaceId: value.workspaceId,
    workspaces: value.workspaces,
    switchWorkspace: value.switchWorkspace,
    createWorkspace: value.createWorkspace,
  }), [value.mode, value.workspaceId, value.workspaces, value.switchWorkspace, value.createWorkspace])
  const capabilities = useMemo<WorkspaceCapabilities>(() => ({
    canManageWorkspace: value.canManageWorkspace,
    canMutateTasks: value.canMutateTasks,
    taskMutationPending: value.taskMutationPending,
    canMutateNotes: value.canMutateNotes,
    noteMutationPending: value.noteMutationPending,
    supportsBlockedStatus: value.supportsBlockedStatus,
    supportsNoPriority: value.supportsNoPriority,
    supportsTaskHistory: value.supportsTaskHistory,
    supportsCompletedProjectStatus: value.supportsCompletedProjectStatus,
    deletionIsRecoverable: value.deletionIsRecoverable,
  }), [
    value.canManageWorkspace, value.canMutateTasks, value.taskMutationPending,
    value.canMutateNotes, value.noteMutationPending, value.supportsBlockedStatus,
    value.supportsNoPriority, value.supportsTaskHistory, value.supportsCompletedProjectStatus,
    value.deletionIsRecoverable,
  ])
  const data = useMemo<WorkspaceData>(() => ({
    connectionsData: value.connectionsData,
    state: value.state,
    tasks: value.tasks,
    projects: value.projects,
    notes: value.notes,
    inbox: value.inbox,
    getTask: value.getTask,
    getProject: value.getProject,
    getNote: value.getNote,
    subtasksOf: value.subtasksOf,
    isBlocked: value.isBlocked,
    blockersOf: value.blockersOf,
    projectProgress: value.projectProgress,
  }), [value])
  const actions = useMemo<WorkspaceActions>(() => ({
    updateSettings: value.updateSettings,
    setWorkspaceName: value.setWorkspaceName,
    capture: value.capture,
    updateInboxItem: value.updateInboxItem,
    dismissInboxItem: value.dismissInboxItem,
    convertInboxItem: value.convertInboxItem,
    bulkConvert: value.bulkConvert,
    bulkDismiss: value.bulkDismiss,
    bulkAssignProject: value.bulkAssignProject,
    addTask: value.addTask,
    updateTask: value.updateTask,
    toggleTask: value.toggleTask,
    deleteTask: value.deleteTask,
    addNote: value.addNote,
    updateNote: value.updateNote,
    deleteNote: value.deleteNote,
    addProject: value.addProject,
    updateProject: value.updateProject,
    deleteProject: value.deleteProject,
    pushRecent: value.pushRecent,
    resetWorkspace: value.resetWorkspace,
    exportJson: value.exportJson,
    signOut: value.signOut,
  }), [value])

  return (
    <WorkspaceContext.Provider value={value}>
      <IdentityContext.Provider value={identity}>
        <CapabilitiesContext.Provider value={capabilities}>
          <DataContext.Provider value={data}>
            <ActionsContext.Provider value={actions}>{children}</ActionsContext.Provider>
          </DataContext.Provider>
        </CapabilitiesContext.Provider>
      </IdentityContext.Provider>
    </WorkspaceContext.Provider>
  )
}
