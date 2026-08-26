import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url))

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.[jt]sx?$/.test(entry.name) ? [path] : []
  })
}

describe('workspace architecture', () => {
  it('keeps UI mode semantics explicit and cross-tree commands typed', () => {
    const productionSource = sourceFiles(sourceRoot)
      .filter((path) => !path.endsWith('.test.ts'))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
    const workspaceProvider = readFileSync(join(sourceRoot, 'store', 'workspace.tsx'), 'utf8')
    const serverSync = readFileSync(join(sourceRoot, 'store', 'server-workspace-sync.ts'), 'utf8')
    const board = readFileSync(join(sourceRoot, 'pages', 'Board.tsx'), 'utf8')
    const taskRow = readFileSync(join(sourceRoot, 'components', 'TaskRow.tsx'), 'utf8')

    expect(productionSource).not.toMatch(/planglade:/)
    expect(productionSource).not.toMatch(/\breadOnly\s*:/)
    expect(productionSource).not.toMatch(/\.readOnly\b/)
    expect(workspaceProvider).toContain('useServerWorkspaceSync')
    expect(workspaceProvider).toContain('createReferenceWorkspaceAdapter')
    expect(serverSync).toContain('useQuery')
    expect(serverSync).toContain('useMutation')
    expect(serverSync).toContain("cancelQueries({ queryKey: ['inbox', targetWorkspaceId] })")
    expect(workspaceProvider).toMatch(/finally \{\s+try \{\s+await invalidateRelations\(workspaceId\)/)
    expect(board).toContain('TASK_STATUS_ORDER')
    expect(taskRow).toContain('const hasMobileStatus = listMobileLayout && showStatus')
    expect(existsSync(join(sourceRoot, 'store', 'use-api-workspace-queries.ts'))).toBe(false)
    expect(existsSync(join(sourceRoot, 'store', 'use-api-workspace-mutations.ts'))).toBe(false)
  })
})
