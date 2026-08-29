import { describe, expect, it } from 'vitest'
import { indexTasksByParent } from '@/lib/task-parent-index'
import type { Task } from '@/types'

function task(id: string, parentId: string | null): Task {
  return {
    id, parentId, title: id, description: '', projectId: null, status: 'planned', priority: 'none', dueDate: null,
    dependsOn: [], related: [], labelIds: [], assigneeId: null, createdAt: 0, updatedAt: 0, completedAt: null, history: [],
  }
}

describe('task parent index', () => {
  it('projects children once by parent while preserving task order', () => {
    const index = indexTasksByParent([
      task('root', null),
      task('child-b', 'parent-1'),
      task('other', 'parent-2'),
      task('child-a', 'parent-1'),
    ])

    expect(index.get('parent-1')?.map(({ id }) => id)).toEqual(['child-b', 'child-a'])
    expect(index.get('parent-2')?.map(({ id }) => id)).toEqual(['other'])
    expect(index.has('root')).toBe(false)
  })
})
