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
