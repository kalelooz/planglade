export type TaskCommentScope = Readonly<{ workspaceId: string; taskId: string }>
export type TaskCommentSubmission = Readonly<TaskCommentScope & { body: string }>
export type TaskCommentDraftMap = ReadonlyMap<string, ReadonlyMap<string, string>>

export function createTaskCommentDraftMap(): TaskCommentDraftMap {
  return new Map()
}

export function commentDraftBody(drafts: TaskCommentDraftMap, scope: TaskCommentScope) {
  return drafts.get(scope.workspaceId)?.get(scope.taskId) ?? ''
}

export function updateCommentDraft(
  drafts: TaskCommentDraftMap,
  scope: TaskCommentScope,
  body: string,
): TaskCommentDraftMap {
  if (commentDraftBody(drafts, scope) === body) return drafts

  const workspaceDrafts = new Map(drafts.get(scope.workspaceId))
  workspaceDrafts.set(scope.taskId, body)
  const next = new Map(drafts)
  next.set(scope.workspaceId, workspaceDrafts)
  return next
}

export function taskCommentInvalidationKeys(scope: TaskCommentScope) {
  return [
    ['task-comments', scope.workspaceId, scope.taskId] as const,
    ['notifications', scope.workspaceId] as const,
  ] as const
}

export function clearSubmittedCommentDraft(
  drafts: TaskCommentDraftMap,
  submission: TaskCommentSubmission,
): TaskCommentDraftMap {
  const workspaceDrafts = drafts.get(submission.workspaceId)
  const body = workspaceDrafts?.get(submission.taskId)
  if (body === undefined || body.trim() !== submission.body) return drafts

  const nextWorkspaceDrafts = new Map(workspaceDrafts)
  nextWorkspaceDrafts.delete(submission.taskId)
  const next = new Map(drafts)
  if (nextWorkspaceDrafts.size === 0) next.delete(submission.workspaceId)
  else next.set(submission.workspaceId, nextWorkspaceDrafts)
  return next
}
