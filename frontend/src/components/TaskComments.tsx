import { useId, useMemo, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MessageCircle, RefreshCw, Send } from 'lucide-react'

import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { createWorkItemComment, getWorkItemComments, type WorkItemComment } from '@/lib/api/comments'
import { cn } from '@/lib/utils'
import {
  taskCommentInvalidationKeys,
  type TaskCommentSubmission,
} from '@/lib/task-comment-draft'

export type TaskCommentsProps = {
  workspaceId: string
  taskId: string
  members: Array<{ id: string; name: string; role: string }>
  canComment: boolean
  draftBody: string
  onDraftChange: (body: string) => void
  onDraftSubmitted: (submission: TaskCommentSubmission) => void
}

const commentsKey = (workspaceId: string, taskId: string) => ['task-comments', workspaceId, taskId] as const

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return parts.length === 0 ? '?' : parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
}

function displayName(comment: WorkItemComment) {
  return comment.author.name?.trim() || comment.author.email.trim() || 'Teammate'
}

function displayDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

export function TaskComments({
  workspaceId,
  taskId,
  members,
  canComment,
  draftBody,
  onDraftChange,
  onDraftSubmitted,
}: TaskCommentsProps) {
  const queryClient = useQueryClient()
  const composerId = useId()
  const body = draftBody
  const query = useQuery({
    queryKey: commentsKey(workspaceId, taskId),
    queryFn: ({ signal }) => getWorkItemComments(workspaceId, taskId, signal),
    retry: false,
  })
  const mutation = useMutation({
    mutationFn: (submission: TaskCommentSubmission) => createWorkItemComment(
      submission.workspaceId,
      submission.taskId,
      { body: submission.body },
    ),
    retry: false,
    onSuccess: async (_comment, submission) => {
      onDraftSubmitted(submission)
      const [submittedCommentsKey, submittedNotificationsKey] = taskCommentInvalidationKeys(submission)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: submittedCommentsKey }),
        queryClient.invalidateQueries({ queryKey: submittedNotificationsKey }),
      ])
    },
  })
  const handles = useMemo(() => members.map((member) => member.name.trim().toLowerCase().replace(/[\s_-]+/g, '.')).filter(Boolean).slice(0, 3), [members])
  const comments = query.data ?? []

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const value = body.trim()
    if (canComment && value && !mutation.isPending) mutation.mutate({ workspaceId, taskId, body: value })
  }

  return (
    <section aria-labelledby={`${composerId}-title`} className="min-w-0 px-5 py-3.5">
      <div className="mb-2 flex items-center gap-2">
        <MessageCircle className="size-4 text-muted-foreground" aria-hidden="true" />
        <h2 id={`${composerId}-title`} className="pg-section-title">Comments</h2>
        {comments.length > 0 && <span className="text-[12px] tabular-nums text-muted-foreground">{comments.length}</span>}
      </div>

      {query.isLoading ? (
        <div role="status" aria-label="Loading comments" className="space-y-3">
          {[0, 1].map((item) => <Skeleton key={item} className="h-14 w-full" />)}
        </div>
      ) : query.isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3 text-sm">
          <p className="text-destructive">Comments could not be loaded.</p>
          <Button type="button" variant="ghost" onClick={() => void query.refetch()} className="h-11 px-3 lg:h-8"><RefreshCw className="size-3.5" /> Try again</Button>
        </div>
      ) : comments.length > 0 ? (
        <div aria-label="Task comments">
          {comments.map((comment) => {
            const author = displayName(comment)
            return (
              <article key={comment.id} className="flex gap-3 border-b border-border/50 py-3 first:pt-0 last:border-b-0 last:pb-0">
                <Avatar className="mt-0.5 size-8 border border-border/60"><AvatarFallback className="text-xs">{initials(author)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2"><p className="text-[13px] font-semibold">{author}</p><time dateTime={comment.createdAt} className="text-[12px] text-muted-foreground">{displayDate(comment.createdAt)}</time></div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">{comment.body}</p>
                </div>
              </article>
            )
          })}
        </div>
      ) : null}

      {canComment ? (
        <form onSubmit={submit} className={cn('flex flex-wrap items-end gap-2', comments.length > 0 && 'mt-3 border-t border-border/60 pt-3')}>
          <label htmlFor={composerId} className="sr-only">Write a comment</label>
          <Textarea id={composerId} value={body} onChange={(event) => onDraftChange(event.target.value)} placeholder={handles.length > 0 ? 'Add a comment… use @ to mention' : 'Add a comment…'} maxLength={5000} rows={1} disabled={mutation.isPending} className="min-h-11 min-w-0 max-h-32 flex-1 resize-y bg-background/60 py-2.5 text-sm focus:min-h-20" />
          <Button type="submit" size="sm" disabled={!body.trim() || mutation.isPending} aria-label={mutation.isPending ? 'Posting comment' : 'Post comment'} className="size-11 shrink-0 px-0 lg:size-9"><Send className="size-3.5" /></Button>
          {mutation.isError && <p role="alert" className="w-full text-[12px] text-destructive">This comment was not posted. Your draft is still here.</p>}
        </form>
      ) : <p className="text-[12px] text-muted-foreground">Comments are read-only for you.</p>}
    </section>
  )
}
