import { sendJson } from '@/lib/api/client'
import { workspaceImportPreviewSchema, workspaceImportResultSchema, workspaceImportSnapshotSchema } from '@/lib/api/contracts'

export type WorkspaceImportSnapshot = ReturnType<typeof workspaceImportSnapshotSchema.parse>

export function parseWorkspaceImport(value: unknown) {
  return workspaceImportSnapshotSchema.parse(value)
}

export function previewWorkspaceImport(workspaceId: string, snapshot: WorkspaceImportSnapshot, signal?: AbortSignal) {
  return sendJson(`/api/workspace/import-preview?workspaceId=${encodeURIComponent(workspaceId)}`, 'POST', snapshot, workspaceImportPreviewSchema, signal)
}

export function importWorkspace(workspaceId: string, snapshot: WorkspaceImportSnapshot, signal?: AbortSignal) {
  return sendJson('/api/workspace/import-local', 'POST', {
    workspaceId,
    mode: 'append',
    projects: snapshot.data.projects,
    workItems: snapshot.data.workItems,
    notes: snapshot.data.notes,
    projectDocs: snapshot.data.projectDocs,
    savedViews: snapshot.data.savedViews,
  }, workspaceImportResultSchema, signal)
}
