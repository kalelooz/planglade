import React, { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type {
  WorkspaceState, Task, Note, InboxItem, Project, ProjectStatus, AppSettings,
} from '@/types'
import { relativeLabel } from '@/lib/dates'
import { dataMode } from '@/lib/data-mode'
import { loadApiSettings, saveApiSettings } from '@/lib/api-settings'
import { createBlockedByRelation, deleteWorkItemRelation } from '@/lib/api/relations'
import type { NoteMutationPatch } from '@/lib/api/notes'
import type { ProjectMutationPatch } from '@/lib/api/projects'
import { canMutateTasksForAuthMode } from '@/lib/api/tasks'
import { adaptNote, adaptProject, adaptTask, buildApiWorkspaceState } from '@/lib/api/adapters'
import { toApiError } from '@/lib/api/errors'
import { createTaskMutationQueue } from '@/lib/task-mutation-queue'
import { placeBoardTask } from '@/lib/board-order'
import { indexTasksByParent } from '@/lib/task-parent-index'
import { authLoginHref, currentWorkspaceDestination } from '@/lib/auth-destination'
import { useNavigate } from 'react-router'
import { useAppCommands } from '@/store/app-commands'
import { createReferenceWorkspaceAdapter } from '@/store/reference-workspace-adapter'
import { createReferenceWorkspaceCommandQueue, type ReferenceWorkspaceCommand } from '@/store/reference-workspace-command-queue'
import { useServerWorkspaceSync } from '@/store/server-workspace-sync'
import { WORKSPACE_PATHS } from '@/lib/workspace-routes'
import { ACTIVE_WORKSPACE_KEY, rememberActiveWorkspace } from '@/lib/active-workspace'
import {
  WorkspaceContexts,
  type TaskPatch,
  type WorkspaceApi,
  type WorkspaceNotePatch,
} from '@/store/workspace-context'

export { useWorkspace, useWorkspaceActions, useWorkspaceCapabilities, useWorkspaceData, useWorkspaceIdentity } from '@/store/workspace-context'
export type { TaskPatch, WorkspaceMode } from '@/store/workspace-context'

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  return dataMode === 'reference'
    ? <ReferenceWorkspaceProvider>{children}</ReferenceWorkspaceProvider>
    : <ApiWorkspaceProvider>{children}</ApiWorkspaceProvider>
}

function useTheme(theme: AppSettings['theme']) {
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media.matches)
      root.classList.toggle('dark', dark)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])
}

function BootstrapState({ error }: { error?: unknown }) {
  if (!error) {
    return <main className="min-h-dvh grid place-items-center text-sm text-muted-foreground">Loading your workspace.</main>
  }

  const apiError = toApiError(error)
  const content = apiError.kind === 'unauthenticated'
    ? { title: 'Sign in to continue', detail: 'Your PlanGlade session is not active.', action: 'Sign in', href: authLoginHref(currentWorkspaceDestination()) }
    : apiError.kind === 'onboarding_required'
      ? { title: 'Workspace setup required', detail: 'Create your first workspace to continue.', action: 'Create workspace', href: `/onboarding?next=${encodeURIComponent(currentWorkspaceDestination())}` }
      : apiError.kind === 'forbidden'
        ? { title: 'Workspace access unavailable', detail: 'Your account cannot access this workspace.' }
        : { title: 'PlanGlade is temporarily unavailable', detail: 'Please try again when the backend is available.' }

  return (
    <main className="min-h-dvh grid place-items-center px-6">
      <div className="max-w-sm text-center">
        <h1 className="text-balance text-xl font-semibold">{content.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{content.detail}</p>
        {'href' in content && content.href && (
          <a href={content.href} className="mt-5 inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            {content.action}
          </a>
        )}
        {apiError.requestId && <p className="mt-4 text-[12.5px] text-muted-foreground">Request {apiError.requestId}</p>}
      </div>
    </main>
  )
}

function ApiWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState(loadApiSettings)
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() => localStorage.getItem(ACTIVE_WORKSPACE_KEY))
  const updateQueue = useRef<ReturnType<typeof createTaskMutationQueue<{ patch: TaskPatch; silent: boolean }>>>(undefined)
  const deletePending = useRef(false)
  const noteUpdateQueue = useRef<ReturnType<typeof createTaskMutationQueue<{ patch: NoteMutationPatch; silent: boolean }, Note | null>>>(undefined)
  const noteDeletePending = useRef(false)
  useTheme(settings.theme)
  const {
    session: sessionQuery,
    settings: settingsQuery,
    projects: projectsQuery,
    tasks: tasksQuery,
    inbox: inboxQuery,
    notes: notesQuery,
    relations: relationsQuery,
    createTaskMutation: createMutation,
    updateTaskMutation: updateMutation,
    deleteTaskMutation: deleteMutation,
    createProjectMutation,
    updateProjectMutation,
    deleteProjectMutation,
    createNoteMutation,
    updateNoteMutation,
    deleteNoteMutation,
    createWorkspaceMutation,
    updateWorkspaceMutation,
    updateSettingsMutation,
    invalidateRelations,
    getCurrentTask,
    expectedLaneVersions,
    expectedDeleteLaneVersions,
  } = useServerWorkspaceSync(selectedWorkspaceId)

  useEffect(() => {
    if (!selectedWorkspaceId || !sessionQuery.isError) return
    const kind = toApiError(sessionQuery.error).kind
    if (kind !== 'forbidden' && kind !== 'not_found') return
    localStorage.removeItem(ACTIVE_WORKSPACE_KEY)
    setSelectedWorkspaceId(null)
  }, [selectedWorkspaceId, sessionQuery.error, sessionQuery.isError])
  const workspaceId = sessionQuery.data?.workspace.id
  useEffect(() => {
    updateQueue.current = undefined
    noteUpdateQueue.current = undefined
  }, [workspaceId])
  useEffect(() => {
    const server = settingsQuery.data?.settings
    if (!server) return
    setSettings((current) => {
      const next = {
        ...current,
        ...(server.theme ? { theme: server.theme } : {}),
        ...(server.priorityDisplay ? { priorityDisplay: server.priorityDisplay } : {}),
        ...(server.weekStartsOn === 0 || server.weekStartsOn === 1 ? { weekStartsOn: server.weekStartsOn } : {}),
        ...(typeof server.hideHomeCompleted === 'boolean' ? { hideHomeCompleted: server.hideHomeCompleted } : {}),
      }
      saveApiSettings(next)
      return next
    })
  }, [settingsQuery.data])
  const apiState = useMemo(() => {
    if (!sessionQuery.data || !projectsQuery.data || !tasksQuery.data || !inboxQuery.data) return null
    return buildApiWorkspaceState(
      sessionQuery.data,
      projectsQuery.data,
      tasksQuery.data,
      inboxQuery.data,
      notesQuery.data ?? [],
      relationsQuery.data ?? [],
      settings,
    )
  }, [inboxQuery.data, notesQuery.data, projectsQuery.data, relationsQuery.data, sessionQuery.data, settings, tasksQuery.data])
  const tasksByParent = useMemo(() => indexTasksByParent(apiState?.tasks ?? []), [apiState])
  const error = sessionQuery.error ?? projectsQuery.error ?? tasksQuery.error ?? inboxQuery.error
  if (error) return <BootstrapState error={error} />
  if (!sessionQuery.data || !projectsQuery.data || !tasksQuery.data || !inboxQuery.data || !apiState) return <BootstrapState />

  const session = sessionQuery.data
  const currentWorkspaceRole = session.workspaces?.find((workspace) => workspace.id === workspaceId)?.role ?? 'MEMBER'
  const taskMutationsAllowed = canMutateTasksForAuthMode(session.authMode) && currentWorkspaceRole !== 'VIEWER'
  const canManageWorkspace = currentWorkspaceRole === 'OWNER' || currentWorkspaceRole === 'ADMIN'
  const relations = relationsQuery.data ?? []
  const connectionsData = {
    notes: notesQuery.isError ? 'error' : notesQuery.isSuccess ? 'ready' : 'loading',
    relations: relationsQuery.isError ? 'error' : relationsQuery.isSuccess ? 'ready' : 'loading',
    relationLimitReached: relationsQuery.isSuccess && relationsQuery.data.length === 500,
  } as const
  const state = apiState
  const { projects, tasks } = state
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const inboxById = new Map(state.inbox.map((item) => [item.id, item]))
  const projectsById = new Map(projects.map((project) => [project.id, project]))
  const mutationMessage = (error: unknown) => {
    const apiError = toApiError(error)
    if (apiError.kind === 'unauthenticated') return 'Sign in to change tasks.'
    if (apiError.kind === 'forbidden') return 'This workspace is read-only for your account.'
    if (apiError.kind === 'not_found') return 'This task no longer exists.'
    if (apiError.kind === 'conflict') return 'This task changed elsewhere. The latest version was loaded.'
    if (apiError.kind === 'validation') return 'Check the task details and try again.'
    return 'PlanGlade is temporarily unavailable.'
  }
  const noteMutationMessage = (error: unknown) => {
    const apiError = toApiError(error)
    if (apiError.kind === 'unauthenticated') return 'Sign in to change notes.'
    if (apiError.kind === 'forbidden') return 'You do not have permission to change this note.'
    if (apiError.kind === 'not_found') return 'This note is no longer available.'
    if (apiError.kind === 'conflict') return 'This note changed elsewhere. The latest version was loaded.'
    if (apiError.kind === 'validation') return 'Check the note and try again.'
    return 'PlanGlade is temporarily unavailable.'
  }
  const projectMutationMessage = (error: unknown) => {
    const apiError = toApiError(error)
    if (apiError.kind === 'conflict') return 'This project changed elsewhere. The latest version was loaded.'
    return mutationMessage(error)
  }
  const addApiTask = async (partial: Partial<Task> & { title: string }, isInbox = false) => {
    if (!taskMutationsAllowed) {
      toast('Read-only demo mode', { description: 'No changes were saved.' })
      return null
    }
    if (!workspaceId || partial.status === 'blocked') return null
    try {
      const created = await createMutation.mutateAsync({
        input: {
          workspaceId,
          title: partial.title,
          ...(partial.description !== undefined ? { description: partial.description } : {}),
          ...(partial.projectId !== undefined ? { projectId: partial.projectId } : {}),
          ...(partial.status !== undefined ? { status: partial.status } : {}),
          ...(partial.priority !== undefined && partial.priority !== 'none' ? { priority: partial.priority } : {}),
          ...(partial.dueDate !== undefined ? { dueDate: partial.dueDate } : {}),
          ...(partial.startDate !== undefined ? { startDate: partial.startDate } : {}),
          ...(partial.parentId !== undefined ? { parentId: partial.parentId } : {}),
          ...(isInbox ? { isInbox: true } : {}),
        },
      })
      return adaptTask(created)
    } catch (error) {
      toast.error(mutationMessage(error))
      return null
    }
  }
  const updateApiTask = (id: string, patch: TaskPatch, opts?: { silent?: boolean }): Promise<boolean> => {
    const task = byId.get(id)
    const inboxItem = inboxById.get(id)
    const source = task?.source ?? inboxItem?.source
    const supported = ['title', 'description', 'projectId', 'startDate', 'dueDate', 'labelIds', 'status', 'priority', 'assigneeId', 'beforeId', 'dependsOn']
    if (!taskMutationsAllowed) {
      toast('Read-only demo mode', { description: 'No changes were saved.' })
      return Promise.resolve(false)
    }
    if (!workspaceId || !source || Object.keys(patch).some((key) => !supported.includes(key)) || patch.status === 'blocked' || patch.priority === 'none') {
      return Promise.resolve(false)
    }
    const syncDependencies = async (nextDependsOn: string[]) => {
      if (!task) return false
      const current = new Set(task.dependsOn)
      const next = new Set(nextDependsOn)
      const additions = [...next].filter((blockerId) => !current.has(blockerId))
      const removals = [...current].filter((blockerId) => !next.has(blockerId))
      let mutationError: string | null = null
      const relationFor = (blockerId: string) => relations.find((relation) =>
        (relation.relationType === 'BLOCKED_BY' && relation.sourceId === id && relation.targetId === blockerId) ||
        (relation.relationType === 'BLOCKS' && relation.sourceId === blockerId && relation.targetId === id),
      )

      try {
        for (const blockerId of additions) {
          await createBlockedByRelation(workspaceId, id, blockerId)
        }
        for (const blockerId of removals) {
          const relation = relationFor(blockerId)
          if (relation) await deleteWorkItemRelation(workspaceId, relation.id)
        }
      } catch (error) {
        mutationError = mutationMessage(error)
      } finally {
        try {
          await invalidateRelations(workspaceId)
        } catch (error) {
          mutationError ??= mutationMessage(error)
        }
      }
      if (mutationError) {
        toast.error(mutationError)
        return false
      }
      if (!opts?.silent) toast.success('Changes saved')
      return true
    }
    if (patch.dependsOn !== undefined) {
      const { dependsOn: nextDependsOn, ...taskPatch } = patch
      const dependencySaved = syncDependencies(nextDependsOn)
      if (Object.keys(taskPatch).length === 0) return dependencySaved
      return dependencySaved.then((saved) => (saved ? updateApiTask(id, taskPatch, opts) : false))
    }
    if (typeof updateQueue.current !== 'function') {
      updateQueue.current = createTaskMutationQueue(async (taskId, request) => {
        const currentTask = getCurrentTask(workspaceId, taskId)
        if (!currentTask) return false
        try {
          await updateMutation.mutateAsync({
            workspaceId,
            task: currentTask,
            patch: request.patch,
            expectedLaneVersions: expectedLaneVersions(workspaceId, currentTask, request.patch),
          })
          if (!request.silent) toast.success('Changes saved')
          return true
        } catch (error) {
          toast.error(mutationMessage(error))
          return false
        }
      })
    }
    return updateQueue.current(id, { patch, silent: Boolean(opts?.silent) })
  }
  const deleteApiTaskFromWorkspace = async (id: string, opts?: { silent?: boolean }) => {
    if (!taskMutationsAllowed) {
      toast('Read-only demo mode', { description: 'No changes were saved.' })
      return false
    }
    const task = byId.get(id) ?? inboxById.get(id)
    if (!workspaceId || !task?.source || deleteMutation.isPending || deletePending.current) return false
    deletePending.current = true
    try {
      await deleteMutation.mutateAsync({
        workspaceId,
        task: task.source,
        expectedLaneVersions: expectedDeleteLaneVersions(workspaceId, task.source),
      })
      if (!opts?.silent) toast.success('Task deleted')
      return true
    } catch {
      toast.error('Task was not deleted. Try again.')
      return false
    } finally {
      deletePending.current = false
    }
  }
  const addApiProject = async (partial: { name: string; slug?: string; description?: string; status?: ProjectStatus; color?: string; icon?: string; startDate?: string | null; targetDate?: string | null }) => {
    if (!taskMutationsAllowed || !workspaceId || !partial.slug || partial.status === 'completed') return null
    try {
      return adaptProject(await createProjectMutation.mutateAsync({ input: {
        workspaceId,
        name: partial.name,
        slug: partial.slug,
        ...(partial.description !== undefined ? { description: partial.description } : {}),
        ...(partial.status !== undefined ? { status: partial.status } : {}),
        ...(partial.color !== undefined ? { color: partial.color } : {}),
        ...(partial.icon !== undefined ? { icon: partial.icon } : {}),
        ...(partial.startDate !== undefined ? { startDate: partial.startDate } : {}),
        ...(partial.targetDate !== undefined ? { targetDate: partial.targetDate } : {}),
      } }))
    } catch (error) {
      toast.error(mutationMessage(error))
      return null
    }
  }
  const updateApiProject = async (id: string, patch: ProjectMutationPatch) => {
    const project = projectsById.get(id)
    const source = project?.source
    if (!taskMutationsAllowed || !workspaceId || !source || patch.status === 'completed' || updateProjectMutation.isPending) return false
    try {
      await updateProjectMutation.mutateAsync({ workspaceId, project: source, patch })
      toast.success('Project saved')
      return true
    } catch (error) {
      toast.error(projectMutationMessage(error))
      return false
    }
  }
  const addApiNote = async (partial: Partial<Note> = {}) => {
    if (!taskMutationsAllowed || !workspaceId) {
      toast('Read-only demo mode', { description: 'No changes were saved.' })
      return null
    }
    try {
      return adaptNote(await createNoteMutation.mutateAsync({
        workspaceId,
        title: partial.title?.trim() || 'Untitled note',
        ...(partial.content !== undefined ? { body: partial.content } : {}),
        ...(typeof partial.projectId === 'string' ? { projectId: partial.projectId } : {}),
      }))
    } catch (error) {
      toast.error(noteMutationMessage(error))
      return null
    }
  }
  const updateApiNote = (id: string, patch: WorkspaceNotePatch, opts?: { silent?: boolean }) => {
    const supported = ['title', 'content', 'projectId']
    if (!taskMutationsAllowed || !workspaceId || !state.notes.some((note) => note.id === id) || Object.keys(patch).some((key) => !supported.includes(key))) {
      return Promise.resolve(null)
    }
    const apiPatch: NoteMutationPatch = {
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.content !== undefined ? { body: patch.content } : {}),
      ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}),
    }
    if (!Object.keys(apiPatch).length) return Promise.resolve(state.notes.find((note) => note.id === id) ?? null)
    if (typeof noteUpdateQueue.current !== 'function') {
      noteUpdateQueue.current = createTaskMutationQueue(async (noteId, request) => {
        try {
          const updated = await updateNoteMutation.mutateAsync({ workspaceId, noteId, patch: request.patch })
          const adapted = adaptNote(updated)
          if (!request.silent) toast.success('Note saved')
          return adapted
        } catch (error) {
          toast.error(noteMutationMessage(error))
          return null
        }
      })
    }
    return noteUpdateQueue.current(id, { patch: apiPatch, silent: Boolean(opts?.silent) })
  }
  const deleteApiNoteFromWorkspace = async (id: string) => {
    const note = notesQuery.data?.find((candidate) => candidate.id === id)
    if (!taskMutationsAllowed || !workspaceId || !note || deleteNoteMutation.isPending || noteDeletePending.current) return false
    noteDeletePending.current = true
    try {
      await deleteNoteMutation.mutateAsync({ workspaceId, note })
      toast.success('Note deleted')
      return true
    } catch (error) {
      toast.error(noteMutationMessage(error))
      return false
    } finally {
      noteDeletePending.current = false
    }
  }
  const notifyReadOnly = () => toast('Read-only API mode', { description: 'No changes were saved.' })
  const createNewWorkspace = async (name: string) => {
    if (!name.trim()) return false
    try {
      const created = await createWorkspaceMutation.mutateAsync({ name: name.trim() })
      rememberActiveWorkspace(localStorage, created.id)
      toast.success('Workspace created')
      window.location.assign(WORKSPACE_PATHS.home)
      return true
    } catch {
      toast.error('Workspace could not be created. Please try again.')
      return false
    }
  }
  const deleteApiProjectFromWorkspace = async (id: string) => {
    const project = projectsById.get(id)
    if (!taskMutationsAllowed || !workspaceId || !project?.source || deleteProjectMutation.isPending) return false
    try {
      await deleteProjectMutation.mutateAsync({ workspaceId, project: project.source })
      toast.success('Project deleted')
      return true
    } catch (error) {
      toast.error(mutationMessage(error))
      return false
    }
  }
  const renameApiWorkspace = async (name: string) => {
    if (!workspaceId || !name.trim() || name.trim() === session.workspace.name) return false
    if (!canManageWorkspace) {
      toast.error('Only workspace admins can rename this workspace.')
      return false
    }
    try {
      await updateWorkspaceMutation.mutateAsync({ workspaceId, name: name.trim() })
      toast.success('Workspace renamed')
      return true
    } catch {
      toast.error('Workspace could not be renamed. Please try again.')
      return false
    }
  }
  const api: WorkspaceApi = {
    mode: { kind: 'server' },
    workspaceId: workspaceId ?? null,
    workspaces: session.workspaces?.length
      ? session.workspaces
      : [{ ...session.workspace, role: 'MEMBER' }],
    switchWorkspace: (nextWorkspaceId) => {
      if (nextWorkspaceId === workspaceId) return
      rememberActiveWorkspace(localStorage, nextWorkspaceId)
      window.location.assign(WORKSPACE_PATHS.home)
    },
    createWorkspace: createNewWorkspace,
    canManageWorkspace,
    canMutateTasks: taskMutationsAllowed,
    taskMutationPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending || createProjectMutation.isPending || updateProjectMutation.isPending || deleteProjectMutation.isPending,
    canMutateNotes: taskMutationsAllowed,
    noteMutationPending: createNoteMutation.isPending || updateNoteMutation.isPending || deleteNoteMutation.isPending,
    supportsBlockedStatus: false,
    supportsNoPriority: false,
    supportsTaskHistory: true,
    supportsCompletedProjectStatus: false,
    deletionIsRecoverable: false,
    connectionsData,
    state,
    tasks,
    projects,
    notes: state.notes,
    inbox: state.inbox,
    getTask: (id) => id ? byId.get(id) : undefined,
    getProject: (id) => id ? projects.find((project) => project.id === id) : undefined,
    getNote: (id) => id ? state.notes.find((note) => note.id === id) : undefined,
    subtasksOf: (taskId) => tasksByParent.get(taskId) ?? [],
    isBlocked: (task) => task.status !== 'done' && (task.status === 'blocked' || task.dependsOn.some((id) => byId.get(id)?.status !== 'done')),
    blockersOf: (task) => task.dependsOn.map((id) => byId.get(id)).filter((item): item is Task => !!item),
    projectProgress: (projectId) => {
      const projectTasks = tasks.filter((task) => task.projectId === projectId && !task.parentId)
      return { done: projectTasks.filter((task) => task.status === 'done').length, total: projectTasks.length }
    },
    updateSettings: (patch) => setSettings((current) => {
      const next = { ...current, ...patch }
      saveApiSettings(next)
      if (workspaceId && session.user.id) {
        void updateSettingsMutation.mutateAsync({ workspaceId, userId: session.user.id, patch }).catch(() => {
          toast.error('Preference saved on this device only.')
        })
      }
      return next
    }),
    setWorkspaceName: renameApiWorkspace,
    capture: async (text, meta) => {
      const created = await addApiTask({ title: text, projectId: meta?.projectId, dueDate: meta?.dueDate, priority: meta?.priority, status: 'backlog' }, true)
      if (created) toast.success('Captured to Inbox')
      return Boolean(created)
    },
    updateInboxItem: (id, patch) => {
      if (!inboxById.has(id)) return
      void updateApiTask(id, { ...(patch.projectId !== undefined ? { projectId: patch.projectId } : {}), ...(patch.dueDate !== undefined ? { dueDate: patch.dueDate } : {}), ...(patch.priority !== undefined ? { priority: patch.priority } : {}) })
    },
    dismissInboxItem: (id) => { void deleteApiTaskFromWorkspace(id) },
    convertInboxItem: async (id) => {
      const task = inboxById.get(id)
      if (!task) return null
      const ok = await updateApiTask(id, { status: 'planned' })
      return ok && task.source ? adaptTask({ ...task.source, status: 'TODO', completedAt: null }) : null
    },
    bulkConvert: (ids) => {
      void (async () => {
        let updated = 0
        for (const id of ids) if (await updateApiTask(id, { status: 'planned' }, { silent: true })) updated += 1
        if (updated) toast.success(`${updated} ${updated === 1 ? 'item' : 'items'} converted to tasks`)
      })()
    },
    bulkDismiss: (ids) => {
      void (async () => {
        let deleted = 0
        for (const id of ids) if (await deleteApiTaskFromWorkspace(id, { silent: true })) deleted += 1
        if (deleted) toast.success(`${deleted} ${deleted === 1 ? 'item' : 'items'} dismissed`)
      })()
    },
    bulkAssignProject: (ids, projectId) => {
      void (async () => {
        let updated = 0
        for (const id of ids) if (await updateApiTask(id, { projectId }, { silent: true })) updated += 1
        if (updated) toast.success(`Project updated for ${updated} ${updated === 1 ? 'item' : 'items'}`)
      })()
    },
    addTask: addApiTask,
    updateTask: updateApiTask,
    toggleTask: (id) => {
      const task = byId.get(id)
      return task ? updateApiTask(id, { status: task.status === 'done' ? 'planned' : 'done' }) : Promise.resolve(false)
    },
    deleteTask: deleteApiTaskFromWorkspace,
    addNote: addApiNote,
    updateNote: updateApiNote,
    deleteNote: deleteApiNoteFromWorkspace,
    addProject: addApiProject,
    updateProject: updateApiProject,
    deleteProject: deleteApiProjectFromWorkspace,
    pushRecent: () => undefined,
    resetWorkspace: async () => {
      notifyReadOnly()
      return false
    },
    exportJson: () => JSON.stringify(state, null, 2),
    signOut: async () => {
      try {
        const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include', cache: 'no-store' })
        const csrf = await csrfResponse.json() as { csrfToken?: unknown }
        if (!csrfResponse.ok || typeof csrf.csrfToken !== 'string') throw new Error('csrf')
        const response = await fetch('/api/auth/signout', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ csrfToken: csrf.csrfToken, callbackUrl: '/auth/login', json: 'true' }),
        })
        if (!response.ok) throw new Error('signout')
        window.location.assign('/auth/login')
      } catch {
        toast.error('Sign out could not be completed. Please try again.')
      }
    },
  }
  return <WorkspaceContexts value={api}>{children}</WorkspaceContexts>
}

function ReferenceWorkspaceProvider({ children }: { children: React.ReactNode }) {
  const adapter = useMemo(() => createReferenceWorkspaceAdapter(localStorage), [])
  const [initialState] = useState<WorkspaceState>(() => adapter.load())
  const [state, setState] = useState(initialState)
  const commandQueue = useMemo(
    () => createReferenceWorkspaceCommandQueue(initialState, (next) => adapter.save(next), setState),
    [adapter, initialState],
  )
  const commands = useAppCommands()
  const navigate = useNavigate()
  const tasksByParent = useMemo(() => indexTasksByParent(state.tasks), [state.tasks])
  useTheme(state.settings.theme)

  const api = useMemo<WorkspaceApi>(() => {
    const byId = new Map(state.tasks.map((t) => [t.id, t]))

    const isBlocked = (task: Task) =>
      task.status !== 'done' &&
      (task.status === 'blocked' || task.dependsOn.some((d) => byId.get(d)?.status !== 'done'))

    const runCommand = async <TResult,>(
      command: ReferenceWorkspaceCommand<TResult>,
      fallback: TResult,
      errorMessage = 'This change could not be saved. Try again.',
    ) => {
      try {
        return await commandQueue(command)
      } catch {
        toast.error(errorMessage)
        return fallback
      }
    }

    const hist = (text: string) => ({ at: Date.now(), text })

    const createTask = (partial: Partial<Task> & { title: string }): Task => {
      const now = Date.now()
      return {
        id: adapter.nextId('tsk'),
        title: partial.title,
        description: partial.description ?? '',
        projectId: partial.projectId ?? null,
        status: partial.status ?? 'planned',
        priority: partial.priority ?? 'none',
        dueDate: partial.dueDate ?? null,
        parentId: partial.parentId ?? null,
        dependsOn: partial.dependsOn ?? [],
        related: partial.related ?? [],
        labelIds: partial.labelIds ?? [],
        assigneeId: partial.assigneeId ?? null,
        createdAt: now,
        updatedAt: now,
        completedAt: partial.status === 'done' ? now : null,
        history: [hist('Created')],
      }
    }

    const addTask = (partial: Partial<Task> & { title: string }) => {
      const task = createTask(partial)
      return runCommand((s) => ({ state: { ...s, tasks: [...s.tasks, task] }, result: task }), null)
    }

    const updateTask = async (id: string, patch: TaskPatch, opts?: { silent?: boolean }) => {
      const { beforeId, ...taskPatch } = patch
      const saved = await runCommand((s) => {
        const current = s.tasks.find((task) => task.id === id)
        if (!current) return { state: s, result: false }
        const placed = beforeId !== undefined
          ? placeBoardTask(s.tasks, id, taskPatch.status ?? current.status, beforeId)
          : s.tasks
        const now = Date.now()
        return {
          state: {
            ...s,
            tasks: placed.map((t) => {
              if (t.id !== id) return t
              const events = [] as { at: number; text: string }[]
              if (taskPatch.status && taskPatch.status !== t.status) {
                if (taskPatch.status === 'done') events.push(hist('Marked done'))
                else if (t.status === 'done') events.push(hist('Reopened'))
                else events.push(hist(`Moved to ${taskPatch.status.replace('_', ' ')}`))
              }
              if (taskPatch.dueDate !== undefined && taskPatch.dueDate !== t.dueDate) {
                events.push(hist(taskPatch.dueDate ? `Due date set to ${relativeLabel(taskPatch.dueDate)}` : 'Due date cleared'))
              }
              if (taskPatch.priority && taskPatch.priority !== t.priority) events.push(hist(`Priority set to ${taskPatch.priority}`))
              if (taskPatch.projectId !== undefined && taskPatch.projectId !== t.projectId) {
                const project = s.projects.find((item) => item.id === taskPatch.projectId)
                events.push(hist(taskPatch.projectId ? `Moved to ${project?.name ?? 'project'}` : 'Removed from project'))
              }
              const done = taskPatch.status === 'done'
              const reopened = t.status === 'done' && taskPatch.status && taskPatch.status !== 'done'
              return {
                ...t,
                ...taskPatch,
                updatedAt: now,
                completedAt: done ? now : reopened ? null : t.completedAt,
                history: [...t.history, ...events].slice(-30),
              }
            }),
          },
          result: true,
        }
      }, false)
      if (saved && !opts?.silent) toast.success('Changes saved')
      return saved
    }

    const apiObj: WorkspaceApi = {
      mode: { kind: 'reference', mutable: true },
      workspaceId: null,
      workspaces: [{ id: 'reference-workspace', slug: 'local', name: state.workspaceName, role: 'OWNER' }],
      switchWorkspace: () => undefined,
      createWorkspace: async () => {
        toast('Local mode uses one browser workspace.')
        return false
      },
      canManageWorkspace: true,
      canMutateTasks: true,
      taskMutationPending: false,
      canMutateNotes: true,
      noteMutationPending: false,
      supportsBlockedStatus: true,
      supportsNoPriority: true,
      supportsTaskHistory: false,
      supportsCompletedProjectStatus: true,
      deletionIsRecoverable: true,
      connectionsData: { notes: 'ready', relations: 'ready', relationLimitReached: false },
      state,
      tasks: state.tasks,
      projects: state.projects,
      notes: state.notes,
      inbox: state.inbox,
      getTask: (idv) => (idv ? byId.get(idv) : undefined),
      getProject: (idv) => (idv ? state.projects.find((p) => p.id === idv) : undefined),
      getNote: (idv) => (idv ? state.notes.find((n) => n.id === idv) : undefined),
      subtasksOf: (taskId) => tasksByParent.get(taskId) ?? [],
      isBlocked,
      blockersOf: (task) => task.dependsOn.map((d) => byId.get(d)).filter((t): t is Task => !!t),
      projectProgress: (projectId) => {
        const ts = state.tasks.filter((t) => t.projectId === projectId && !t.parentId)
        return { done: ts.filter((t) => t.status === 'done').length, total: ts.length }
      },

      updateSettings: (patch) => {
        void runCommand((s) => ({ state: { ...s, settings: { ...s.settings, ...patch } }, result: undefined }), undefined)
      },
      setWorkspaceName: async (name) => {
        const saved = await runCommand((s) => ({ state: { ...s, workspaceName: name }, result: true }), false)
        if (saved) toast.success('Workspace renamed')
        return saved
      },

      capture: async (text, meta) => {
        const item: InboxItem = {
          id: adapter.nextId('inx'),
          text,
          projectId: meta?.projectId ?? null,
          dueDate: meta?.dueDate ?? null,
          priority: meta?.priority ?? 'none',
          createdAt: Date.now(),
        }
        const saved = await runCommand((s) => ({ state: { ...s, inbox: [item, ...s.inbox] }, result: true }), false)
        if (saved) {
          toast.success('Captured to Inbox', {
            action: { label: 'View', onClick: () => navigate(WORKSPACE_PATHS.inbox) },
          })
        }
        return saved
      },
      updateInboxItem: (id, patch) => {
        void runCommand((s) => ({
          state: { ...s, inbox: s.inbox.map((item) => item.id === id ? { ...item, ...patch } : item) },
          result: undefined,
        }), undefined)
      },
      dismissInboxItem: (id) => {
        void runCommand((s) => {
          const item = s.inbox.find((candidate) => candidate.id === id)
          return item
            ? { state: { ...s, inbox: s.inbox.filter((candidate) => candidate.id !== id) }, result: item }
            : { state: s, result: null }
        }, null).then((item) => {
          if (!item) return
          toast('Item dismissed', {
            action: {
              label: 'Undo',
              onClick: () => {
                void runCommand((s) => ({ state: { ...s, inbox: [item, ...s.inbox] }, result: undefined }), undefined)
              },
            },
          })
        })
      },
      convertInboxItem: async (id) => {
        const converted = await runCommand((s) => {
          const item = s.inbox.find((candidate) => candidate.id === id)
          if (!item) return { state: s, result: null }
          const task = createTask({
            title: item.text,
            projectId: item.projectId,
            dueDate: item.dueDate,
            priority: item.priority,
            status: 'planned',
          })
          return {
            state: {
              ...s,
              tasks: [...s.tasks, task],
              inbox: s.inbox.filter((candidate) => candidate.id !== id),
            },
            result: { item, task },
          }
        }, null)
        if (!converted) return null
        const { item, task } = converted
        toast.success('Converted to task', {
          action: {
            label: 'Open',
            onClick: () => commands.dispatch('open-task', { taskId: task.id }),
          },
          cancel: {
            label: 'Undo',
            onClick: () => {
              void runCommand((s) => ({
                state: {
                  ...s,
                  tasks: s.tasks.filter((candidate) => candidate.id !== task.id),
                  inbox: [item, ...s.inbox],
                },
                result: undefined,
              }), undefined)
            },
          },
        })
        return task
      },
      bulkConvert: (ids) => {
        void runCommand((s) => {
          const items = s.inbox.filter((item) => ids.includes(item.id))
          const tasks = items.map((item) => createTask({
            title: item.text,
            projectId: item.projectId,
            dueDate: item.dueDate,
            priority: item.priority,
            status: 'planned',
          }))
          return items.length
            ? {
                state: {
                  ...s,
                  tasks: [...s.tasks, ...tasks],
                  inbox: s.inbox.filter((item) => !ids.includes(item.id)),
                },
                result: items.length,
              }
            : { state: s, result: 0 }
        }, 0).then((count) => {
          if (count) toast.success(`${count} ${count === 1 ? 'item' : 'items'} converted to tasks`)
        })
      },
      bulkDismiss: (ids) => {
        void runCommand((s) => {
          const items = s.inbox.filter((item) => ids.includes(item.id))
          return items.length
            ? { state: { ...s, inbox: s.inbox.filter((item) => !ids.includes(item.id)) }, result: items }
            : { state: s, result: [] }
        }, [] as InboxItem[]).then((items) => {
          if (!items.length) return
          toast(`${items.length} ${items.length === 1 ? 'item' : 'items'} dismissed`, {
            action: {
              label: 'Undo',
              onClick: () => {
                void runCommand((s) => ({ state: { ...s, inbox: [...items, ...s.inbox] }, result: undefined }), undefined)
              },
            },
          })
        })
      },
      bulkAssignProject: (ids, projectId) => {
        void runCommand((s) => ({
          state: { ...s, inbox: s.inbox.map((item) => ids.includes(item.id) ? { ...item, projectId } : item) },
          result: true,
        }), false).then((saved) => {
          if (saved) toast.success('Project updated')
        })
      },

      addTask,
      updateTask,
      toggleTask: async (id) => {
        const result = await runCommand((s) => {
          const task = s.tasks.find((candidate) => candidate.id === id)
          if (!task) return { state: s, result: null }
          const done = task.status !== 'done'
          const now = Date.now()
          return {
            state: {
              ...s,
              tasks: s.tasks.map((candidate) => candidate.id === id
                ? {
                    ...candidate,
                    status: done ? 'done' : 'planned',
                    completedAt: done ? now : null,
                    updatedAt: now,
                    history: [...candidate.history, hist(done ? 'Marked done' : 'Reopened')].slice(-30),
                  }
                : candidate),
            },
            result: done,
          }
        }, null)
        if (result === null) return false
        if (result) toast.success('Done. Nice.')
        return true
      },
      deleteTask: async (id) => {
        const task = await runCommand((s) => {
          const deleted = s.tasks.find((candidate) => candidate.id === id)
          if (!deleted) return { state: s, result: null }
          return {
            state: {
              ...s,
              tasks: s.tasks
                .filter((candidate) => candidate.id !== id)
                .map((candidate) => ({
                  ...candidate,
                  parentId: candidate.parentId === id ? null : candidate.parentId,
                  dependsOn: candidate.dependsOn.filter((dependencyId) => dependencyId !== id),
                  related: candidate.related.filter((relatedId) => relatedId !== id),
                })),
            },
            result: deleted,
          }
        }, null)
        if (!task) return false
        toast('Task deleted', {
          action: {
            label: 'Undo',
            onClick: () => {
              void runCommand((s) => ({
                state: s.tasks.some((candidate) => candidate.id === id) ? s : { ...s, tasks: [...s.tasks, task] },
                result: undefined,
              }), undefined)
            },
          },
        })
        commands.dispatch('task-deleted', { taskId: id })
        return true
      },

      addNote: async (partial) => {
        const now = Date.now()
        const note: Note = {
          id: adapter.nextId('nte'),
          title: partial?.title ?? 'Untitled note',
          content: partial?.content ?? '',
          projectId: partial?.projectId ?? null,
          createdAt: now,
          updatedAt: now,
        }
        return runCommand((s) => ({ state: { ...s, notes: [note, ...s.notes] }, result: note }), null)
      },
      updateNote: (id, patch) => runCommand((s) => {
        const note = s.notes.find((item) => item.id === id)
        if (!note) return { state: s, result: null }
        const updated = { ...note, ...patch, updatedAt: Date.now() }
        return {
          state: { ...s, notes: s.notes.map((item) => item.id === id ? updated : item) },
          result: updated,
        }
      }, null),
      deleteNote: async (id) => {
        const deletion = await runCommand((s) => {
          const deleted = s.notes.find((item) => item.id === id)
          const linkedTaskIds = deleted
            ? s.tasks.filter((task) => task.noteIds?.includes(id)).map((task) => task.id)
            : []
          return deleted
            ? {
                state: {
                  ...s,
                  notes: s.notes.filter((item) => item.id !== id),
                  tasks: s.tasks.map((task) => task.noteIds?.includes(id)
                    ? { ...task, noteIds: task.noteIds.filter((noteId) => noteId !== id), updatedAt: Date.now() }
                    : task),
                },
                result: { note: deleted, linkedTaskIds },
              }
            : { state: s, result: null }
        }, null)
        if (!deletion) return false
        toast('Note deleted', {
          action: {
            label: 'Undo',
            onClick: () => {
              void runCommand((s) => ({
                state: {
                  ...s,
                  notes: [deletion.note, ...s.notes],
                  tasks: s.tasks.map((task) => deletion.linkedTaskIds.includes(task.id) && !task.noteIds?.includes(id)
                    ? { ...task, noteIds: [...(task.noteIds ?? []), id], updatedAt: Date.now() }
                    : task),
                },
                result: undefined,
              }), undefined)
            },
          },
        })
        return true
      },

      addProject: async ({ name, slug, description, status, color, icon, startDate, targetDate }) => {
        const project: Project = {
          id: adapter.nextId('prj'),
          name,
          description: description ?? '',
          ...(slug ? { slug } : {}),
          ...(color ? { color } : {}),
          ...(icon ? { icon } : {}),
          status: status === 'completed' ? 'active' : status ?? 'active',
          focus: '',
          targetDate: targetDate ?? null,
          startDate: startDate ?? null,
          createdAt: Date.now(),
        }
        const created = await runCommand((s) => ({ state: { ...s, projects: [...s.projects, project] }, result: project }), null)
        if (created) toast.success('Project created')
        return created
      },
      updateProject: async (id, patch) => {
        const saved = await runCommand((s) => s.projects.some((project) => project.id === id)
          ? {
              state: { ...s, projects: s.projects.map((project) => project.id === id ? { ...project, ...patch } : project) },
              result: true,
            }
          : { state: s, result: false }, false)
        if (saved) toast.success('Changes saved')
        return saved
      },
      deleteProject: async (id) => {
        const deleted = await runCommand((s) => s.projects.some((project) => project.id === id)
          ? {
              state: {
                ...s,
                projects: s.projects.filter((project) => project.id !== id),
                tasks: s.tasks.map((task) => task.projectId === id ? { ...task, projectId: null } : task),
                notes: s.notes.map((note) => note.projectId === id ? { ...note, projectId: null } : note),
              },
              result: true,
            }
          : { state: s, result: false }, false)
        if (deleted) toast.success('Project deleted')
        return deleted
      },

      pushRecent: (item) => {
        void runCommand((s) => ({
          state: {
            ...s,
            recents: [{ ...item, at: Date.now() }, ...s.recents.filter((recent) => !(recent.type === item.type && recent.id === item.id))].slice(0, 8),
          },
          result: undefined,
        }), undefined)
      },
      resetWorkspace: async () => {
        const fresh = adapter.fresh()
        const saved = await runCommand(() => ({ state: fresh, result: true }), false)
        if (saved) toast.success('Workspace reset to sample data')
        return saved
      },
      exportJson: () => JSON.stringify(state, null, 2),
      signOut: () => {
        toast('Signed out (simulated)', {
          description: 'This is a local prototype — your data never leaves this browser.',
        })
      },
    }
    return apiObj
  }, [adapter, commandQueue, commands, navigate, state, tasksByParent])

  return <WorkspaceContexts value={api}>{children}</WorkspaceContexts>
}
