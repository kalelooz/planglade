import { deleteJson, getJson, sendJson } from '@/lib/api/client'
import { workItemHistorySchema, workItemListSchema, workItemResponseSchema, type BackendWorkItem } from '@/lib/api/contracts'
import type { Priority, Task, TaskStatus } from '@/types'
import { placeBoardTask } from '@/lib/board-order'
import { z } from 'zod'

export type TaskMutationPatch = Partial<Omit<Task, 'id' | 'history' | 'source'>> & { beforeId?: string | null }

export function canMutateTasksForAuthMode(authMode?: string) {
  return authMode !== 'demo'
}

export async function getTasks(workspaceId: string, signal?: AbortSignal) {
  const response = await getJson(`/api/work-items?workspaceId=${encodeURIComponent(workspaceId)}`, workItemListSchema, signal)
  return response.workItems.filter((item) => !item.isInbox)
}

export async function getInboxItems(workspaceId: string, signal?: AbortSignal) {
  const response = await getJson(`/api/work-items?workspaceId=${encodeURIComponent(workspaceId)}&isInbox=true`, workItemListSchema, signal)
  return response.workItems
}

export async function getTaskHistory(workspaceId: string, taskId: string, signal?: AbortSignal) {
  const response = await getJson(
    `/api/work-items/${encodeURIComponent(taskId)}/history?workspaceId=${encodeURIComponent(workspaceId)}`,
    workItemHistorySchema,
    signal,
  )
  return response.events
}

export function replaceTaskInList(tasks: BackendWorkItem[], updated: BackendWorkItem) {
  const index = tasks.findIndex((task) => task.id === updated.id)
  if (updated.isInbox) return tasks.filter((task) => task.id !== updated.id)
  return index < 0 ? [...tasks, updated] : tasks.map((task) => task.id === updated.id ? updated : task)
}

export function removeTaskFromList(tasks: BackendWorkItem[], taskId: string) {
  return tasks
    .filter((task) => task.id !== taskId)
    .map((task) => task.parentId === taskId ? { ...task, parentId: null } : task)
}

export function removeInboxFromList(items: BackendWorkItem[], taskId: string) {
  return items.filter((item) => item.id !== taskId)
}

export function replaceInboxInList(items: BackendWorkItem[], updated: BackendWorkItem) {
  const without = items.filter((item) => item.id !== updated.id)
  return updated.isInbox ? [...without, updated] : without
}

const backendStatus: Record<Exclude<TaskStatus, 'blocked'>, BackendWorkItem['status']> = {
  backlog: 'BACKLOG',
  planned: 'TODO',
  in_progress: 'IN_PROGRESS',
  in_review: 'IN_REVIEW',
  done: 'DONE',
}

const backendPriority: Record<Exclude<Priority, 'none'>, BackendWorkItem['priority']> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
}

function isoDate(value: string | null) {
  return value ? `${value}T00:00:00.000Z` : null
}

export type CreateTaskInput = {
  workspaceId: string
  title: string
  description?: string
  projectId?: string | null
  status?: Exclude<TaskStatus, 'blocked'>
  priority?: Exclude<Priority, 'none'>
  dueDate?: string | null
  startDate?: string | null
  parentId?: string | null
  assigneeId?: string | null
  isInbox?: boolean
}

export function createTask(input: CreateTaskInput, signal?: AbortSignal) {
  return sendJson('/api/work-items', 'POST', {
    workspaceId: input.workspaceId,
    title: input.title,
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.status ? { status: backendStatus[input.status] } : {}),
    ...(input.priority ? { priority: backendPriority[input.priority] } : {}),
    ...(input.dueDate ? { dueDate: isoDate(input.dueDate) } : {}),
    ...(input.startDate ? { startDate: isoDate(input.startDate) } : {}),
    ...(input.parentId ? { parentId: input.parentId } : {}),
    ...(input.assigneeId ? { assigneeId: input.assigneeId } : {}),
    ...(input.isInbox ? { isInbox: true } : {}),
  }, workItemResponseSchema, signal).then((response) => response.workItem)
}

export function updateTask(workspaceId: string, task: BackendWorkItem, patch: TaskMutationPatch, signal?: AbortSignal) {
  const body: Record<string, unknown> = { expectedUpdatedAt: task.updatedAt }
  if (patch.title !== undefined) body.title = patch.title
  if (patch.description !== undefined) body.description = patch.description
  if (patch.projectId !== undefined) body.projectId = patch.projectId
  if (patch.dueDate !== undefined) body.dueDate = isoDate(patch.dueDate)
  if (patch.startDate !== undefined) body.startDate = isoDate(patch.startDate)
  if (patch.labelIds !== undefined) body.labelIds = patch.labelIds
  if (patch.assigneeId !== undefined) body.assigneeId = patch.assigneeId
  if (patch.status !== undefined && patch.status !== 'blocked') {
    body.status = backendStatus[patch.status]
    body.completedAt = patch.status === 'done' ? new Date().toISOString() : null
  }
  if (patch.priority !== undefined && patch.priority !== 'none') body.priority = backendPriority[patch.priority]
  if (patch.beforeId !== undefined) body.beforeId = patch.beforeId
  return sendJson(`/api/work-items/${encodeURIComponent(task.id)}?workspaceId=${encodeURIComponent(workspaceId)}`, 'PATCH', body, workItemResponseSchema, signal)
    .then((response) => response.workItem)
}

export function optimisticallyPatchTask(tasks: BackendWorkItem[], task: BackendWorkItem, patch: TaskMutationPatch) {
  const status = patch.status && patch.status !== 'blocked' ? backendStatus[patch.status] : task.status
  const placed = patch.beforeId !== undefined ? placeBoardTask(tasks, task.id, status, patch.beforeId) : tasks
  return placed.map((item) => item.id === task.id ? {
    ...item,
    status,
    ...(patch.position !== undefined ? { position: patch.position } : {}),
    ...(patch.dueDate !== undefined ? { dueDate: isoDate(patch.dueDate) } : {}),
    ...(patch.startDate !== undefined ? { startDate: isoDate(patch.startDate) } : {}),
    ...(patch.assigneeId !== undefined ? { assigneeId: patch.assigneeId } : {}),
    ...(patch.beforeId !== undefined ? { position: placed.find((candidate) => candidate.id === task.id)?.position ?? item.position } : {}),
  } : item)
}

const deletedResponseSchema = z.object({ deleted: z.literal(true) })

export function deleteTask(workspaceId: string, taskId: string, signal?: AbortSignal) {
  return deleteJson(
    `/api/work-items/${encodeURIComponent(taskId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    deletedResponseSchema,
    signal,
  )
}
