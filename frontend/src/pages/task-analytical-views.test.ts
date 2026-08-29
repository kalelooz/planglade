import { describe, expect, it } from 'vitest'
import type { Project, Task } from '@/types'
import { buildTaskOverview, buildTaskTimelineProjection, MAX_TIMELINE_DAYS } from '@/lib/task-analytical-models'

function task(id: string, patch: Partial<Task> = {}): Task {
  return {
    id, title: id, description: '', status: 'planned', priority: 'none', projectId: null, parentId: null,
    dueDate: null, completedAt: null, createdAt: 0, updatedAt: 0, position: 0,
    dependsOn: [], related: [], labelIds: [], assigneeId: null, history: [], ...patch,
  }
}

function project(id: string): Project {
  return { id, name: id, description: '', status: 'active', focus: '', targetDate: null, startDate: null, createdAt: 0 }
}

const today = new Date('2026-07-31T00:00:00')

describe('analytical task views', () => {
  it('builds one validated projection for a normal scheduled span', () => {
    const projection = buildTaskTimelineProjection([
      task('scheduled', { dueDate: '2026-08-05', source: { startDate: '2026-07-29T00:00:00.000Z' } as Task['source'] }),
    ], [], today)

    expect(projection.range).toMatchObject({ days: 15, bounded: false })
    expect(projection.range?.start.getDate()).toBe(29)
    expect(projection.spans.map((span) => ({ id: span.task.id, startDay: span.startDay, durationDays: span.durationDays }))).toEqual([
      { id: 'scheduled', startDay: 0, durationDays: 8 },
    ])
    expect(projection.counts).toEqual({ scheduled: 1, unscheduled: 0, invalidDates: 0, beforeRange: 0, afterRange: 0, clipped: 0 })
  })

  it('anchors ancient and far-future tasks to the bounded interval edges', () => {
    const projection = buildTaskTimelineProjection([
      task('ancient', { dueDate: '2010-01-01' }),
      task('future', { dueDate: '2040-01-01' }),
    ], [], today)

    expect(projection.range).toMatchObject({ days: MAX_TIMELINE_DAYS, bounded: true })
    expect(projection.range?.start).toEqual(new Date('2026-07-01T00:00:00'))
    expect(projection.range?.end).toEqual(new Date('2027-07-05T00:00:00'))
    expect(projection.spans.map((span) => ({ id: span.task.id, startDay: span.startDay, durationDays: span.durationDays, offRange: span.offRange }))).toEqual([
      { id: 'ancient', startDay: 0, durationDays: 1, offRange: 'before' },
      { id: 'future', startDay: MAX_TIMELINE_DAYS - 1, durationDays: 1, offRange: 'after' },
    ])
    expect(projection.counts).toMatchObject({ scheduled: 2, beforeRange: 1, afterRange: 1, clipped: 2 })
  })

  it('clips cross-boundary spans to both ends without exceeding the day allocation', () => {
    const projection = buildTaskTimelineProjection([
      task('cross-start', { startDate: '2010-01-01', dueDate: '2026-07-10' }),
      task('cross-end', { startDate: '2027-07-01', dueDate: '2040-01-01' }),
      task('cross-both', { startDate: '2010-01-01', dueDate: '2040-01-01' }),
    ], [], today)

    expect(projection.spans.map((span) => ({
      id: span.task.id,
      startDay: span.startDay,
      durationDays: span.durationDays,
      startsBeforeRange: span.startsBeforeRange,
      endsAfterRange: span.endsAfterRange,
    }))).toEqual([
      { id: 'cross-start', startDay: 0, durationDays: 10, startsBeforeRange: true, endsAfterRange: false },
      { id: 'cross-end', startDay: 365, durationDays: 5, startsBeforeRange: false, endsAfterRange: true },
      { id: 'cross-both', startDay: 0, durationDays: MAX_TIMELINE_DAYS, startsBeforeRange: true, endsAfterRange: true },
    ])
    expect(Math.max(...projection.spans.map((span) => span.startDay + span.durationDays))).toBe(MAX_TIMELINE_DAYS)
    expect(projection.counts).toMatchObject({ beforeRange: 0, afterRange: 0, clipped: 3 })
  })

  it('keeps valid rows and counts while quarantining mixed invalid dates', () => {
    const projects = [project('alpha')]
    const projection = buildTaskTimelineProjection([
      task('valid', { projectId: 'alpha', startDate: '2026-07-30', dueDate: '2026-08-02' }),
      task('invalid-due', { projectId: 'alpha', dueDate: 'not-a-date' }),
      task('invalid-start', { startDate: '2026-02-30', dueDate: '2026-08-03' }),
      task('orphan', { projectId: 'missing', dueDate: '2026-08-04' }),
      task('undated'),
      task('done-undated', { status: 'done' }),
    ], projects, today)

    expect(projection.spans.map((span) => [span.task.id, span.start, span.end])).toEqual([
      ['valid', new Date('2026-07-30T00:00:00'), new Date('2026-08-02T00:00:00')],
      ['invalid-start', new Date('2026-08-03T00:00:00'), new Date('2026-08-03T00:00:00')],
      ['orphan', new Date('2026-08-04T00:00:00'), new Date('2026-08-04T00:00:00')],
    ])
    expect(projection.rows.map((row) => [row.project?.id ?? null, row.spans.map((span) => span.task.id)])).toEqual([
      ['alpha', ['valid']],
      [null, ['invalid-start', 'orphan']],
    ])
    expect(projection.counts).toEqual({ scheduled: 3, unscheduled: 1, invalidDates: 2, beforeRange: 0, afterRange: 0, clipped: 0 })
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
