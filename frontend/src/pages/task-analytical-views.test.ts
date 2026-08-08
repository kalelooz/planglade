import { describe, expect, it } from 'vitest'
import type { Task } from '@/types'
import { buildTaskOverview, buildTaskTimelineRange } from '@/lib/task-analytical-models'

function task(id: string, patch: Partial<Task> = {}): Task {
  return {
    id, title: id, description: '', status: 'planned', priority: 'none', projectId: null, parentId: null,
    dueDate: null, completedAt: null, createdAt: 0, updatedAt: 0, position: 0,
    dependsOn: [], related: [], labelIds: [], assigneeId: null, history: [], ...patch,
  }
}

describe('analytical task views', () => {
  it('builds a minimum two-week timeline and uses start dates for task spans', () => {
    const result = buildTaskTimelineRange([
      task('scheduled', { dueDate: '2026-08-05', source: { startDate: '2026-07-29' } as Task['source'] }),
    ], new Date('2026-07-31T00:00:00'))
    expect(result?.start.getDate()).toBe(29)
    expect(result?.days).toBe(15)
    expect(buildTaskTimelineRange([task('undated')])).toBeNull()
  })

  it('derives Overview health only from real task state', () => {
    const data = buildTaskOverview([
      task('overdue', { dueDate: '2026-07-30' }),
      task('upcoming', { dueDate: '2026-08-03' }),
      task('blocked'),
      task('done', { status: 'done', dueDate: '2026-07-20' }),
    ], (item) => item.id === 'blocked', new Date('2026-07-31T00:00:00'))
    expect(data.open.map((item) => item.id)).toEqual(['overdue', 'upcoming', 'blocked'])
    expect(data.done.map((item) => item.id)).toEqual(['done'])
    expect(data.overdue.map((item) => item.id)).toEqual(['overdue'])
    expect(data.upcoming.map((item) => item.id)).toEqual(['upcoming'])
    expect(data.blocked.map((item) => item.id)).toEqual(['blocked'])
  })
})
