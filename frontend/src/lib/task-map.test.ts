import { describe, expect, it } from 'vitest'
import { buildTaskMapRelations, layoutTaskMap } from '@/lib/task-map'
import type { Task } from '@/types'

const task = (id: string, projectId: string | null, title: string): Task => ({
  id, projectId, title, description: '', status: 'planned', priority: 'none', dueDate: null,
  completedAt: null, createdAt: 0, updatedAt: 0, noteIds: [], labelIds: [], assigneeId: null,
  parentId: null, dependsOn: [], related: [], history: [],
})

describe('layoutTaskMap', () => {
  it('keeps project task groups deterministic and includes unassigned tasks', () => {
    const layout = layoutTaskMap([
      task('2', 'project-a', 'Beta'), task('1', 'project-a', 'Alpha'), task('3', null, 'Loose task'),
    ], [{ id: 'project-a', name: 'Project A', description: '', status: 'active', focus: '', targetDate: null, startDate: null, createdAt: 0 }])

    expect(layout.map((node) => [node.id, node.projectName, node.x, node.y])).toEqual([
      ['1', 'Project A', 0, 0], ['2', 'Project A', 0, 120], ['3', 'No project', 300, 0],
    ])
  })

  it('builds project, dependency, and deduplicated related edges for visible tasks', () => {
    const project = { id: 'project-a', name: 'Project A', description: '', status: 'active' as const, focus: '', targetDate: null, startDate: null, createdAt: 0 }
    const first = { ...task('1', 'project-a', 'First'), related: ['2'] }
    const second = { ...task('2', 'project-a', 'Second'), dependsOn: ['1'], related: ['1'] }
    const visible = new Set(['project-Project A', '1', '2'])

    expect(buildTaskMapRelations([first, second], [project], visible, 'all').map((edge) => edge.kind)).toEqual(['structure', 'structure', 'related', 'depends'])
    expect(buildTaskMapRelations([first, second], [project], visible, 'dependencies').every((edge) => edge.kind !== 'structure')).toBe(true)
  })
})
