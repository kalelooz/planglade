import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Download, FileText, Loader2, Paperclip, Pencil, Trash2, Upload, X } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ATTACHMENT_ACCEPT,
  canDeleteAttachment,
  deleteAttachment,
  getAttachmentDownload,
  getAttachments,
  renameAttachment,
  uploadAttachment,
  validateAttachmentFile,
  type Attachment,
  type AttachmentList,
  type AttachmentTarget,
} from '@/lib/api/attachments'
import { toApiError } from '@/lib/api/errors'
import { getSession } from '@/lib/api/session'
import { cn } from '@/lib/utils'

function attachmentSize(sizeBytes: number | null) {
  if (sizeBytes === null) return 'Size unavailable'
  if (sizeBytes < 1024) return `${sizeBytes} B`
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
  return `${(sizeBytes / (1024 * 1024)).toFixed(sizeBytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`
}

function actionErrorMessage(error: unknown) {
  const apiError = toApiError(error)
  if (apiError.kind === 'unauthenticated') return 'Sign in again to work with attachments.'
  if (apiError.kind === 'forbidden') return 'You do not have permission to change this attachment.'
  if (apiError.kind === 'not_found') return 'This attachment is no longer available.'
  if (apiError.kind === 'conflict') return 'The upload expired or this workspace has reached its storage limit.'
  if (apiError.kind === 'validation') return error instanceof Error ? error.message : 'Check the file and try again.'
  if (apiError.status === 507) return 'The server does not have enough free storage for this file.'
  return 'The attachment service is temporarily unavailable. Try again.'
}

export function AttachmentSection({
  workspaceId,
  target,
  projectId,
  canUpload,
  className,
}: {
  workspaceId: string
  target: AttachmentTarget
  projectId?: string | null
  canUpload: boolean
  className?: string
}) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const deleteButtonRef = useRef<HTMLButtonElement>(null)
  const targetType = target.workItemId ? 'task' : 'note'
  const targetId = target.workItemId ?? target.noteId ?? ''
  const queryKey = ['attachments', workspaceId, targetType, targetId, projectId ?? 'no-project'] as const
  const [actionError, setActionError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Attachment | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const [deleting, setDeleting] = useState<Attachment | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const attachmentsQuery = useQuery({
    queryKey,
    queryFn: ({ signal }) => getAttachments(workspaceId, target, signal),
    retry: false,
  })
  const sessionQuery = useQuery({
    queryKey: ['session', workspaceId],
    queryFn: ({ signal }) => getSession(workspaceId, signal),
    retry: false,
  })
  const role = sessionQuery.data?.workspaces?.find((workspace) => workspace.id === workspaceId)?.role
  const currentUserId = sessionQuery.data?.user.id
  const canDelete = (attachment: Attachment) => canDeleteAttachment({
    canMutate: canUpload,
    currentUserId,
    role,
    uploadedById: attachment.uploadedById,
  })

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadAttachment(workspaceId, target, file),
    onSuccess: (created) => {
      queryClient.setQueryData<AttachmentList>(queryKey, (current) => {
        const attachments = [created, ...(current?.attachments ?? []).filter((item) => item.id !== created.id)]
        return {
          attachments: attachments.slice(0, 200),
          limitReached: Boolean(current?.limitReached || attachments.length > 200),
        }
      })
      void queryClient.invalidateQueries({ queryKey })
      setActionError(null)
    },
    onError: (error) => setActionError(actionErrorMessage(error)),
  })
  const renameMutation = useMutation({
    mutationFn: ({ attachmentId, name }: { attachmentId: string; name: string }) => renameAttachment(workspaceId, attachmentId, name),
    onSuccess: (updated) => {
      queryClient.setQueryData<AttachmentList>(queryKey, (current) => ({
        attachments: (current?.attachments ?? []).map((item) => item.id === updated.id ? updated : item),
        limitReached: current?.limitReached ?? false,
      }))
      setEditing(null)
      setRenameDraft('')
      setActionError(null)
    },
    onError: (error) => setActionError(actionErrorMessage(error)),
  })
  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => deleteAttachment(workspaceId, attachmentId),
    onSuccess: (_result, attachmentId) => {
      queryClient.setQueryData<AttachmentList>(queryKey, (current) => ({
        attachments: (current?.attachments ?? []).filter((item) => item.id !== attachmentId),
        limitReached: current?.limitReached ?? false,
      }))
      void queryClient.invalidateQueries({ queryKey })
      setDeleting(null)
      setDeleteError(null)
      setActionError(null)
    },
    onError: (error) => {
      setDeleteError(actionErrorMessage(error))
      requestAnimationFrame(() => deleteButtonRef.current?.focus())
    },
  })

  const selectFile = (file: File | undefined) => {
    if (!file || uploadMutation.isPending) return
    const validation = validateAttachmentFile(file)
    if (validation) {
      setActionError(validation)
      return
    }
    setActionError(null)
    uploadMutation.mutate(file)
  }

  const download = async (attachment: Attachment) => {
    if (downloadingId) return
    setDownloadingId(attachment.id)
    setActionError(null)
    try {
      const result = await getAttachmentDownload(workspaceId, attachment.id)
      const anchor = document.createElement('a')
      anchor.href = result.downloadUrl
      anchor.download = result.attachment.name
      anchor.rel = 'noopener'
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
    } catch (error) {
      setActionError(actionErrorMessage(error))
    } finally {
      setDownloadingId(null)
    }
  }

  const attachmentsError = attachmentsQuery.isError ? toApiError(attachmentsQuery.error) : null
  const unavailable = attachmentsError?.kind === 'forbidden'

  return (
    <section aria-label="Attachments" className={cn('min-w-0', className)} data-attachment-section>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Paperclip className="size-3.5 text-muted-foreground" aria-hidden="true" /> Attachments
            {attachmentsQuery.data && <span className="font-normal text-muted-foreground">· {attachmentsQuery.data.attachments.length}</span>}
          </h3>
          <p className="mt-0.5 text-[12px] text-muted-foreground">50 MB per file. Workspace storage limits apply.</p>
        </div>
        {canUpload && !unavailable && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept={ATTACHMENT_ACCEPT}
              aria-label="Add attachment"
              className="sr-only"
              onChange={(event) => {
                selectFile(event.target.files?.[0])
                event.currentTarget.value = ''
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-11 shrink-0 lg:h-8"
              disabled={uploadMutation.isPending}
              onClick={() => inputRef.current?.click()}
            >
              {uploadMutation.isPending ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Upload className="size-3.5" aria-hidden="true" />}
              {uploadMutation.isPending ? 'Uploading…' : 'Add file'}
            </Button>
          </>
        )}
      </div>

      {actionError && <p role="alert" className="mt-2 text-xs text-destructive">{actionError}</p>}
      {unavailable ? (
        <p className="mt-3 rounded-md border border-border bg-muted/35 px-3 py-2 text-xs text-muted-foreground">Attachments are unavailable for this item.</p>
      ) : attachmentsQuery.isLoading ? (
        <p role="status" className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />Loading attachments…</p>
      ) : attachmentsQuery.isError ? (
        <div role="alert" className="mt-3 rounded-md border border-destructive/35 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <p>Attachments could not be loaded.</p>
          <button type="button" className="mt-1 font-medium underline underline-offset-2" onClick={() => void attachmentsQuery.refetch()}>Try again</button>
        </div>
      ) : attachmentsQuery.data?.attachments.length ? (
        <ul className="mt-3 max-h-44 space-y-2 overflow-y-auto pr-1 scrollbar-thin">
          {attachmentsQuery.data.attachments.map((attachment) => (
            <li key={attachment.id} className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2">
              <span className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground"><FileText className="size-4" aria-hidden="true" /></span>
              {editing?.id === attachment.id ? (
                <form
                  className="flex min-w-0 flex-1 items-center gap-1.5"
                  onSubmit={(event) => {
                    event.preventDefault()
                    const name = renameDraft.trim()
                    if (!name || name.length > 240 || name === attachment.name) return
                    renameMutation.mutate({ attachmentId: attachment.id, name })
                  }}
                >
                  <Input aria-label={`Rename ${attachment.name}`} value={renameDraft} maxLength={240} onChange={(event) => setRenameDraft(event.target.value)} className="h-9 min-w-0 flex-1" autoFocus />
                  <Button type="submit" size="icon" variant="ghost" className="size-11 lg:size-9" disabled={!renameDraft.trim() || renameDraft.trim() === attachment.name || renameMutation.isPending} aria-label={`Save name for ${attachment.name}`}><Check className="size-3.5" /></Button>
                  <Button type="button" size="icon" variant="ghost" className="size-11 lg:size-9" onClick={() => setEditing(null)} aria-label={`Cancel renaming ${attachment.name}`}><X className="size-3.5" /></Button>
                </form>
              ) : (
                <>
                  <button type="button" onClick={() => void download(attachment)} className="min-h-11 min-w-0 flex-1 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Download ${attachment.name}`}>
                    <span className="block truncate text-sm font-medium">{attachment.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{attachmentSize(attachment.sizeBytes)} · {attachment.uploadedBy.name ?? attachment.uploadedBy.email}</span>
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <Button type="button" size="icon" variant="ghost" className="hidden size-9 lg:inline-flex" onClick={() => void download(attachment)} disabled={downloadingId === attachment.id} aria-label={`Download ${attachment.name}`}>
                      {downloadingId === attachment.id ? <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" /> : <Download className="size-3.5" />}
                    </Button>
                    {canUpload && <Button type="button" size="icon" variant="ghost" className="size-11 lg:size-9" onClick={() => { setEditing(attachment); setRenameDraft(attachment.name) }} aria-label={`Rename ${attachment.name}`}><Pencil className="size-3.5" /></Button>}
                    {canDelete(attachment) && <Button type="button" size="icon" variant="ghost" className="size-11 text-destructive hover:text-destructive lg:size-9" onClick={() => { setDeleting(attachment); setDeleteError(null) }} aria-label={`Delete ${attachment.name}`}><Trash2 className="size-3.5" /></Button>}
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">No attachments yet.</p>
      )}
      {attachmentsQuery.data?.limitReached && <p className="mt-2 text-xs text-muted-foreground">Loaded the 200 newest attachments. Older files may not appear.</p>}

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open && !deleteMutation.isPending) { setDeleting(null); setDeleteError(null) } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this attachment?</AlertDialogTitle>
            <AlertDialogDescription>“{deleting?.name}” will be removed from this item and its stored file will be queued for permanent deletion.</AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p role="alert" className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Keep attachment</AlertDialogCancel>
            <AlertDialogAction
              ref={deleteButtonRef}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault()
                if (deleting) {
                  setDeleteError(null)
                  deleteMutation.mutate(deleting.id)
                }
              }}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete attachment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
