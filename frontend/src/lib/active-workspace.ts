export const ACTIVE_WORKSPACE_KEY = 'planglade-active-workspace-v1'

export function rememberActiveWorkspace(storage: Pick<Storage, 'setItem'>, workspaceId: string) {
  storage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId)
}
