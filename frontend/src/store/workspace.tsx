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
import { authLoginHref, currentWorkspaceDestination } from '@/lib/auth-destination'
import { useNavigate } from 'react-router'
import { useAppCommands } from '@/store/app-commands'
import { createReferenceWorkspaceAdapter } from '@/store/reference-workspace-adapter'
import { useServerWorkspaceSync } from '@/store/server-workspace-sync'
import { WORKSPACE_PATHS } from '@/lib/workspace-routes'
import {
  WorkspaceContexts,
  type TaskPatch,
  type WorkspaceApi,
  type WorkspaceNotePatch,
} from '@/store/workspace-context'

export { useWorkspace, useWorkspaceActions, useWorkspaceCapabilities, useWorkspaceData, useWorkspaceIdentity } from '@/store/workspace-context'
export type { TaskPatch, WorkspaceMode } from '@/store/workspace-context'

const ACTIVE_WORKSPACE_KEY = 'planglade-active-workspace-v1'

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
  const error = sessionQuery.error ?? projectsQuery.error ?? tasksQuery.error ?? inboxQuery.error
  if (error) return <BootstrapState error={error} />
  if (!sessionQuery.data || !projectsQuery.data || !tasksQuery.data || !inboxQuery.data) return <BootstrapState />

  const session = sessionQuery.data
  const currentWorkspaceRole = session.workspaces?.find((workspace) => workspace.id === workspaceId)?.role ?? 'MEMBER'
  const taskMutationsAllowed = canMutateTasksForAuthMode(session.authMode) && currentWorkspaceRole !== 'VIEWER'
  const canManageWorkspace = currentWorkspaceRole === 'OWNER' || currentWorkspaceRole === 'ADMIN'
  const notes = notesQuery.data ?? []
  const relations = relationsQuery.data ?? []
  const connectionsData = {
    notes: notesQuery.isError ? 'error' : notesQuery.isSuccess ? 'ready' : 'loading',
    relations: relationsQuery.isError ? 'error' : relationsQuery.isSuccess ? 'ready' : 'loading',
    relationLimitReached: relationsQuery.isSuccess && relationsQuery.data.length === 500,
  } as const
  const state = buildApiWorkspaceState(session, projectsQuery.data, tasksQuery.data, inboxQuery.data, notes, relations, settings)
  const { projects, tasks } = state
  const byId = new Map(tasks.map((task) => [task.id, task]))
  const inboxById = new Map(state.inbox.map((item) => [item.id, item]))
  const projectsById = new Map(projects.map((project) => [project.id, project]))
  const mutationMessage = (error: unknown) => {
    const apiError = toApiError(error)
    if (apiError.kind === 'unauthenticated') return 'Sign in to change tasks.'
    if (apiError.kind === 'forbidden') return 'This workspace is read-only for your account.'
    if (apiError.kind === 'not_found') return 'This task no longer exists.'
    if (apiError.kind === 'validation') return 'Check the task details and try again.'
    return 'PlanGlade is temporarily unavailable.'
  }
  const noteMutationMessage = (error: unknown) => {
    const apiError = toApiError(error)
    if (apiError.kind === 'unauthenticated') return 'Sign in to change notes.'
    if (apiError.kind === 'forbidden') return 'You do not have permission to change this note.'
    if (apiError.kind === 'not_found') return 'This note is no longer available.'
    if (apiError.kind === 'validation') return 'Check the note and try again.'
    return 'PlanGlade is temporarily unavailable.'
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
    if (!task?.source && inboxItem?.source) {
      return updateMutation.mutateAsync({ workspaceId, task: inboxItem.source, patch }).then(() => {
        if (!opts?.silent) toast.success('Changes saved')
        return true
      }).catch((error) => {
        toast.error(mutationMessage(error))
        return false
      })
    }
    if (typeof updateQueue.current !== 'function') {
      updateQueue.current = createTaskMutationQueue(async (taskId, request) => {
        const currentTask = byId.get(taskId)
        if (!currentTask?.source) return false
        try {
          await updateMutation.mutateAsync({ workspaceId, task: currentTask.source, patch: request.patch })
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
    if (!workspaceId || (!byId.has(id) && !inboxById.has(id)) || deleteMutation.isPending || deletePending.current) return false
    deletePending.current = true
    try {
      await deleteMutation.mutateAsync({ workspaceId, taskId: id })
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
      toast.error(mutationMessage(error))
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
    if (!taskMutationsAllowed || !workspaceId || !state.notes.some((note) => note.id === id) || deleteNoteMutation.isPending || noteDeletePending.current) return false
    noteDeletePending.current = true
    try {
      await deleteNoteMutation.mutateAsync({ workspaceId, noteId: id })
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
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, created.id)
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
      await deleteProjectMutation.mutateAsync({ workspaceId, projectId: id })
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
      localStorage.setItem(ACTIVE_WORKSPACE_KEY, nextWorkspaceId)
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
    subtasksOf: (taskId) => tasks.filter((task) => task.parentId === taskId),
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
      return created
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
    resetWorkspace: notifyReadOnly,
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
  const [state, setState] = useState<WorkspaceState>(() => adapter.load())
  const first = useRef(true)
  const commands = useAppCommands()
  const navigate = useNavigate()
  useTheme(state.settings.theme)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    try {
      adapter.save(state)
    } catch {
      /* storage full or unavailable — prototype continues in memory */
    }
  }, [adapter, state])

  const api = useMemo<WorkspaceApi>(() => {
    const byId = new Map(state.tasks.map((t) => [t.id, t]))

    const isBlocked = (task: Task) =>
      task.status !== 'done' &&
      (task.status === 'blocked' || task.dependsOn.some((d) => byId.get(d)?.status !== 'done'))

    const commit = (fn: (s: WorkspaceState) => WorkspaceState) => setState((s) => fn(s))

    const hist = (text: string) => ({ at: Date.now(), text })

    const addTask = (partial: Partial<Task> & { title: string }): Task => {
      const task: Task = {
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
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completedAt: partial.status === 'done' ? Date.now() : null,
        history: [hist('Created')],
      }
      commit((s) => ({ ...s, tasks: [...s.tasks, task] }))
      return task
    }

    const updateTask = (id: string, patch: TaskPatch, opts?: { silent?: boolean }) => {
      const { beforeId, ...taskPatch } = patch
      commit((s) => {
        const current = s.tasks.find((task) => task.id === id)
        const placed = beforeId !== undefined && current
          ? placeBoardTask(s.tasks, id, taskPatch.status ?? current.status, beforeId)
          : s.tasks
        return {
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
              const pr = s.projects.find((p) => p.id === taskPatch.projectId)
              events.push(hist(taskPatch.projectId ? `Moved to ${pr?.name ?? 'project'}` : 'Removed from project'))
            }
            const done = taskPatch.status === 'done'
            const reopened = t.status === 'done' && taskPatch.status && taskPatch.status !== 'done'
            return {
              ...t,
              ...taskPatch,
              updatedAt: Date.now(),
              completedAt: done ? Date.now() : reopened ? null : t.completedAt,
              history: [...t.history, ...events].slice(-30),
            }
          }),
        }
      })
      if (!opts?.silent) toast.success('Changes saved')
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
      subtasksOf: (taskId) => state.tasks.filter((t) => t.parentId === taskId),
      isBlocked,
      blockersOf: (task) => task.dependsOn.map((d) => byId.get(d)).filter((t): t is Task => !!t),
      projectProgress: (projectId) => {
        const ts = state.tasks.filter((t) => t.projectId === projectId && !t.parentId)
        return { done: ts.filter((t) => t.status === 'done').length, total: ts.length }
      },

      updateSettings: (patch) => commit((s) => ({ ...s, settings: { ...s.settings, ...patch } })),
      setWorkspaceName: (name) => {
        commit((s) => ({ ...s, workspaceName: name }))
        toast.success('Workspace renamed')
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
        commit((s) => ({ ...s, inbox: [item, ...s.inbox] }))
        toast.success('Captured to Inbox', {
          action: { label: 'View', onClick: () => navigate(WORKSPACE_PATHS.inbox) },
        })
        return null
      },
      updateInboxItem: (id, patch) =>
        commit((s) => ({ ...s, inbox: s.inbox.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
      dismissInboxItem: (id) => {
        const item = state.inbox.find((i) => i.id === id)
        if (!item) return
        commit((s) => ({ ...s, inbox: s.inbox.filter((i) => i.id !== id) }))
        toast('Item dismissed', {
          action: { label: 'Undo', onClick: () => commit((s) => ({ ...s, inbox: [item, ...s.inbox] })) },
        })
      },
      convertInboxItem: async (id) => {
        const item = state.inbox.find((i) => i.id === id)
        if (!item) return null
        const task = addTask({
          title: item.text,
          projectId: item.projectId,
          dueDate: item.dueDate,
          priority: item.priority,
          status: 'planned',
        })
        commit((s) => ({ ...s, inbox: s.inbox.filter((i) => i.id !== id) }))
        toast.success('Converted to task', {
          action: {
            label: 'Open',
            onClick: () => commands.dispatch('open-task', { taskId: task.id }),
          },
          cancel: {
            label: 'Undo',
            onClick: () => {
              commit((s) => ({
                ...s,
                tasks: s.tasks.filter((t) => t.id !== task.id),
                inbox: [item, ...s.inbox],
              }))
            },
          },
        })
        return task
      },
      bulkConvert: (ids) => {
        const items = state.inbox.filter((i) => ids.includes(i.id))
        if (!items.length) return
        const newTasks: Task[] = items.map((item) => ({
          id: adapter.nextId('tsk'),
          title: item.text,
          description: '',
          projectId: item.projectId,
          status: 'planned',
          priority: item.priority,
          dueDate: item.dueDate,
          parentId: null,
          dependsOn: [],
          related: [],
          labelIds: [],
          assigneeId: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          completedAt: null,
          history: [hist('Created from Inbox')],
        }))
        commit((s) => ({
          ...s,
          tasks: [...s.tasks, ...newTasks],
          inbox: s.inbox.filter((i) => !ids.includes(i.id)),
        }))
        toast.success(`${items.length} ${items.length === 1 ? 'item' : 'items'} converted to tasks`)
      },
      bulkDismiss: (ids) => {
        const items = state.inbox.filter((i) => ids.includes(i.id))
        if (!items.length) return
        commit((s) => ({ ...s, inbox: s.inbox.filter((i) => !ids.includes(i.id)) }))
        toast(`${items.length} ${items.length === 1 ? 'item' : 'items'} dismissed`, {
          action: { label: 'Undo', onClick: () => commit((s) => ({ ...s, inbox: [...items, ...s.inbox] })) },
        })
      },
      bulkAssignProject: (ids, projectId) => {
        commit((s) => ({
          ...s,
          inbox: s.inbox.map((i) => (ids.includes(i.id) ? { ...i, projectId } : i)),
        }))
        toast.success('Project updated')
      },

      addTask: async (partial) => addTask(partial),
      updateTask: async (id, patch, opts) => {
        updateTask(id, patch, opts)
        return true
      },
      toggleTask: async (id) => {
        const t = byId.get(id)
        if (!t) return false
        const done = t.status !== 'done'
        commit((s) => ({
          ...s,
          tasks: s.tasks.map((x) =>
            x.id === id
              ? {
                  ...x,
                  status: done ? 'done' : 'planned',
                  completedAt: done ? Date.now() : null,
                  updatedAt: Date.now(),
                  history: [...x.history, hist(done ? 'Marked done' : 'Reopened')].slice(-30),
                }
              : x,
          ),
        }))
        if (done) toast.success('Done. Nice.')
        return true
      },
      deleteTask: async (id) => {
        const t = byId.get(id)
        if (!t) return false
        commit((s) => ({
          ...s,
          tasks: s.tasks
            .filter((x) => x.id !== id && x.parentId !== id)
            .map((x) => ({
              ...x,
              dependsOn: x.dependsOn.filter((d) => d !== id),
              related: x.related.filter((r) => r !== id),
            })),
        }))
        toast('Task deleted', {
          action: {
            label: 'Undo',
            onClick: () =>
              commit((s) => (s.tasks.some((x) => x.id === id) ? s : { ...s, tasks: [...s.tasks, t] })),
          },
        })
        commands.dispatch('task-deleted', { taskId: id })
        return true
      },

      addNote: async (partial) => {
        const note: Note = {
          id: adapter.nextId('nte'),
          title: partial?.title ?? 'Untitled note',
          content: partial?.content ?? '',
          projectId: partial?.projectId ?? null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }
        commit((s) => ({ ...s, notes: [note, ...s.notes] }))
        return note
      },
      updateNote: async (id, patch) => {
        const note = state.notes.find((item) => item.id === id)
        if (!note) return null
        const updated = { ...note, ...patch, updatedAt: Date.now() }
        commit((s) => ({ ...s, notes: s.notes.map((item) => item.id === id ? updated : item) }))
        return updated
      },
      deleteNote: async (id) => {
        const n = state.notes.find((x) => x.id === id)
        if (!n) return false
        commit((s) => ({ ...s, notes: s.notes.filter((x) => x.id !== id) }))
        toast('Note deleted', {
          action: { label: 'Undo', onClick: () => commit((s) => ({ ...s, notes: [n, ...s.notes] })) },
        })
        return true
      },

      addProject: async ({ name, description, status, startDate, targetDate }) => {
        const project: Project = {
          id: adapter.nextId('prj'),
          name,
          description: description ?? '',
          status: status === 'completed' ? 'active' : status ?? 'active',
          focus: '',
          targetDate: targetDate ?? null,
          startDate: startDate ?? null,
          createdAt: Date.now(),
        }
        commit((s) => ({ ...s, projects: [...s.projects, project] }))
        toast.success('Project created')
        return project
      },
      updateProject: async (id, patch) => {
        commit((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
        toast.success('Changes saved')
        return true
      },
      deleteProject: async (id) => {
        if (!state.projects.some((project) => project.id === id)) return false
        commit((s) => ({
          ...s,
          projects: s.projects.filter((project) => project.id !== id),
          tasks: s.tasks.map((task) => task.projectId === id ? { ...task, projectId: null } : task),
          notes: s.notes.map((note) => note.projectId === id ? { ...note, projectId: null } : note),
        }))
        toast.success('Project deleted')
        return true
      },

      pushRecent: (item) =>
        commit((s) => ({
          ...s,
          recents: [{ ...item, at: Date.now() }, ...s.recents.filter((r) => !(r.type === item.type && r.id === item.id))].slice(0, 8),
        })),
      resetWorkspace: () => {
        setState(adapter.reset())
        toast.success('Workspace reset to sample data')
      },
      exportJson: () => JSON.stringify(state, null, 2),
      signOut: () => {
        toast('Signed out (simulated)', {
          description: 'This is a local prototype — your data never leaves this browser.',
        })
      },
    }
    return apiObj
  }, [adapter, commands, navigate, state])

  return <WorkspaceContexts value={api}>{children}</WorkspaceContexts>
}
