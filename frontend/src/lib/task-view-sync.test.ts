import { describe, expect, it } from 'vitest'
import { adaptTask } from '@/lib/api/adapters'
import { backendWorkItemSchema } from '@/lib/api/contracts'
import { replaceTaskInList } from '@/lib/api/tasks'

const source = backendWorkItemSchema.parse({
  id: 'task-cross-view',
  workspaceId: 'workspace-1',
  projectId: 'project-old',
  title: 'Cross-view task',
  description: 'Initial notes',
  checklist: [],
  noteIds: [],
  status: 'TODO',
  priority: 'MEDIUM',
  startDate: null,
  dueDate: '2026-07-24T00:00:00.000Z',
  completedAt: null,
  sortOrder: 0,
  position: 0,
  createdById: 'user-1',
  assigneeId: null,
  parentId: null,
  createdAt: '2026-07-21T00:00:00.000Z',
  updatedAt: '2026-07-21T00:00:00.000Z',
  labels: [],
})

describe('shared task projection synchronization', () => {
  it('replaces one authoritative record for project, calendar, home, and list projections', () => {
    const updated = { ...source, projectId: 'project-new', title: 'Edited task', dueDate: '2026-07-26T00:00:00.000Z', status: 'DONE' as const, completedAt: '2026-07-21T12:00:00.000Z' }
    const cache = replaceTaskInList([source], updated)
    const task = adaptTask(cache[0]!)

    expect(cache).toEqual([updated])
    expect(task).toMatchObject({
      title: 'Edited task',
      projectId: 'project-new',
      dueDate: '2026-07-26',
      status: 'done',
      completedAt: Date.parse('2026-07-21T12:00:00.000Z'),
    })
    expect(cache.filter((item) => item.projectId === 'project-old')).toHaveLength(0)
    expect(cache.filter((item) => item.projectId === 'project-new')).toHaveLength(1)
    expect(cache.filter((item) => item.dueDate === '2026-07-24T00:00:00.000Z')).toHaveLength(0)
    expect(cache.filter((item) => item.dueDate === '2026-07-26T00:00:00.000Z')).toHaveLength(1)
  })

  it('keeps a rejected response from changing the confirmed projection', () => {
    const confirmed = replaceTaskInList([source], source)
    expect(confirmed).toEqual([source])
    expect(adaptTask(confirmed[0]!).status).toBe('planned')
    expect(adaptTask(confirmed[0]!).projectId).toBe('project-old')
    expect(adaptTask(confirmed[0]!).dueDate).toBe('2026-07-24')
  })

  it('clears dated placement from every derived view when the confirmed date is null', () => {
    const cleared = { ...source, dueDate: null }
    const cache = replaceTaskInList([source], cleared)
    expect(adaptTask(cache[0]!).dueDate).toBeNull()
    expect(cache.filter((item) => item.dueDate !== null)).toHaveLength(0)
  })
})
