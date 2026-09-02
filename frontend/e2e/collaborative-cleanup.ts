import type { APIRequestContext } from '@playwright/test'

type WorkItemStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE'
type LaneVersions = Record<WorkItemStatus, number>
type WorkItem = { id: string; updatedAt: string; status: WorkItemStatus; isInbox: boolean }
type VersionedEntity = { id: string; updatedAt: string }

async function requireOk(response: Awaited<ReturnType<APIRequestContext['get']>>, action: string) {
  if (!response.ok()) throw new Error(`${action} failed (${response.status()}): ${await response.text()}`)
}

export async function deleteCurrentWorkItem(request: APIRequestContext, workspaceId: string, workItemId: string) {
  const list = await request.get(`/api/work-items?workspaceId=${encodeURIComponent(workspaceId)}`)
  await requireOk(list, 'Load current work items')
  const snapshot = await list.json() as { workItems: WorkItem[]; laneVersions: LaneVersions }
  const current = snapshot.workItems.find(({ id }) => id === workItemId)
  if (!current) return
  const response = await request.delete(`/api/work-items/${encodeURIComponent(workItemId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
    data: {
      expectedUpdatedAt: current.updatedAt,
      ...(!current.isInbox ? { expectedLaneVersions: { [current.status]: snapshot.laneVersions[current.status] } } : {}),
    },
  })
  await requireOk(response, 'Delete work item')
}

export async function deleteCurrentProject(request: APIRequestContext, workspaceId: string, projectId: string) {
  const list = await request.get(`/api/projects?workspaceId=${encodeURIComponent(workspaceId)}`)
  await requireOk(list, 'Load current projects')
  const { projects } = await list.json() as { projects: VersionedEntity[] }
  const current = projects.find(({ id }) => id === projectId)
  if (!current) return
  const response = await request.delete(`/api/projects/${encodeURIComponent(projectId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
    data: { expectedUpdatedAt: current.updatedAt },
  })
  await requireOk(response, 'Delete project')
}

export async function deleteCurrentNote(request: APIRequestContext, workspaceId: string, noteId: string) {
  const list = await request.get(`/api/notes?workspaceId=${encodeURIComponent(workspaceId)}`)
  await requireOk(list, 'Load current notes')
  const { notes } = await list.json() as { notes: VersionedEntity[] }
  const current = notes.find(({ id }) => id === noteId)
  if (!current) return
  const response = await request.delete(`/api/notes/${encodeURIComponent(noteId)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
    data: { expectedUpdatedAt: current.updatedAt },
  })
  await requireOk(response, 'Delete note')
}
