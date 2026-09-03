import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '@/types'
import type { BackendNote, BackendProject, BackendWorkItem, Session } from '@/lib/api/contracts'
import { getSession } from '@/lib/api/session'
import { getProjects, createProject, deleteProject, replaceProjectInList, updateProject, type CreateProjectInput, type ProjectMutationPatch } from '@/lib/api/projects'
import {
  getTaskSnapshot, getInboxItems, createTask, deleteTask, expectedLaneVersionsForTaskDelete, expectedLaneVersionsForTaskUpdate, optimisticallyPatchTask,
  removeInboxFromList, removeTaskFromList, replaceInboxInList, replaceTaskInList,
  updateTask, type CreateTaskInput, type TaskMutationPatch,
} from '@/lib/api/tasks'
import { getNotes, createNote, deleteNote, updateNote, type NoteMutationPatch } from '@/lib/api/notes'
import { getWorkItemRelations } from '@/lib/api/relations'
import { getUserSettings, updateUserSettings } from '@/lib/api/settings'
import { createWorkspace, updateWorkspace } from '@/lib/api/workspace'
import type { TaskPatch } from './workspace-context'
import { useAppCommands } from './app-commands'
import { toApiError } from '@/lib/api/errors'
import { reloadCollaborativeQueryOnConflict, reloadTaskQueriesOnConflict } from '@/lib/api/conflict-refresh'
import {
  advanceWorkspaceTaskGeneration,
  currentWorkspaceTaskGeneration,
  refreshSupersededWorkspaceTaskMutation,
  refreshWorkspaceTaskVersions,
  replaceWorkspaceTaskVersions,
} from '@/lib/task-version-cache'

type TaskSnapshot = Awaited<ReturnType<typeof getTaskSnapshot>>

function updateTaskSnapshot(
  current: TaskSnapshot | undefined,
  update: (items: BackendWorkItem[]) => BackendWorkItem[],
) {
  return current ? { ...current, workItems: update(current.workItems) } : current
}

export function useServerWorkspaceSync(selectedWorkspaceId: string | null) {
  const queryClient = useQueryClient()
  const commands = useAppCommands()
  const taskVersions = useRef(new Map<string, string>())
  const taskGenerations = useRef(new Map<string, number>())
  const session = useQuery({
    queryKey: ['session', selectedWorkspaceId],
    queryFn: ({ signal }) => getSession(selectedWorkspaceId, signal),
    retry: false,
  })
  const workspaceId = session.data?.workspace.id
  const userId = session.data?.user.id
  const settings = useQuery({
    queryKey: ['user-settings', workspaceId, userId],
    queryFn: ({ signal }) => getUserSettings(workspaceId!, userId!, signal),
    enabled: !!workspaceId && !!userId,
    retry: false,
  })
  const projects = useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: ({ signal }) => getProjects(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })
  const taskSnapshot = useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: ({ signal }) => getTaskSnapshot(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })
  const tasks = {
    ...taskSnapshot,
    data: taskSnapshot.data?.workItems,
  }
  const inbox = useQuery({
    queryKey: ['inbox', workspaceId],
    queryFn: ({ signal }) => getInboxItems(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })
  const notes = useQuery({
    queryKey: ['notes', workspaceId],
    queryFn: ({ signal }) => getNotes(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })
  const relations = useQuery({
    queryKey: ['work-item-relations', workspaceId],
    queryFn: ({ signal }) => getWorkItemRelations(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })

  const refreshTaskState = (targetWorkspaceId: string) => refreshWorkspaceTaskVersions(
    taskVersions.current,
    targetWorkspaceId,
    async () => (await queryClient.fetchQuery({
      queryKey: ['tasks', targetWorkspaceId],
      queryFn: ({ signal }) => getTaskSnapshot(targetWorkspaceId, signal),
    })).workItems,
    () => queryClient.fetchQuery({
      queryKey: ['inbox', targetWorkspaceId],
      queryFn: ({ signal }) => getInboxItems(targetWorkspaceId, signal),
    }),
    () => Promise.all([
      queryClient.cancelQueries({ queryKey: ['tasks', targetWorkspaceId] }),
      queryClient.cancelQueries({ queryKey: ['inbox', targetWorkspaceId] }),
    ]),
    (failedQuery) => queryClient.resetQueries({
      queryKey: [failedQuery, targetWorkspaceId],
      exact: true,
    }),
  )

  const createTaskMutation = useMutation({
    mutationFn: ({ input }: { input: CreateTaskInput }) => createTask(input),
    retry: false,
    onMutate: ({ input }) => ({
      generation: currentWorkspaceTaskGeneration(taskGenerations.current, input.workspaceId),
    }),
    onSuccess: async (created, variables, mutationContext) => {
      const targetWorkspaceId = variables.input.workspaceId
      const supersededRefresh = refreshSupersededWorkspaceTaskMutation(
        taskGenerations.current,
        targetWorkspaceId,
        mutationContext.generation,
        () => refreshTaskState(targetWorkspaceId),
      )
      if (supersededRefresh) {
        await supersededRefresh
        return
      }
      queryClient.setQueryData<TaskSnapshot>(['tasks', targetWorkspaceId], (current) => updateTaskSnapshot(
        current,
        (items) => created.isInbox ? items : [...items.filter((task) => task.id !== created.id), created],
      ))
      queryClient.setQueryData<BackendWorkItem[]>(['inbox', targetWorkspaceId], (current = []) => created.isInbox ? [...current.filter((item) => item.id !== created.id), created] : current)
      if (!created.isInbox) void queryClient.invalidateQueries({ queryKey: ['tasks', targetWorkspaceId] })
    },
  })
  const updateTaskMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, task, patch, expectedLaneVersions }: { workspaceId: string; task: BackendWorkItem; patch: TaskPatch; expectedLaneVersions?: ReturnType<typeof expectedLaneVersionsForTaskUpdate> }) => updateTask(
      targetWorkspaceId,
      task,
      patch,
      undefined,
      taskVersions.current.get(`${targetWorkspaceId}:${task.id}`) ?? task.updatedAt,
      expectedLaneVersions,
    ),
    retry: false,
    onMutate: async ({ workspaceId: targetWorkspaceId, task, patch }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['tasks', targetWorkspaceId] }),
        queryClient.cancelQueries({ queryKey: ['inbox', targetWorkspaceId] }),
      ])
      const previousTasks = queryClient.getQueryData<TaskSnapshot>(['tasks', targetWorkspaceId])
      queryClient.setQueryData<TaskSnapshot>(['tasks', targetWorkspaceId], (current) => updateTaskSnapshot(
        current,
        (items) => optimisticallyPatchTask(items, task, patch),
      ))
      return {
        previousTasks,
        generation: currentWorkspaceTaskGeneration(taskGenerations.current, targetWorkspaceId),
      }
    },
    onError: (error, { workspaceId: targetWorkspaceId }, mutationContext) => {
      if (mutationContext?.generation !== currentWorkspaceTaskGeneration(taskGenerations.current, targetWorkspaceId)) return
      if (mutationContext.previousTasks) queryClient.setQueryData(['tasks', targetWorkspaceId], mutationContext.previousTasks)
      if (toApiError(error).kind === 'conflict') {
        replaceWorkspaceTaskVersions(taskVersions.current, targetWorkspaceId)
        void reloadTaskQueriesOnConflict(queryClient, error, targetWorkspaceId)
      }
    },
    onSuccess: async (updated, { workspaceId: targetWorkspaceId, expectedLaneVersions }, mutationContext) => {
      const supersededRefresh = refreshSupersededWorkspaceTaskMutation(
        taskGenerations.current,
        targetWorkspaceId,
        mutationContext.generation,
        () => refreshTaskState(targetWorkspaceId),
      )
      if (supersededRefresh) {
        await supersededRefresh
        return
      }
      queryClient.setQueryData<TaskSnapshot>(['tasks', targetWorkspaceId], (current) => updateTaskSnapshot(
        current,
        (items) => replaceTaskInList(items, updated),
      ))
      queryClient.setQueryData<BackendWorkItem[]>(['inbox', targetWorkspaceId], (current = []) => replaceInboxInList(current, updated))
      if (expectedLaneVersions) {
        await refreshTaskState(targetWorkspaceId)
      } else {
        taskVersions.current.set(`${targetWorkspaceId}:${updated.id}`, updated.updatedAt)
      }
    },
  })
  const deleteTaskMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, task, expectedLaneVersions }: { workspaceId: string; task: BackendWorkItem; expectedLaneVersions?: ReturnType<typeof expectedLaneVersionsForTaskDelete> }) => deleteTask(targetWorkspaceId, task, expectedLaneVersions),
    retry: false,
    onError: (error, variables) => {
      if (toApiError(error).kind === 'conflict') {
        void reloadTaskQueriesOnConflict(queryClient, error, variables.workspaceId)
      }
    },
    onSuccess: (_deleted, { workspaceId: targetWorkspaceId, task }) => {
      const taskId = task.id
      queryClient.setQueryData<TaskSnapshot>(['tasks', targetWorkspaceId], (current) => updateTaskSnapshot(
        current,
        (items) => removeTaskFromList(items, taskId),
      ))
      queryClient.setQueryData<BackendWorkItem[]>(['inbox', targetWorkspaceId], (current = []) => removeInboxFromList(current, taskId))
      void queryClient.invalidateQueries({ queryKey: ['tasks', targetWorkspaceId] })
      commands.dispatch('task-deleted', { taskId })
    },
  })
  const createProjectMutation = useMutation({
    mutationFn: ({ input }: { input: CreateProjectInput }) => createProject(input),
    retry: false,
    onSuccess: (created, variables) => {
      queryClient.setQueryData<BackendProject[]>(['projects', variables.input.workspaceId], (current = []) => [...current.filter((project) => project.id !== created.id), created])
    },
  })
  const updateProjectMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, project, patch }: { workspaceId: string; project: BackendProject; patch: ProjectMutationPatch }) => updateProject(targetWorkspaceId, project, patch),
    retry: false,
    onError: (error, variables) => {
      if (toApiError(error).kind === 'conflict') {
        void reloadCollaborativeQueryOnConflict(queryClient, error, ['projects', variables.workspaceId])
      }
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<BackendProject[]>(['projects', variables.workspaceId], (current = []) => replaceProjectInList(current, updated))
    },
  })
  const deleteProjectMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, project }: { workspaceId: string; project: BackendProject }) => deleteProject(targetWorkspaceId, project),
    retry: false,
    onError: (error, variables) => {
      if (toApiError(error).kind === 'conflict') {
        void reloadCollaborativeQueryOnConflict(queryClient, error, ['projects', variables.workspaceId])
      }
    },
    onSuccess: (_deleted, variables) => {
      const projectId = variables.project.id
      queryClient.setQueryData<BackendProject[]>(['projects', variables.workspaceId], (current = []) => current.filter((project) => project.id !== projectId))
      queryClient.setQueryData<TaskSnapshot>(['tasks', variables.workspaceId], (current) => updateTaskSnapshot(
        current,
        (items) => items.map((task) => task.projectId === projectId ? { ...task, projectId: null } : task),
      ))
      queryClient.setQueryData<BackendNote[]>(['notes', variables.workspaceId], (current = []) => current.map((note) => note.projectId === projectId ? { ...note, projectId: null } : note))
    },
  })
  const createNoteMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, title, body, projectId }: { workspaceId: string; title: string; body?: string; projectId?: string }) => createNote({ workspaceId: targetWorkspaceId, title, ...(body !== undefined ? { body } : {}), ...(projectId !== undefined ? { projectId } : {}) }),
    retry: false,
    onSuccess: (created, variables) => {
      queryClient.setQueryData<BackendNote[]>(['notes', variables.workspaceId], (current = []) => [created, ...current.filter((note) => note.id !== created.id)])
    },
  })
  const updateNoteMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, noteId, patch }: { workspaceId: string; noteId: string; patch: NoteMutationPatch }) => {
      const note = queryClient.getQueryData<BackendNote[]>(['notes', targetWorkspaceId])?.find((candidate) => candidate.id === noteId)
      if (!note) throw new Error('Note is no longer available')
      return updateNote(targetWorkspaceId, note, patch)
    },
    retry: false,
    onError: (error, variables) => {
      if (toApiError(error).kind === 'conflict') {
        void reloadCollaborativeQueryOnConflict(queryClient, error, ['notes', variables.workspaceId])
      }
    },
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<BackendNote[]>(['notes', variables.workspaceId], (current = []) => current.map((note) => note.id === updated.id ? updated : note))
    },
  })
  const deleteNoteMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, note }: { workspaceId: string; note: BackendNote }) => deleteNote(targetWorkspaceId, note),
    retry: false,
    onError: (error, variables) => {
      if (toApiError(error).kind === 'conflict') {
        void reloadCollaborativeQueryOnConflict(queryClient, error, ['notes', variables.workspaceId])
      }
    },
    onSuccess: async (_deleted, variables) => {
      queryClient.setQueryData<BackendNote[]>(['notes', variables.workspaceId], (current = []) => current.filter((note) => note.id !== variables.note.id))
      advanceWorkspaceTaskGeneration(taskGenerations.current, variables.workspaceId)
      await refreshTaskState(variables.workspaceId)
    },
  })
  const createWorkspaceMutation = useMutation({
    mutationFn: ({ name }: { name: string }) => createWorkspace(name),
    retry: false,
  })
  const updateWorkspaceMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, name }: { workspaceId: string; name: string }) => updateWorkspace(targetWorkspaceId, { name }),
    retry: false,
    onSuccess: (updated) => {
      queryClient.setQueryData<Session>(['session', selectedWorkspaceId], (current) => current ? {
        ...current,
        workspace: current.workspace.id === updated.id ? { ...current.workspace, ...updated } : current.workspace,
        workspaces: current.workspaces?.map((workspace) => workspace.id === updated.id ? { ...workspace, ...updated } : workspace),
      } : current)
    },
  })
  const updateSettingsMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, userId: targetUserId, patch }: { workspaceId: string; userId: string; patch: Partial<AppSettings> }) => updateUserSettings(targetWorkspaceId, targetUserId, patch),
    retry: false,
  })

  return {
    session,
    settings,
    projects,
    tasks,
    inbox,
    notes,
    relations,
    createTaskMutation,
    updateTaskMutation,
    deleteTaskMutation,
    createProjectMutation,
    updateProjectMutation,
    deleteProjectMutation,
    createNoteMutation,
    updateNoteMutation,
    deleteNoteMutation,
    createWorkspaceMutation,
    updateWorkspaceMutation,
    updateSettingsMutation,
    expectedLaneVersions: (targetWorkspaceId: string, task: BackendWorkItem, patch: TaskMutationPatch) => {
      const snapshot = queryClient.getQueryData<TaskSnapshot>(['tasks', targetWorkspaceId])
      const currentTask = snapshot?.workItems.find((candidate) => candidate.id === task.id) ?? task
      return snapshot ? expectedLaneVersionsForTaskUpdate(currentTask, patch, snapshot.laneVersions) : undefined
    },
    expectedDeleteLaneVersions: (targetWorkspaceId: string, task: BackendWorkItem) => {
      const snapshot = queryClient.getQueryData<TaskSnapshot>(['tasks', targetWorkspaceId])
      return snapshot ? expectedLaneVersionsForTaskDelete(task, snapshot.laneVersions) : undefined
    },
    invalidateRelations: (targetWorkspaceId: string) => queryClient.invalidateQueries({ queryKey: ['work-item-relations', targetWorkspaceId] }),
  }
}
