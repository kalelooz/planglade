import { useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '@/types'
import type { BackendNote, BackendProject, BackendWorkItem, Session } from '@/lib/api/contracts'
import { getSession } from '@/lib/api/session'
import { getProjects, createProject, deleteProject, replaceProjectInList, updateProject, type CreateProjectInput, type ProjectMutationPatch } from '@/lib/api/projects'
import {
  getTasks, getInboxItems, createTask, deleteTask, optimisticallyPatchTask,
  removeInboxFromList, removeTaskFromList, replaceInboxInList, replaceTaskInList,
  updateTask, type CreateTaskInput,
} from '@/lib/api/tasks'
import { getNotes, createNote, deleteNote, updateNote, type NoteMutationPatch } from '@/lib/api/notes'
import { getWorkItemRelations } from '@/lib/api/relations'
import { getUserSettings, updateUserSettings } from '@/lib/api/settings'
import { createWorkspace, updateWorkspace } from '@/lib/api/workspace'
import type { TaskPatch } from './workspace-context'
import { useAppCommands } from './app-commands'

export function useServerWorkspaceSync(selectedWorkspaceId: string | null) {
  const queryClient = useQueryClient()
  const commands = useAppCommands()
  const taskVersions = useRef(new Map<string, string>())
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
  const tasks = useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: ({ signal }) => getTasks(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })
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

  const createTaskMutation = useMutation({
    mutationFn: ({ input }: { input: CreateTaskInput }) => createTask(input),
    retry: false,
    onSuccess: (created, variables) => {
      const targetWorkspaceId = variables.input.workspaceId
      queryClient.setQueryData<BackendWorkItem[]>(['tasks', targetWorkspaceId], (current = []) => created.isInbox ? current : [...current.filter((task) => task.id !== created.id), created])
      queryClient.setQueryData<BackendWorkItem[]>(['inbox', targetWorkspaceId], (current = []) => created.isInbox ? [...current.filter((item) => item.id !== created.id), created] : current)
    },
  })
  const updateTaskMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, task, patch }: { workspaceId: string; task: BackendWorkItem; patch: TaskPatch }) => updateTask(
      targetWorkspaceId,
      task,
      patch,
      undefined,
      taskVersions.current.get(`${targetWorkspaceId}:${task.id}`) ?? task.updatedAt,
    ),
    retry: false,
    onMutate: async ({ workspaceId: targetWorkspaceId, task, patch }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: ['tasks', targetWorkspaceId] }),
        queryClient.cancelQueries({ queryKey: ['inbox', targetWorkspaceId] }),
      ])
      const previousTasks = queryClient.getQueryData<BackendWorkItem[]>(['tasks', targetWorkspaceId])
      queryClient.setQueryData<BackendWorkItem[]>(['tasks', targetWorkspaceId], (current = []) => optimisticallyPatchTask(current, task, patch))
      return { previousTasks }
    },
    onError: (_error, { workspaceId: targetWorkspaceId }, context) => {
      if (context?.previousTasks) queryClient.setQueryData(['tasks', targetWorkspaceId], context.previousTasks)
    },
    onSuccess: async (updated, { workspaceId: targetWorkspaceId, patch }) => {
      queryClient.setQueryData<BackendWorkItem[]>(['tasks', targetWorkspaceId], (current = []) => replaceTaskInList(current, updated))
      queryClient.setQueryData<BackendWorkItem[]>(['inbox', targetWorkspaceId], (current = []) => replaceInboxInList(current, updated))
      if (patch.beforeId !== undefined) {
        for (const key of taskVersions.current.keys()) {
          if (key.startsWith(`${targetWorkspaceId}:`)) taskVersions.current.delete(key)
        }
        await queryClient.invalidateQueries({ queryKey: ['tasks', targetWorkspaceId] })
        for (const task of queryClient.getQueryData<BackendWorkItem[]>(['tasks', targetWorkspaceId]) ?? []) {
          taskVersions.current.set(`${targetWorkspaceId}:${task.id}`, task.updatedAt)
        }
      } else {
        taskVersions.current.set(`${targetWorkspaceId}:${updated.id}`, updated.updatedAt)
      }
    },
  })
  const deleteTaskMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, taskId }: { workspaceId: string; taskId: string }) => deleteTask(targetWorkspaceId, taskId),
    retry: false,
    onSuccess: (_deleted, { workspaceId: targetWorkspaceId, taskId }) => {
      queryClient.setQueryData<BackendWorkItem[]>(['tasks', targetWorkspaceId], (current = []) => removeTaskFromList(current, taskId))
      queryClient.setQueryData<BackendWorkItem[]>(['inbox', targetWorkspaceId], (current = []) => removeInboxFromList(current, taskId))
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
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<BackendProject[]>(['projects', variables.workspaceId], (current = []) => replaceProjectInList(current, updated))
    },
  })
  const deleteProjectMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, projectId }: { workspaceId: string; projectId: string }) => deleteProject(targetWorkspaceId, projectId),
    retry: false,
    onSuccess: (_deleted, variables) => {
      queryClient.setQueryData<BackendProject[]>(['projects', variables.workspaceId], (current = []) => current.filter((project) => project.id !== variables.projectId))
      queryClient.setQueryData<BackendWorkItem[]>(['tasks', variables.workspaceId], (current = []) => current.map((task) => task.projectId === variables.projectId ? { ...task, projectId: null } : task))
      queryClient.setQueryData<BackendNote[]>(['notes', variables.workspaceId], (current = []) => current.map((note) => note.projectId === variables.projectId ? { ...note, projectId: null } : note))
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
    mutationFn: ({ workspaceId: targetWorkspaceId, noteId, patch }: { workspaceId: string; noteId: string; patch: NoteMutationPatch }) => updateNote(targetWorkspaceId, noteId, patch),
    retry: false,
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<BackendNote[]>(['notes', variables.workspaceId], (current = []) => current.map((note) => note.id === updated.id ? updated : note))
    },
  })
  const deleteNoteMutation = useMutation({
    mutationFn: ({ workspaceId: targetWorkspaceId, noteId }: { workspaceId: string; noteId: string }) => deleteNote(targetWorkspaceId, noteId),
    retry: false,
    onSuccess: (_deleted, variables) => {
      queryClient.setQueryData<BackendNote[]>(['notes', variables.workspaceId], (current = []) => current.filter((note) => note.id !== variables.noteId))
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
    invalidateRelations: (targetWorkspaceId: string) => queryClient.invalidateQueries({ queryKey: ['work-item-relations', targetWorkspaceId] }),
  }
}
