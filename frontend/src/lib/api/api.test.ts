import { afterEach, describe, expect, it, vi } from 'vitest'
import { adaptInboxItem, adaptProject, adaptTask, applyWorkItemRelations, buildApiWorkspaceState } from '@/lib/api/adapters'
import { backendNoteSchema, backendProjectSchema, backendWorkItemRelationSchema, backendWorkItemSchema, sessionSchema } from '@/lib/api/contracts'
import { createNote, deleteNote, getNotes, updateNote } from '@/lib/api/notes'
import { createProject, deleteProject, getProjects, replaceProjectInList, updateProject } from '@/lib/api/projects'
import { createBlockedByRelation, deleteWorkItemRelation, getWorkItemRelations } from '@/lib/api/relations'
import { getSession } from '@/lib/api/session'
import { getUserSettings, updateUserSettings } from '@/lib/api/settings'
import { importWorkspace, parseWorkspaceImport, previewWorkspaceImport } from '@/lib/api/imports'
import { canMutateTasksForAuthMode, createTask, deleteTask, getInboxItems, getTaskHistory, getTasks, removeInboxFromList, removeTaskFromList, replaceInboxInList, replaceTaskInList, updateTask } from '@/lib/api/tasks'
import { createWorkspace, getWorkspaceExport, updateWorkspace } from '@/lib/api/workspace'
import { resolveDataMode } from '@/lib/data-mode'
import { apiErrorKind } from '@/lib/api/errors'

const project = backendProjectSchema.parse({
  id: 'project-1',
  workspaceId: 'workspace-1',
  name: 'Launch',
  slug: 'launch',
  description: 'Ship the product',
  status: 'IN_REVIEW',
  mode: 'STANDARD',
  featureFlags: { tasks: true },
  color: '#334455',
  startDate: '2026-07-01T00:00:00.000Z',
  dueDate: '2026-07-31T00:00:00.000Z',
  archivedAt: null,
  createdById: 'user-1',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-02T00:00:00.000Z',
  futureField: 'retained',
})

const task = backendWorkItemSchema.parse({
  id: 'task-1',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  title: 'Verify production foundation',
  description: null,
  checklist: [{ text: 'Build', done: true }],
  noteIds: ['note-1'],
  status: 'IN_REVIEW',
  priority: 'URGENT',
  startDate: null,
  dueDate: '2026-07-20T00:00:00.000Z',
  completedAt: null,
  sortOrder: 0,
  position: 1,
  createdById: 'user-1',
  assigneeId: 'user-1',
  parentId: null,
  createdAt: '2026-07-10T10:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
  labels: [{
    label: {
      id: 'label-1',
      workspaceId: 'workspace-1',
      name: 'Release',
      color: '#336699',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    },
  }],
  futureField: { retained: true },
})

const session = sessionSchema.parse({
  user: { id: 'user-1', email: 'owner@example.test', name: 'Owner' },
  workspace: { id: 'workspace-1', slug: 'studio', name: 'Studio' },
  workspaces: [
    { id: 'workspace-1', slug: 'studio', name: 'Studio', role: 'OWNER' },
    { id: 'workspace-2', slug: 'client', name: 'Client', role: 'MEMBER' },
  ],
  members: [{ id: 'user-1', email: 'owner@example.test', name: 'Owner', role: 'OWNER' }],
  authMode: 'nextauth',
})

const note = backendNoteSchema.parse({
  id: 'note-1',
  workspaceId: 'workspace-1',
  projectId: 'project-1',
  title: 'Release notes',
  body: 'Verified backend note',
  visibility: 'WORKSPACE',
  pinned: false,
  tags: [],
  createdById: 'user-1',
  updatedById: 'user-1',
  createdAt: '2026-07-10T10:00:00.000Z',
  updatedAt: '2026-07-11T10:00:00.000Z',
})

const relation = backendWorkItemRelationSchema.parse({
  id: 'relation-1',
  workspaceId: 'workspace-1',
  sourceId: 'task-1',
  targetId: 'task-2',
  relationType: 'BLOCKS',
  createdAt: '2026-07-11T10:00:00.000Z',
  source: { id: 'task-1', title: 'Blocker', projectId: 'project-1' },
  target: { id: 'task-2', title: 'Blocked', projectId: 'project-1' },
})

afterEach(() => vi.unstubAllGlobals())

describe('API client', () => {
  it('requests an explicitly selected workspace session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(session))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getSession('workspace 2')).resolves.toEqual(session)
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/session?workspaceId=workspace%202', expect.objectContaining({
      method: 'GET',
      credentials: 'include',
    }))
  })

  it('loads and persists the current user planning preferences', async () => {
    const response = {
      settings: { theme: 'dark', priorityDisplay: 'text', weekStartsOn: 0, hideHomeCompleted: true },
      workspace: { taskPriorityDisplayStyle: 'badge' },
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(response)).mockResolvedValueOnce(Response.json(response))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getUserSettings('workspace 1', 'user 1')).resolves.toEqual(response)
    await expect(updateUserSettings('workspace 1', 'user 1', { weekStartsOn: 0 })).resolves.toEqual(response)
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/settings?workspaceId=workspace%201&userId=user%201',
      '/api/settings',
    ])
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual({ workspaceId: 'workspace 1', userId: 'user 1', weekStartsOn: 0 })
  })

  it('previews an import before posting the confirmed append', async () => {
    const snapshot = parseWorkspaceImport({
      version: 2,
      manifest: { format: 'planglade-workspace', version: 2, createdAt: '2026-07-21T12:00:00.000Z', appVersion: '0.2.0', capabilities: [] },
      data: { projects: [{ id: 'p1' }], workItems: [], notes: [], projectDocs: [], savedViews: [] },
    })
    const preview = {
      workspaceId: 'workspace-1',
      counts: { projects: 1, tasks: 0, notes: 0, projectDocs: 0, savedViews: 0, settings: 0, archivedProjectDocs: 0 },
      contract: { operation: 'append-import', supportedVersions: [1, 2], canExecute: true, idempotent: false, collisionStrategy: 'skip duplicates', discardedFields: [], expectedAttachmentBytes: 0, sourceChecksum: `sha256:${'a'.repeat(64)}` },
      warnings: [],
      writes: false,
    }
    const result = {
      workspaceId: 'workspace-1', mode: 'append',
      imported: { projects: 1, workItems: 0, notes: 0, projectDocs: 0, savedViews: 0 },
      skipped: { workItems: 0, notes: 0, projectDocs: 0, savedViews: 0 },
    }
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json(preview)).mockResolvedValueOnce(Response.json(result, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(previewWorkspaceImport('workspace-1', snapshot)).resolves.toEqual(preview)
    await expect(importWorkspace('workspace-1', snapshot, preview.contract.sourceChecksum)).resolves.toEqual(result)
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/workspace/import-preview?workspaceId=workspace-1',
      '/api/workspace/import-local',
    ])
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toMatchObject({
      workspaceId: 'workspace-1',
      mode: 'append',
      expectedSourceChecksum: preview.contract.sourceChecksum,
      snapshot,
    })
  })

  it('loads task history from the scoped work-item endpoint', async () => {
    const event = { id: 'event-1', summary: 'Changed priority', actor: null, createdAt: '2026-08-08T10:00:00.000Z' }
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ events: [event] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getTaskHistory('workspace 1', 'task 1')).resolves.toEqual([event])
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/work-items/task%201/history?workspaceId=workspace%201')
  })

  it('creates and renames workspaces through same-origin API calls', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ workspace: { id: 'workspace-3', slug: 'client', name: 'Client', role: 'OWNER' } }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ workspace: { id: 'workspace-3', slug: 'client', name: 'Client renamed' } }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createWorkspace('Client')).resolves.toMatchObject({ id: 'workspace-3', role: 'OWNER' })
    await expect(updateWorkspace('workspace 3', { name: 'Client renamed' })).resolves.toMatchObject({ name: 'Client renamed' })

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/workspaces',
      '/api/workspaces/workspace%203',
    ])
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({ name: 'Client' })
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual({ name: 'Client renamed' })
    expect(fetchMock.mock.calls.every((call) => call[1].credentials === 'include')).toBe(true)
  })

  it('uses a same-origin GET with cookies and parses the response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ projects: [project] }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await getProjects('workspace 1')

    expect(result).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/projects?workspaceId=workspace%201', expect.objectContaining({
      method: 'GET',
      credentials: 'include',
    }))
    expect(fetchMock.mock.calls[0]?.[0]).not.toMatch(/^https?:/)
  })

  it('maps backend errors without exposing response internals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(
      { error: 'Failed to load projects', details: 'private stack and database path' },
      { status: 500 },
    )))

    await expect(getProjects('workspace-1')).rejects.toMatchObject({
      kind: 'temporary',
      message: 'PlanGlade is temporarily unavailable.',
    })
  })

  it('distinguishes deliberate backend states', () => {
    expect(apiErrorKind(401)).toBe('unauthenticated')
    expect(apiErrorKind(409, 'ONBOARDING_REQUIRED')).toBe('onboarding_required')
    expect(apiErrorKind(403)).toBe('forbidden')
    expect(apiErrorKind(404)).toBe('not_found')
    expect(apiErrorKind(410)).toBe('not_found')
    expect(apiErrorKind(409)).toBe('conflict')
    expect(apiErrorKind(422)).toBe('validation')
    expect(apiErrorKind(503)).toBe('temporary')
  })

  it('creates a task with verified workspace scope and backend enum values', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ workItem: task }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    const created = await createTask({
      workspaceId: 'workspace-1',
      title: 'Create from API',
      projectId: 'project-1',
      status: 'planned',
      priority: 'high',
      dueDate: '2026-07-20',
    })

    expect(created).toEqual(task)
    expect(fetchMock).toHaveBeenCalledWith('/api/work-items', expect.objectContaining({
      method: 'POST', credentials: 'include',
    }))
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual(expect.objectContaining({
      workspaceId: 'workspace-1', title: 'Create from API', status: 'TODO', priority: 'HIGH', dueDate: '2026-07-20T00:00:00.000Z',
    }))
  })

  it('loads Inbox through the BACKLOG status contract', async () => {
    const inboxTask = { ...task, status: 'BACKLOG' as const, isInbox: true }
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ workItems: [inboxTask] }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(getInboxItems('workspace-1')).resolves.toEqual([inboxTask])
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/work-items?workspaceId=workspace-1&isInbox=true')
  })

  it('marks Quick Capture work items as pending Inbox entries', async () => {
    const inboxTask = { ...task, status: 'BACKLOG' as const, isInbox: true }
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ workItem: inboxTask }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await createTask({ workspaceId: 'workspace-1', title: 'Capture this', status: 'backlog', isInbox: true })

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toMatchObject({ status: 'BACKLOG', isInbox: true })
  })

  it('sends a parent id when creating a subtask', async () => {
    const childTask = { ...task, id: 'task-child', parentId: 'task-parent' }
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ workItem: childTask }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await createTask({ workspaceId: 'workspace-1', title: 'Draft the checklist', parentId: 'task-parent', status: 'planned' })

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toMatchObject({
      workspaceId: 'workspace-1',
      title: 'Draft the checklist',
      parentId: 'task-parent',
      status: 'TODO',
    })
  })

  it('keeps BACKLOG work items in the Tasks collection used by the Board', async () => {
    const backlog = { ...task, status: 'BACKLOG' as const }
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ workItems: [backlog] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getTasks('workspace-1')).resolves.toEqual([backlog])
  })

  it('loads guarded notes and relations through the same-origin client', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ notes: [note] }))
      .mockResolvedValueOnce(Response.json({ relations: [relation] }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getNotes('workspace 1')).resolves.toEqual([note])
    await expect(getWorkItemRelations('workspace 1')).resolves.toEqual([relation])

    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/notes?workspaceId=workspace%201')
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/work-item-relations?workspaceId=workspace%201')
    expect(fetchMock.mock.calls.every((call) => call[1].credentials === 'include')).toBe(true)
  })

  it('creates and deletes blocked-by relations through guarded endpoints', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ relation }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ deleted: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createBlockedByRelation('workspace 1', 'blocked/task', 'blocker/task')).resolves.toEqual(relation)
    await expect(deleteWorkItemRelation('workspace 1', 'relation/1')).resolves.toEqual({ deleted: true })

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/work-item-relations',
      '/api/work-item-relations/relation%2F1?workspaceId=workspace%201',
    ])
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['POST', 'DELETE'])
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({
      workspaceId: 'workspace 1',
      sourceId: 'blocked/task',
      targetId: 'blocker/task',
      relationType: 'BLOCKED_BY',
    })
    expect(fetchMock.mock.calls[1]?.[1]).not.toHaveProperty('body')
  })

  it('creates, updates, and deletes notes through relative credentialed endpoints', async () => {
    const updated = { ...note, title: 'Saved note', body: 'Saved body' }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ note }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ note: updated }))
      .mockResolvedValueOnce(Response.json({ deleted: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createNote({ workspaceId: 'workspace 1', title: 'Release notes', body: 'Verified backend note', projectId: 'project-1' })).resolves.toEqual(note)
    await expect(updateNote('workspace 1', 'note/1', { title: 'Saved note', body: 'Saved body' })).resolves.toEqual(updated)
    await expect(deleteNote('workspace 1', 'note/1')).resolves.toEqual({ deleted: true })

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      '/api/notes',
      '/api/notes/note%2F1?workspaceId=workspace%201',
      '/api/notes/note%2F1?workspaceId=workspace%201',
    ])
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(['POST', 'PATCH', 'DELETE'])
    expect(fetchMock.mock.calls.every((call) => call[1].credentials === 'include')).toBe(true)
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({
      workspaceId: 'workspace 1', title: 'Release notes', body: 'Verified backend note', projectId: 'project-1',
    })
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual({ title: 'Saved note', body: 'Saved body' })
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).not.toHaveProperty('workspaceId')
    expect(fetchMock.mock.calls[2]?.[1]).not.toHaveProperty('body')
  })

  it('downloads the guarded backend workspace export through the same-origin client', async () => {
    const exported = {
      version: 2,
      exportedAt: '2026-07-21T12:00:00.000Z',
      generatedAt: '2026-07-21T12:00:00.000Z',
      manifest: { format: 'planglade-workspace', version: 2, createdAt: '2026-07-21T12:00:00.000Z', appVersion: '0.2.0', capabilities: [] },
      workspace: { id: 'workspace-1', slug: 'studio', name: 'Studio', taskPriorityDisplayStyle: 'FLAGS' },
      projects: [], tasks: [], inboxItems: [], notes: [], labels: [], taskLabels: [], legacyDocs: [], savedViews: [],
      data: {},
      counts: { projects: 0, tasks: 0, inboxItems: 0, workItems: 0, notes: 0, labels: 0, taskLabels: 0, legacyDocs: 0, projectDocs: 0, savedViews: 0 },
    }
    const fetchMock = vi.fn().mockResolvedValue(Response.json(exported))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getWorkspaceExport('workspace 1')).resolves.toEqual(exported)
    expect(fetchMock).toHaveBeenCalledWith('/api/workspace/export?workspaceId=workspace%201', expect.objectContaining({
      method: 'GET', credentials: 'include', cache: 'no-store',
    }))
  })

  it('keeps a failed Notes or relation request distinct from an empty successful response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(getNotes('workspace-1')).rejects.toMatchObject({ kind: 'temporary' })
    await expect(getWorkItemRelations('workspace-1')).rejects.toMatchObject({ kind: 'temporary' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ notes: [] })))
    await expect(getNotes('workspace-1')).resolves.toEqual([])
  })

  it('creates a project with its schedule and appearance', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ project }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(createProject({ workspaceId: 'workspace-1', name: 'Launch', slug: 'launch', description: 'Ship the product', status: 'in_review', color: '#334455', startDate: '2026-07-01', targetDate: '2026-07-31' })).resolves.toEqual(project)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/projects')
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({ workspaceId: 'workspace-1', name: 'Launch', slug: 'launch', description: 'Ship the product', status: 'IN_REVIEW', color: '#334455', startDate: '2026-07-01T00:00:00.000Z', dueDate: '2026-07-31T00:00:00.000Z' })
  })

  it('updates supported project fields and allows schedule dates to be cleared', async () => {
    const updated = { ...project, name: 'Launch renamed', status: 'ON_HOLD' as const }
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ project: updated }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(updateProject('workspace-1', project, { name: 'Launch renamed', slug: 'launch-renamed', status: 'on_hold', color: '#112233', startDate: null, targetDate: null })).resolves.toEqual(updated)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/projects/project-1?workspaceId=workspace-1')
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({ name: 'Launch renamed', slug: 'launch-renamed', status: 'ON_HOLD', color: '#112233', startDate: null, dueDate: null })
  })

  it('deletes a project through the credentialed workspace endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ deleted: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteProject('workspace 1', 'project/1')).resolves.toEqual({ deleted: true })

    expect(fetchMock).toHaveBeenCalledWith('/api/projects/project%2F1?workspaceId=workspace%201', expect.objectContaining({ method: 'DELETE', credentials: 'include' }))
  })

  it('replaces one authoritative project cache record without changing task associations', () => {
    const updated = { ...project, name: 'Launch renamed' }
    expect(replaceProjectInList([project], updated)).toEqual([updated])
    expect(task.projectId).toBe(project.id)
  })

  it('omits nullable create metadata that the backend create contract does not accept', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ workItem: task }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await createTask({
      workspaceId: 'workspace-1',
      title: 'Create without metadata',
      projectId: null,
      dueDate: null,
      parentId: null,
    })

    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({
      workspaceId: 'workspace-1',
      title: 'Create without metadata',
    })
  })

  it('updates only supported task fields and keeps the server response authoritative', async () => {
    const updated = { ...task, title: 'Saved title', status: 'DONE', completedAt: '2026-07-20T12:00:00.000Z' }
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ workItem: updated }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateTask('workspace-1', task, { title: 'Saved title', status: 'done', dueDate: null })

    expect(result).toEqual(updated)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/work-items/task-1?workspaceId=workspace-1')
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual(expect.objectContaining({
      title: 'Saved title', status: 'DONE', dueDate: null,
    }))
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).not.toHaveProperty('workspaceId')
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body).completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('deletes a task through the relative credentialed endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ deleted: true }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteTask('workspace 1', 'task/1')).resolves.toEqual({ deleted: true })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/work-items/task%2F1?workspaceId=workspace%201', expect.objectContaining({
      method: 'DELETE',
      credentials: 'include',
    }))
    expect(fetchMock.mock.calls[0]?.[0]).not.toMatch(/^https?:/)
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('body')
  })

  it('does not retry a failed task deletion', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(deleteTask('workspace-1', 'task-1')).rejects.toMatchObject({
      kind: 'temporary',
      message: 'PlanGlade is temporarily unavailable.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('removes a confirmed task from task and Inbox projections', () => {
    const backlog = { ...task, status: 'BACKLOG' as const }
    const childTask = { ...task, id: 'task-2', parentId: task.id }
    expect(removeTaskFromList([task, childTask], task.id)).toEqual([{ ...childTask, parentId: null }])
    expect(removeInboxFromList([backlog], backlog.id)).toEqual([])
  })

  it('completes and reopens a task through the backend status contract', async () => {
    const completed = { ...task, status: 'DONE', completedAt: '2026-07-21T12:00:00.000Z' }
    const reopened = { ...task, status: 'TODO', completedAt: null }
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ workItem: completed }))
      .mockResolvedValueOnce(Response.json({ workItem: reopened }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(updateTask('workspace-1', task, { status: 'done' })).resolves.toEqual(completed)
    await expect(updateTask('workspace-1', task, { status: 'planned' })).resolves.toEqual(reopened)

    const completeBody = JSON.parse(fetchMock.mock.calls[0]?.[1].body)
    expect(completeBody.status).toBe('DONE')
    expect(completeBody.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(JSON.parse(fetchMock.mock.calls[1]?.[1].body)).toEqual({ expectedUpdatedAt: task.updatedAt, status: 'TODO', completedAt: null })
  })

  it('sends IN_REVIEW without converting it to In Progress', async () => {
    const reviewed = { ...task, status: 'IN_REVIEW', completedAt: null }
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ workItem: reviewed }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(updateTask('workspace-1', task, { status: 'in_review' })).resolves.toEqual(reviewed)
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1].body)).toEqual({ expectedUpdatedAt: task.updatedAt, status: 'IN_REVIEW', completedAt: null })
  })

  it('preserves confirmed state when a status mutation fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(updateTask('workspace-1', task, { status: 'done' })).rejects.toMatchObject({
      kind: 'temporary', message: 'PlanGlade is temporarily unavailable.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('replaces the authoritative task record shared by all cached views', () => {
    const other = { ...task, id: 'task-2', title: 'Other task' }
    const updated = { ...task, status: 'DONE' as const, completedAt: '2026-07-21T12:00:00.000Z' }

    expect(replaceTaskInList([task, other], updated)).toEqual([updated, other])
  })

  it('removes converted Inbox items while preserving their authoritative task record', () => {
    const backlog = { ...task, status: 'BACKLOG' as const, isInbox: false }
    const inboxCapture = { ...backlog, isInbox: true }
    const converted = { ...backlog, status: 'TODO' as const }
    expect(replaceTaskInList([converted], inboxCapture)).toEqual([])
    expect(replaceInboxInList([backlog], converted)).toEqual([])
    expect(replaceTaskInList([], converted)).toEqual([converted])
    expect(replaceTaskInList([converted], backlog)).toEqual([backlog])
    expect(adaptInboxItem(backlog)).toMatchObject({ id: backlog.id, text: backlog.title })
  })

  it('does not retry a failed update request', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(updateTask('workspace-1', task, { title: 'Keep draft' })).rejects.toMatchObject({
      kind: 'temporary', message: 'PlanGlade is temporarily unavailable.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry failed mutation requests', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createTask({ workspaceId: 'workspace-1', title: 'Keep draft' })).rejects.toMatchObject({
      kind: 'temporary', message: 'PlanGlade is temporarily unavailable.',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('lossless adapters', () => {
  it('maps project and task concepts while retaining complete source records', () => {
    const mappedProject = adaptProject(project)
    const mappedTask = adaptTask(task)

    expect(mappedProject).toMatchObject({ status: 'in_review', targetDate: '2026-07-31', source: project })
    expect(mappedTask).toMatchObject({ status: 'in_review', priority: 'high', labelIds: ['label-1'], source: task })
    expect(mappedProject.source?.futureField).toBe('retained')
    expect(mappedTask.source?.futureField).toEqual({ retained: true })
  })

  it('maps verified session scope without fixture fallback', () => {
    const state = buildApiWorkspaceState(session, [project], [task], [], [note], [], {
      theme: 'system',
      priorityDisplay: 'icon',
      weekStartsOn: 1,
      hideHomeCompleted: false,
    })

    expect(state.workspaceName).toBe('Studio')
    expect(state.userName).toBe('Owner')
    expect(state.projects).toHaveLength(1)
    expect(state.tasks).toHaveLength(1)
    expect(state.notes).toMatchObject([{ id: 'note-1', content: 'Verified backend note' }])
    expect(state.tasks[0]?.noteIds).toEqual(['note-1'])
    expect(state.inbox).toEqual([])
  })

  it('keeps board Backlog tasks out of Inbox', () => {
    const backlog = backendWorkItemSchema.parse({ ...task, status: 'BACKLOG', isInbox: false })
    const state = buildApiWorkspaceState(session, [project], [backlog], [], [note], [], {
      theme: 'system', priorityDisplay: 'icon', weekStartsOn: 1, hideHomeCompleted: false,
    })

    expect(state.tasks).toMatchObject([{ id: backlog.id, status: 'backlog' }])
    expect(state.inbox).toEqual([])
  })

  it('keeps pending captures in Inbox and out of Board tasks', () => {
    const capture = backendWorkItemSchema.parse({ ...task, status: 'BACKLOG', isInbox: true })
    const state = buildApiWorkspaceState(session, [project], [], [capture], [note], [], {
      theme: 'system', priorityDisplay: 'icon', weekStartsOn: 1, hideHomeCompleted: false,
    })

    expect(state.tasks).toEqual([])
    expect(state.inbox).toMatchObject([{ id: capture.id, text: capture.title }])
  })

  it('normalizes blocker direction, de-duplicates reverse related rows, and never creates a note from an inaccessible id', () => {
    const task2 = backendWorkItemSchema.parse({ ...task, id: 'task-2', title: 'Blocked', noteIds: ['not-returned'] })
    const task3 = backendWorkItemSchema.parse({ ...task, id: 'task-3', title: 'Blocked', noteIds: [] })
    const blockedBy = backendWorkItemRelationSchema.parse({
      ...relation,
      id: 'relation-2',
      sourceId: 'task-3',
      targetId: 'task-1',
      relationType: 'BLOCKED_BY',
    })
    const related = backendWorkItemRelationSchema.parse({
      ...relation,
      id: 'relation-3',
      sourceId: 'task-1',
      targetId: 'task-2',
      relationType: 'RELATES_TO',
    })
    const reverseRelated = backendWorkItemRelationSchema.parse({
      ...related,
      id: 'relation-4',
      sourceId: 'task-2',
      targetId: 'task-1',
    })

    const normalized = applyWorkItemRelations([adaptTask(task), adaptTask(task2), adaptTask(task3)], [relation, blockedBy, related, reverseRelated])

    expect(normalized.find((item) => item.id === 'task-2')?.dependsOn).toEqual(['task-1'])
    expect(normalized.find((item) => item.id === 'task-3')?.dependsOn).toEqual(['task-1'])
    expect(normalized.find((item) => item.id === 'task-1')?.related).toEqual(['task-2'])
    expect(normalized.find((item) => item.id === 'task-2')?.related).toEqual(['task-1'])
    const state = buildApiWorkspaceState(session, [project], [task2], [], [note], [], {
      theme: 'system', priorityDisplay: 'icon', weekStartsOn: 1, hideHomeCompleted: false,
    })
    expect(state.notes.map((item) => item.id)).not.toContain('not-returned')
  })
})

describe('data mode', () => {
  it('enables fixtures only for the explicit reference mode', () => {
    expect(resolveDataMode('reference')).toBe('reference')
    expect(resolveDataMode('api')).toBe('api')
    expect(resolveDataMode('production')).toBe('api')
    expect(resolveDataMode('Reference')).toBe('api')
  })

  it('blocks API task mutations for a server-marked demo session', () => {
    expect(canMutateTasksForAuthMode('demo')).toBe(false)
    expect(canMutateTasksForAuthMode('nextauth')).toBe(true)
  })
})
