import { deleteJson, getJson, sendJson } from '@/lib/api/client'
import { noteDeleteResponseSchema, noteListSchema, noteResponseSchema } from '@/lib/api/contracts'

export type CreateNoteInput = {
  workspaceId: string
  title: string
  body?: string
  projectId?: string
}

export type NoteMutationPatch = {
  title?: string
  body?: string
  projectId?: string | null
}

export async function getNotes(workspaceId: string, signal?: AbortSignal) {
  const response = await getJson(`/api/notes?workspaceId=${encodeURIComponent(workspaceId)}`, noteListSchema, signal)
  return response.notes
}

export function createNote(input: CreateNoteInput, signal?: AbortSignal) {
  return sendJson('/api/notes', 'POST', {
    workspaceId: input.workspaceId,
    title: input.title,
    ...(input.body !== undefined ? { body: input.body } : {}),
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
  }, noteResponseSchema, signal).then((response) => response.note)
}

export function updateNote(workspaceId: string, noteId: string, patch: NoteMutationPatch, signal?: AbortSignal) {
  return sendJson(`/api/notes/${encodeURIComponent(noteId)}?workspaceId=${encodeURIComponent(workspaceId)}`, 'PATCH', patch, noteResponseSchema, signal)
    .then((response) => response.note)
}

export function deleteNote(workspaceId: string, noteId: string, signal?: AbortSignal) {
  return deleteJson(`/api/notes/${encodeURIComponent(noteId)}?workspaceId=${encodeURIComponent(workspaceId)}`, noteDeleteResponseSchema, signal)
}
