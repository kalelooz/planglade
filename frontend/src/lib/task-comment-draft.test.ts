import { describe, expect, it } from 'vitest'
import {
  clearSubmittedCommentDraft,
  commentDraftBody,
  createTaskCommentDraftMap,
  taskCommentInvalidationKeys,
  updateCommentDraft,
} from '@/lib/task-comment-draft'

describe('task comment draft scoping', () => {
  it('preserves task drafts across A to B to A navigation', () => {
    const taskA = { workspaceId: 'workspace-1', taskId: 'task-a' }
    const taskB = { workspaceId: 'workspace-1', taskId: 'task-b' }
    let drafts = createTaskCommentDraftMap()

    drafts = updateCommentDraft(drafts, taskA, 'comment A')
    expect(commentDraftBody(drafts, taskB)).toBe('')

    drafts = updateCommentDraft(drafts, taskB, 'comment B')
    expect(commentDraftBody(drafts, taskA)).toBe('comment A')
    expect(commentDraftBody(drafts, taskB)).toBe('comment B')
  })

  it('keeps drafts isolated between workspaces with the same task id', () => {
    const workspaceA = { workspaceId: 'workspace-a', taskId: 'task-1' }
    const workspaceB = { workspaceId: 'workspace-b', taskId: 'task-1' }
    let drafts = createTaskCommentDraftMap()

    drafts = updateCommentDraft(drafts, workspaceA, 'workspace A')
    drafts = updateCommentDraft(drafts, workspaceB, 'workspace B')

    expect(commentDraftBody(drafts, workspaceA)).toBe('workspace A')
    expect(commentDraftBody(drafts, workspaceB)).toBe('workspace B')
  })

  it('invalidates keys from the submitted scope rather than the currently rendered task', () => {
    expect(taskCommentInvalidationKeys({ workspaceId: 'workspace-a', taskId: 'task-a' })).toEqual([
      ['task-comments', 'workspace-a', 'task-a'],
      ['notifications', 'workspace-a'],
    ])
  })

  it('clears only the exact successfully submitted scope and body', () => {
    const taskA = { workspaceId: 'workspace-1', taskId: 'task-a' }
    const taskB = { workspaceId: 'workspace-1', taskId: 'task-b' }
    let drafts = createTaskCommentDraftMap()
    drafts = updateCommentDraft(drafts, taskA, 'comment A')
    drafts = updateCommentDraft(drafts, taskB, 'comment B')

    const unchanged = clearSubmittedCommentDraft(drafts, { ...taskA, body: 'older value' })
    expect(unchanged).toBe(drafts)

    const cleared = clearSubmittedCommentDraft(drafts, { ...taskA, body: 'comment A' })
    expect(commentDraftBody(cleared, taskA)).toBe('')
    expect(commentDraftBody(cleared, taskB)).toBe('comment B')
  })
})
