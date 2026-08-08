import { describe, expect, it } from 'vitest'
import type { BackendSavedView } from '@/lib/api/contracts'
import { presentationToSavedView, savedViewPlacement, savedViewToPresentation } from '@/lib/saved-presentations'
import { DEFAULT_TASK_PRESENTATION } from '@/lib/task-views'

const saved: BackendSavedView = {
  id: 'saved-1', workspaceId: 'workspace-1', projectId: null, createdById: 'user-1', name: 'Launch risks',
  layout: 'overview', groupBy: 'project', orderBy: 'priority',
  filters: { search: 'launch', quick: ['blocked'], projects: ['p1'], priorities: ['high'], showCompleted: false },
  display: { version: 1, density: 'compact', fields: ['project', 'dueDate'], pinned: false, position: 2 },
  isDefault: false, createdAt: '2026-07-31T00:00:00.000Z', updatedAt: '2026-07-31T00:00:00.000Z',
}

describe('saved task presentations', () => {
  it('restores filters, layout, display, and placement', () => {
    expect(savedViewToPresentation(saved)).toMatchObject({ view: 'list', search: 'launch', quick: ['blocked'], group: 'project', sort: 'priority', density: 'compact', showCompleted: false })
    expect(savedViewPlacement(saved)).toEqual({ pinned: false, position: 2 })
  })

  it('serializes the versioned presentation contract', () => {
    expect(presentationToSavedView('workspace-1', 'My view', { ...DEFAULT_TASK_PRESENTATION, view: 'timeline' }, { pinned: true, position: 1 })).toMatchObject({
      workspaceId: 'workspace-1', name: 'My view', layout: 'timeline', display: { version: 1, pinned: true, position: 1 },
    })
  })

  it('maps legacy kanban views to Board', () => {
    expect(savedViewToPresentation({ ...saved, layout: 'kanban' }).view).toBe('board')
  })

  it('maps removed task views to List', () => {
    expect(['calendar', 'map', 'overview'].map((layout) => savedViewToPresentation({ ...saved, layout }).view)).toEqual(['list', 'list', 'list'])
  })
})
