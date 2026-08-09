import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppSettings } from '@/types'
import type { BackendNote, BackendProject, BackendWorkItem, Session } from '@/lib/api/contracts'
import {
  createTask, deleteTask, optimisticallyPatchTask, removeInboxFromList, removeTaskFromList,
  replaceInboxInList, replaceTaskInList, updateTask, type CreateTaskInput,
} from '@/lib/api/tasks'
import {
  createProject, deleteProject, replaceProjectInList, updateProject,
  type CreateProjectInput, type ProjectMutationPatch,
} from '@/lib/api/projects'
import { createNote, deleteNote, updateNote, type NoteMutationPatch } from '@/lib/api/notes'
import { createWorkspace, updateWorkspace } from '@/lib/api/workspace'
import { updateUserSettings } from '@/lib/api/settings'
import type { TaskPatch } from './workspace-context'
import { useAppCommands } from './app-commands'

export function useApiWorkspaceMutations(selectedWorkspaceId: string | null) {
  const queryClient = useQueryClient()
  const commands = useAppCommands()
  const createTaskMutation = useMutation({
    mutationFn: ({ input }: { input: CreateTaskInput }) => createTask(input),
    retry: false,
    onSuccess: (created, variables) => {
      const workspaceId = variables.input.workspaceId
      queryClient.setQueryData<BackendWorkItem[]>(['tasks', workspaceId], (current = []) => created.isInbox ? current : [...current.filter((task) => task.id !== created.id), created])
      queryClient.setQueryData<BackendWorkItem[]>(['inbox', workspaceId], (current = []) => created.isInbox ? [...current.filter((item) => item.id !== created.id), created] : current)
    },
  })
  const updateTaskMutation = useMutation({
    mutationFn: ({ workspaceId, task, patch }: { workspaceId: string; task: BackendWorkItem; patch: TaskPatch }) => updateTask(workspaceId, task, patch),
    retry: false,
    onMutate: async ({ workspaceId, task, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', workspaceId] })
      const previousTasks = queryClient.getQueryData<BackendWorkItem[]>(['tasks', workspaceId])
      queryClient.setQueryData<BackendWorkItem[]>(['tasks', workspaceId], (current = []) => optimisticallyPatchTask(current, task, patch))
      return { previousTasks }
    },
    onError: (_error, { workspaceId }, context) => {
      if (context?.previousTasks) queryClient.setQueryData(['tasks', workspaceId], context.previousTasks)
    },
    onSuccess: (updated, { workspaceId }) => {
      queryClient.setQueryData<BackendWorkItem[]>(['tasks', workspaceId], (current = []) => replaceTaskInList(current, updated))
      queryClient.setQueryData<BackendWorkItem[]>(['inbox', workspaceId], (current = []) => replaceInboxInList(current, updated))
    },
  })
  const deleteTaskMutation = useMutation({
    mutationFn: ({ workspaceId, taskId }: { workspaceId: string; taskId: string }) => deleteTask(workspaceId, taskId),
    retry: false,
    onSuccess: (_deleted, { workspaceId, taskId }) => {
      queryClient.setQueryData<BackendWorkItem[]>(['tasks', workspaceId], (current = []) => removeTaskFromList(current, taskId))
      queryClient.setQueryData<BackendWorkItem[]>(['inbox', workspaceId], (current = []) => removeInboxFromList(current, taskId))
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
    mutationFn: ({ workspaceId, project, patch }: { workspaceId: string; project: BackendProject; patch: ProjectMutationPatch }) => updateProject(workspaceId, project, patch),
    retry: false,
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<BackendProject[]>(['projects', variables.workspaceId], (current = []) => replaceProjectInList(current, updated))
    },
  })
  const deleteProjectMutation = useMutation({
    mutationFn: ({ workspaceId, projectId }: { workspaceId: string; projectId: string }) => deleteProject(workspaceId, projectId),
    retry: false,
    onSuccess: (_deleted, variables) => {
      queryClient.setQueryData<BackendProject[]>(['projects', variables.workspaceId], (current = []) => current.filter((project) => project.id !== variables.projectId))
      queryClient.setQueryData<BackendWorkItem[]>(['tasks', variables.workspaceId], (current = []) => current.map((task) => task.projectId === variables.projectId ? { ...task, projectId: null } : task))
      queryClient.setQueryData<BackendNote[]>(['notes', variables.workspaceId], (current = []) => current.map((note) => note.projectId === variables.projectId ? { ...note, projectId: null } : note))
    },
  })
  const createNoteMutation = useMutation({
    mutationFn: ({ workspaceId, title, body, projectId }: { workspaceId: string; title: string; body?: string; projectId?: string }) => createNote({ workspaceId, title, ...(body !== undefined ? { body } : {}), ...(projectId !== undefined ? { projectId } : {}) }),
    retry: false,
    onSuccess: (created, variables) => {
      queryClient.setQueryData<BackendNote[]>(['notes', variables.workspaceId], (current = []) => [created, ...current.filter((note) => note.id !== created.id)])
    },
  })
  const updateNoteMutation = useMutation({
    mutationFn: ({ workspaceId, noteId, patch }: { workspaceId: string; noteId: string; patch: NoteMutationPatch }) => updateNote(workspaceId, noteId, patch),
    retry: false,
    onSuccess: (updated, variables) => {
      queryClient.setQueryData<BackendNote[]>(['notes', variables.workspaceId], (current = []) => current.map((note) => note.id === updated.id ? updated : note))
    },
  })
  const deleteNoteMutation = useMutation({
    mutationFn: ({ workspaceId, noteId }: { workspaceId: string; noteId: string }) => deleteNote(workspaceId, noteId),
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
    mutationFn: ({ workspaceId, name }: { workspaceId: string; name: string }) => updateWorkspace(workspaceId, { name }),
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
    mutationFn: ({ workspaceId, userId, patch }: { workspaceId: string; userId: string; patch: Partial<AppSettings> }) => updateUserSettings(workspaceId, userId, patch),
    retry: false,
  })

  return {
    createTaskMutation, updateTaskMutation, deleteTaskMutation,
    createProjectMutation, updateProjectMutation, deleteProjectMutation,
    createNoteMutation, updateNoteMutation, deleteNoteMutation,
    createWorkspaceMutation, updateWorkspaceMutation, updateSettingsMutation,
  }
}
