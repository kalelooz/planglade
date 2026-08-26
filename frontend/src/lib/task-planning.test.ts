import { describe, expect, it } from 'vitest'
import {
  buildBoardColumns,
  buildTaskPlanningProjection,
  buildTimelineRows,
  millisecondsUntilNextLocalDay,
} from '@/lib/task-planning'
import { DEFAULT_TASK_PRESENTATION } from '@/lib/task-views'
import type { Project, Task, TaskStatus } from '@/types'

const project = (id: string, name: string): Project => ({
  id,
  name,
  description: '',
  status: 'active',
  focus: '',
  targetDate: null,
  startDate: null,
  createdAt: 0,
})

const task = (id: string, patch: Partial<Task> = {}): Task => ({
  id,
  title: id,
  description: '',
  projectId: null,
  status: 'planned',
  priority: 'none',
  dueDate: null,
  parentId: null,
  noteIds: [],
  dependsOn: [],
  related: [],
  labelIds: [],
  assigneeId: null,
  createdAt: 0,
  updatedAt: 0,
  completedAt: null,
  history: [],
  ...patch,
})

describe('task planning', () => {
  it('schedules the next projection refresh at local midnight', () => {
    expect(millisecondsUntilNextLocalDay(new Date(2026, 7, 23, 23, 59, 59, 500))).toBe(500)
    expect(millisecondsUntilNextLocalDay(new Date(2026, 7, 23, 10, 0, 0, 0))).toBe(14 * 60 * 60 * 1000)
  })

  it('projects filters, ordering, groups, and counts from one presentation', () => {
    const projects = [project('alpha', 'Alpha')]
    const tasks = [
      task('done', { status: 'done', dueDate: '2026-08-22' }),
      task('later', { title: 'Later', projectId: 'alpha', priority: 'medium', dueDate: '2026-08-30' }),
      task('today-low', { title: 'Today low', projectId: 'alpha', priority: 'low', dueDate: '2026-08-23' }),
      task('today-high', { title: 'Today high', projectId: 'alpha', priority: 'high', dueDate: '2026-08-23' }),
      task('child', { parentId: 'today-high', dueDate: '2026-08-23' }),
    ]

    const projection = buildTaskPlanningProjection({
      tasks,
      projects,
      presentation: {
        ...DEFAULT_TASK_PRESENTATION,
        quick: ['today'],
        projects: ['alpha'],
        showCompleted: false,
        sort: 'priority',
        group: 'project',
      },
      isBlocked: () => false,
      now: new Date('2026-08-23T12:00:00Z'),
    })

    expect(projection.tasks.map((item) => item.id)).toEqual(['today-high', 'today-low'])
    expect(projection.groups.map((group) => [group.key, group.label, group.tasks.length])).toEqual([
      ['alpha', 'Alpha', 2],
    ])
    expect(projection.counts).toEqual([
      { label: 'Open', value: 3 },
      { label: 'Backlog', value: 0 },
      { label: 'In progress', value: 0 },
      { label: 'In review', value: 0 },
      { label: 'Done', value: 1 },
    ])
  })

  it('builds deterministic board columns and timeline rows', () => {
    const projects = [project('alpha', 'Alpha')]
    const tasks = [
      task('later', { projectId: 'alpha', status: 'in_progress', position: 20, startDate: '2026-08-24', dueDate: '2026-08-26' }),
      task('first', { projectId: 'alpha', status: 'in_progress', position: 10, dueDate: '2026-08-23' }),
      task('loose', { status: 'planned', dueDate: '2026-08-25' }),
      task('unscheduled'),
    ]
    const statuses: TaskStatus[] = ['planned', 'in_progress']

    expect(buildBoardColumns(tasks, statuses).get('in_progress')?.map((item) => item.id)).toEqual(['first', 'later'])
    expect(buildTimelineRows(tasks, projects).map((row) => [row.project?.id ?? null, row.tasks.map((item) => item.id)])).toEqual([
      ['alpha', ['later', 'first']],
      [null, ['loose']],
    ])
  })
})
