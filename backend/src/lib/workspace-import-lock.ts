// The public SQLite release intentionally supports one backend process. This
// lock prevents overlapping imports in that supported topology; see the
// single-backend limitation in backend/docs/SELF_HOSTING.md before scaling.
const activeWorkspaceImports = new Set<string>()

export function tryAcquireWorkspaceImport(workspaceId: string) {
  if (activeWorkspaceImports.has(workspaceId)) return null
  activeWorkspaceImports.add(workspaceId)

  let released = false
  return () => {
    if (released) return
    released = true
    activeWorkspaceImports.delete(workspaceId)
  }
}
