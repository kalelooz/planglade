import { z } from 'zod'

import { ApiError, apiErrorKind } from '@/lib/api/errors'
import { deleteJson, getJson, sendJson } from '@/lib/api/client'

export const MAX_ATTACHMENT_BYTES = 50 * 1024 * 1024

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/csv',
  'text/markdown',
  'text/plain',
] as const

export const ATTACHMENT_ACCEPT = [
  ...ALLOWED_ATTACHMENT_MIME_TYPES,
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.csv', '.md', '.txt',
].join(',')

const mimeByExtension: Record<string, (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number]> = {
  csv: 'text/csv',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  md: 'text/markdown',
  pdf: 'application/pdf',
  png: 'image/png',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  webp: 'image/webp',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
}

const attachmentSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  workItemId: z.string().nullable(),
  noteId: z.string().nullable(),
  name: z.string(),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().int().nonnegative().nullable(),
  uploadedById: z.string(),
  uploadedBy: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
  }),
  createdAt: z.string(),
})

const attachmentListSchema = z.object({
  attachments: z.array(attachmentSchema),
  limitReached: z.boolean().default(false),
})
const attachmentResponseSchema = z.object({ attachment: attachmentSchema })
const attachmentDeleteSchema = z.object({ deleted: z.literal(true), storageDeleted: z.boolean().optional() })
export function isSafeAttachmentUrl(value: string) {
  try {
    const parsed = new URL(value, 'https://planglade.invalid')
    if (value.startsWith('/')) {
      return !value.startsWith('//') && !value.startsWith('/\\') && parsed.origin === 'https://planglade.invalid'
    }
    return /^https:\/\//i.test(value) && parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const signedUrlSchema = z.string().min(1).refine(isSafeAttachmentUrl, 'Unsafe attachment URL')
const uploadTargetSchema = z.object({
  uploadUrl: signedUrlSchema,
  method: z.literal('PUT'),
  requiredHeaders: z.record(z.string(), z.string()),
  finalizePayload: z.object({
    reservationId: z.string().uuid(),
    workspaceId: z.string(),
    workItemId: z.string().optional(),
    noteId: z.string().optional(),
    name: z.string(),
    storageKey: z.string(),
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
  }),
})
const downloadTargetSchema = z.object({
  attachment: z.object({ id: z.string(), name: z.string(), mimeType: z.string().nullable(), sizeBytes: z.number().nullable() }),
  downloadUrl: signedUrlSchema,
  expiresInSeconds: z.number().int().positive(),
})

export type Attachment = z.infer<typeof attachmentSchema>
export type AttachmentList = z.infer<typeof attachmentListSchema>
export type AttachmentTarget =
  | { workItemId: string; noteId?: never }
  | { noteId: string; workItemId?: never }

export function canDeleteAttachment(input: {
  canMutate: boolean
  currentUserId?: string
  role?: string
  uploadedById: string
}) {
  return input.canMutate && (
    input.role === 'OWNER'
    || input.role === 'ADMIN'
    || input.uploadedById === input.currentUserId
  )
}

function targetQuery(target: AttachmentTarget) {
  const params = new URLSearchParams()
  if (target.workItemId) params.set('workItemId', target.workItemId)
  if (target.noteId) params.set('noteId', target.noteId)
  return params
}

export function attachmentMimeType(file: Pick<File, 'name' | 'type'>) {
  if ((ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) return file.type
  const extension = file.name.toLowerCase().split('.').pop() ?? ''
  return mimeByExtension[extension] ?? null
}

export function validateAttachmentFile(file: Pick<File, 'name' | 'size' | 'type'>) {
  if (!file.name.trim() || file.name.length > 240) return 'File names must be between 1 and 240 characters.'
  if (file.size <= 0) return 'Choose a file that is not empty.'
  if (file.size > MAX_ATTACHMENT_BYTES) return 'Attachments must be 50 MB or smaller.'
  if (!attachmentMimeType(file)) return 'This file type is not supported.'
  return null
}

export async function getAttachments(workspaceId: string, target: AttachmentTarget, signal?: AbortSignal) {
  const params = targetQuery(target)
  params.set('workspaceId', workspaceId)
  return getJson(`/api/attachments?${params.toString()}`, attachmentListSchema, signal)
}

export async function uploadAttachment(workspaceId: string, target: AttachmentTarget, file: File) {
  const validation = validateAttachmentFile(file)
  if (validation) throw new ApiError('validation', 400, validation)
  const mimeType = attachmentMimeType(file)!
  const upload = await sendJson('/api/attachments/upload-url', 'POST', {
    workspaceId,
    ...target,
    name: file.name,
    mimeType,
    sizeBytes: file.size,
  }, uploadTargetSchema)
  const stored = await fetch(upload.uploadUrl, {
    method: upload.method,
    headers: upload.requiredHeaders,
    body: file,
  })
  if (!stored.ok) {
    throw new ApiError(apiErrorKind(stored.status), stored.status, 'The file could not be transferred to storage.')
  }
  return (await sendJson('/api/attachments', 'POST', upload.finalizePayload, attachmentResponseSchema)).attachment
}

export async function renameAttachment(workspaceId: string, attachmentId: string, name: string) {
  return (await sendJson(
    `/api/attachments/${encodeURIComponent(attachmentId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    'PATCH',
    { name },
    attachmentResponseSchema,
  )).attachment
}

export async function deleteAttachment(workspaceId: string, attachmentId: string) {
  return deleteJson(
    `/api/attachments/${encodeURIComponent(attachmentId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
    attachmentDeleteSchema,
  )
}

export async function getAttachmentDownload(workspaceId: string, attachmentId: string) {
  return getJson(
    `/api/attachments/${encodeURIComponent(attachmentId)}/download-url?workspaceId=${encodeURIComponent(workspaceId)}`,
    downloadTargetSchema,
  )
}
