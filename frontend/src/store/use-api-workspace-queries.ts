import { useQuery } from '@tanstack/react-query'
import { getSession } from '@/lib/api/session'
import { getProjects } from '@/lib/api/projects'
import { getTasks, getInboxItems } from '@/lib/api/tasks'
import { getNotes } from '@/lib/api/notes'
import { getWorkItemRelations } from '@/lib/api/relations'
import { getUserSettings } from '@/lib/api/settings'

export function useSessionQuery(selectedWorkspaceId: string | null) {
  return useQuery({
    queryKey: ['session', selectedWorkspaceId],
    queryFn: ({ signal }) => getSession(selectedWorkspaceId, signal),
    retry: false,
  })
}

export function useSettingsQuery(workspaceId?: string, userId?: string) {
  return useQuery({
    queryKey: ['user-settings', workspaceId, userId],
    queryFn: ({ signal }) => getUserSettings(workspaceId!, userId!, signal),
    enabled: !!workspaceId && !!userId,
    retry: false,
  })
}

export function useProjectsQuery(workspaceId?: string) {
  return useQuery({
    queryKey: ['projects', workspaceId],
    queryFn: ({ signal }) => getProjects(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })
}

export function useTasksQuery(workspaceId?: string) {
  return useQuery({
    queryKey: ['tasks', workspaceId],
    queryFn: ({ signal }) => getTasks(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })
}

export function useInboxQuery(workspaceId?: string) {
  return useQuery({
    queryKey: ['inbox', workspaceId],
    queryFn: ({ signal }) => getInboxItems(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })
}

export function useNotesQuery(workspaceId?: string) {
  return useQuery({
    queryKey: ['notes', workspaceId],
    queryFn: ({ signal }) => getNotes(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })
}

export function useRelationsQuery(workspaceId?: string) {
  return useQuery({
    queryKey: ['work-item-relations', workspaceId],
    queryFn: ({ signal }) => getWorkItemRelations(workspaceId!, signal),
    enabled: !!workspaceId,
    retry: false,
  })
}

export function useApiWorkspaceQueries(selectedWorkspaceId: string | null) {
  const session = useSessionQuery(selectedWorkspaceId)
  const workspaceId = session.data?.workspace.id
  const userId = session.data?.user.id
  const settings = useSettingsQuery(workspaceId, userId)
  const projects = useProjectsQuery(workspaceId)
  const tasks = useTasksQuery(workspaceId)
  const inbox = useInboxQuery(workspaceId)
  const notes = useNotesQuery(workspaceId)
  const relations = useRelationsQuery(workspaceId)

  return { session, settings, projects, tasks, inbox, notes, relations }
}
