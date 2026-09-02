import { z } from 'zod'
import { getJson, sendJson } from '@/lib/api/client'
import { projectListSchema, projectResponseSchema, type BackendProject } from '@/lib/api/contracts'
import type { Project, ProjectStatus } from '@/types'

export async function getProjects(workspaceId: string, signal?: AbortSignal) {
  const response = await getJson(`/api/projects?workspaceId=${encodeURIComponent(workspaceId)}`, projectListSchema, signal)
  return response.projects
}

const backendStatus: Record<Exclude<ProjectStatus, 'completed'>, BackendProject['status']> = {
  active: 'ACTIVE',
  in_review: 'IN_REVIEW',
  on_hold: 'ON_HOLD',
  archived: 'ARCHIVED',
}

export type ProjectMutationPatch = Pick<Partial<Project>, 'name' | 'description' | 'status'> & {
  slug?: string
  color?: string
  icon?: string
  startDate?: string | null
  targetDate?: string | null
}

export type CreateProjectInput = {
  workspaceId: string
  name: string
  slug: string
  description?: string
  status?: Exclude<ProjectStatus, 'completed'>
  color?: string
  icon?: string
  startDate?: string | null
  targetDate?: string | null
}

function isoDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toISOString()
}

export function createProject(input: CreateProjectInput, signal?: AbortSignal) {
  return sendJson('/api/projects', 'POST', {
    workspaceId: input.workspaceId,
    name: input.name,
    slug: input.slug,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: backendStatus[input.status] } : {}),
    ...(input.color !== undefined ? { color: input.color } : {}),
    ...(input.icon !== undefined ? { icon: input.icon } : {}),
    ...(input.startDate ? { startDate: isoDate(input.startDate) } : {}),
    ...(input.targetDate ? { dueDate: isoDate(input.targetDate) } : {}),
  }, projectResponseSchema, signal).then((response) => response.project)
}

export function updateProject(workspaceId: string, project: BackendProject, patch: ProjectMutationPatch, signal?: AbortSignal) {
  const body: Record<string, unknown> = { expectedUpdatedAt: project.updatedAt }
  if (patch.name !== undefined) body.name = patch.name
  if (patch.slug !== undefined) body.slug = patch.slug
  if (patch.description !== undefined) body.description = patch.description
  if (patch.status !== undefined && patch.status !== 'completed') body.status = backendStatus[patch.status]
  if (patch.color !== undefined) body.color = patch.color
  if (patch.icon !== undefined) body.icon = patch.icon
  if (patch.startDate !== undefined) body.startDate = patch.startDate ? isoDate(patch.startDate) : null
  if (patch.targetDate !== undefined) body.dueDate = patch.targetDate ? isoDate(patch.targetDate) : null
  return sendJson(`/api/projects/${encodeURIComponent(project.id)}?workspaceId=${encodeURIComponent(workspaceId)}`, 'PATCH', body, projectResponseSchema, signal).then((response) => response.project)
}

const projectDeleteResponseSchema = z.object({ deleted: z.literal(true) })

export function deleteProject(workspaceId: string, project: BackendProject, signal?: AbortSignal) {
  return sendJson(
    `/api/projects/${encodeURIComponent(project.id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    'DELETE',
    { expectedUpdatedAt: project.updatedAt },
    projectDeleteResponseSchema,
    signal,
  )
}

export function replaceProjectInList(projects: BackendProject[], updated: BackendProject) {
  return projects.map((project) => project.id === updated.id ? updated : project)
}
