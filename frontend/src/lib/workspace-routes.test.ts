import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_PATHS,
  canonicalizeLegacyWorkspaceLocation,
  withPreservedLocation,
  workspaceNotePath,
  workspaceProjectPath,
  workspaceTasksPath,
} from './workspace-routes'

describe('workspace routes', () => {
  it('exposes canonical workspace paths and builders under /app', () => {
    expect(WORKSPACE_PATHS).toEqual({
      home: '/app',
      inbox: '/app/inbox',
      tasks: '/app/tasks',
      projects: '/app/projects',
      notes: '/app/notes',
      calendar: '/app/calendar',
      connections: '/app/connections',
      settings: '/app/settings',
    })
    expect(workspaceProjectPath('project 1')).toBe('/app/projects/project%201')
    expect(workspaceNotePath('note & one')).toBe('/app/notes?note=note+%26+one')
    expect(workspaceTasksPath({ view: 'board' })).toBe('/app/tasks?view=board')
  })

  it('falls back safely when a project id cannot be one path segment', () => {
    const controlCharacterId = `project${String.fromCharCode(0)}`
    for (const projectId of [undefined, null, '', '.', '..', 'project/child', 'project\\child', 'project?tab=notes', 'project#notes', controlCharacterId]) {
      expect(workspaceProjectPath(projectId)).toBe(WORKSPACE_PATHS.projects)
    }
  })

  it('canonicalizes legacy workspace locations while preserving query and hash', () => {
    expect(canonicalizeLegacyWorkspaceLocation('/projects/project%201', '?tab=notes', '#today'))
      .toBe('/app/projects/project%201?tab=notes#today')
    expect(canonicalizeLegacyWorkspaceLocation('/notes', '?note=note-1', '#editor'))
      .toBe('/app/notes?note=note-1#editor')
    expect(canonicalizeLegacyWorkspaceLocation('/not-a-workspace-route', '?q=one', '#two')).toBeNull()
  })

  it('preserves unrelated params and hash while forcing required redirect params', () => {
    expect(withPreservedLocation(WORKSPACE_PATHS.tasks, { search: '?q=launch&view=list&view=timeline', hash: '#task-1' }, { view: 'board' }))
      .toBe('/app/tasks?q=launch&view=board#task-1')
    expect(withPreservedLocation(WORKSPACE_PATHS.tasks, { search: '?q=launch%20plan&flag&view=list', hash: '#task%201' }, { view: 'board' }))
      .toBe('/app/tasks?q=launch%20plan&flag&view=board#task%201')
    expect(canonicalizeLegacyWorkspaceLocation('/board', '?q=launch&view=list', '#task-1'))
      .toBe('/app/tasks?q=launch&view=board#task-1')
    expect(canonicalizeLegacyWorkspaceLocation('/my-tasks', '?group=project&filter=all', '#today'))
      .toBe('/app/tasks?group=project&filter=mine#today')
  })
})
