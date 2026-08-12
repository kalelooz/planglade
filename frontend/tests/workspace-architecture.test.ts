import { readFileSync, readdirSync } from 'node:fs'
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

    expect(productionSource).not.toMatch(/planglade:/)
    expect(productionSource).not.toMatch(/\breadOnly\s*:/)
    expect(productionSource).not.toMatch(/\.readOnly\b/)
    expect(workspaceProvider).toContain('useApiWorkspaceQueries')
    expect(workspaceProvider).toContain('useApiWorkspaceMutations')
    expect(workspaceProvider).toContain('createReferenceWorkspaceAdapter')
  })
})
