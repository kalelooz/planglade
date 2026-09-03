import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  attachmentMimeType,
  canDeleteAttachment,
  getAttachmentDownload,
  getAttachments,
  isSafeAttachmentUrl,
  renameAttachment,
  uploadAttachment,
  validateAttachmentFile,
} from '@/lib/api/attachments'

const attachment = {
  id: 'attachment-1',
  workspaceId: 'workspace-1',
  workItemId: 'task-1',
  noteId: null,
  name: 'brief.txt',
  mimeType: 'text/plain',
  sizeBytes: 5,
  uploadedById: 'user-1',
  uploadedBy: { id: 'user-1', name: 'Alex', email: 'alex@example.test' },
  createdAt: '2026-09-03T00:00:00.000Z',
}

afterEach(() => vi.unstubAllGlobals())

describe('attachment API client', () => {
  it('infers safe MIME types and rejects unsupported or oversized files before upload', () => {
    expect(attachmentMimeType({ name: 'notes.md', type: '' })).toBe('text/markdown')
    expect(validateAttachmentFile({ name: 'script.exe', type: '', size: 12 })).toBe('This file type is not supported.')
    expect(validateAttachmentFile({ name: 'large.txt', type: 'text/plain', size: 50 * 1024 * 1024 + 1 })).toBe('Attachments must be 50 MB or smaller.')
  })

  it('accepts only root-relative or explicit HTTPS signed URLs', () => {
    expect(isSafeAttachmentUrl('/api/attachments/upload-binary?token=signed')).toBe(true)
    expect(isSafeAttachmentUrl('https://storage.example.test/object?signature=signed')).toBe(true)
    expect(isSafeAttachmentUrl('//attacker.example/upload')).toBe(false)
    expect(isSafeAttachmentUrl('/\\attacker.example/upload')).toBe(false)
    expect(isSafeAttachmentUrl('attachments/upload')).toBe(false)
    expect(isSafeAttachmentUrl('http://storage.example.test/object')).toBe(false)
  })

  it('shows permanent deletion only to a mutable uploader or workspace manager', () => {
    expect(canDeleteAttachment({ canMutate: true, role: 'MEMBER', currentUserId: 'user-1', uploadedById: 'user-1' })).toBe(true)
    expect(canDeleteAttachment({ canMutate: true, role: 'MEMBER', currentUserId: 'user-2', uploadedById: 'user-1' })).toBe(false)
    expect(canDeleteAttachment({ canMutate: true, role: 'ADMIN', currentUserId: 'user-2', uploadedById: 'user-1' })).toBe(true)
    expect(canDeleteAttachment({ canMutate: false, role: 'VIEWER', currentUserId: 'user-1', uploadedById: 'user-1' })).toBe(false)
  })

  it('reserves, transfers, and finalizes one exact attachment', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({
        uploadUrl: '/api/attachments/upload-binary?token=signed',
        method: 'PUT',
        requiredHeaders: { 'Content-Type': 'text/plain' },
        finalizePayload: {
          reservationId: '11111111-1111-4111-8111-111111111111',
          workspaceId: 'workspace-1',
          workItemId: 'task-1',
          name: 'brief.txt',
          storageKey: 'workspace-1/brief',
          mimeType: 'text/plain',
          sizeBytes: 5,
        },
      }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(Response.json({ attachment }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const file = new File(['brief'], 'brief.txt', { type: 'text/plain' })
    await expect(uploadAttachment('workspace-1', { workItemId: 'task-1' }, file)).resolves.toMatchObject({ id: 'attachment-1' })

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/attachments/upload-url', expect.objectContaining({ method: 'POST' }))
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/attachments/upload-binary?token=signed', {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: file,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/attachments', expect.objectContaining({ method: 'POST' }))
  })

  it('lists, renames, and creates a safe download target', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ attachments: [attachment], limitReached: false }))
      .mockResolvedValueOnce(Response.json({ attachment: { ...attachment, name: 'renamed.txt' } }))
      .mockResolvedValueOnce(Response.json({
        attachment: { id: attachment.id, name: 'renamed.txt', mimeType: 'text/plain', sizeBytes: 5 },
        downloadUrl: '/api/attachments/download-binary?token=signed',
        expiresInSeconds: 600,
      }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getAttachments('workspace-1', { noteId: 'note-1' })).resolves.toMatchObject({ attachments: [attachment], limitReached: false })
    await expect(renameAttachment('workspace-1', attachment.id, 'renamed.txt')).resolves.toMatchObject({ name: 'renamed.txt' })
    await expect(getAttachmentDownload('workspace-1', attachment.id)).resolves.toMatchObject({ expiresInSeconds: 600 })
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/attachments?noteId=note-1&workspaceId=workspace-1')
  })
})
