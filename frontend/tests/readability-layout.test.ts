import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const sourceRoot = fileURLToPath(new URL('../src', import.meta.url))

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : /\.(?:css|[jt]sx?)$/.test(entry.name) ? [path] : []
  })
}

describe('responsive readability', () => {
  it('keeps rendered interface labels above the legacy sub-12px scale', () => {
    const productionSource = sourceFiles(sourceRoot)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')

    expect(productionSource).not.toMatch(/text-\[(?:[89](?:\.\d+)?|1[01](?:\.\d+)?)px\]/)
  })

  it('gives data-heavy pages room while preserving focused work and reading widths', () => {
    const bits = readFileSync(join(sourceRoot, 'components', 'bits.tsx'), 'utf8')
    const home = readFileSync(join(sourceRoot, 'pages', 'Home.tsx'), 'utf8')
    const inbox = readFileSync(join(sourceRoot, 'pages', 'Inbox.tsx'), 'utf8')
    const tasks = readFileSync(join(sourceRoot, 'pages', 'Tasks.tsx'), 'utf8')
    const taskRow = readFileSync(join(sourceRoot, 'components', 'TaskRow.tsx'), 'utf8')

    expect(bits).toContain("wide: 'mx-auto max-w-[1600px]")
    expect(bits).toContain("reading: 'mx-auto max-w-[900px]")
    expect(home).toContain('<PageContainer width="wide"')
    expect(inbox).toContain('<PageContainer width="wide"')
    expect(tasks).toContain('<PageContainer width="standard" className="pb-10" data-task-list-region>')
    expect(tasks).toContain('className="mx-auto w-full max-w-[960px]" data-task-list-surface')
    expect(tasks).toContain('className="mb-5 overflow-hidden rounded-lg border border-border/70 bg-card shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]"')
    expect(taskRow).toContain("'pg-item-title min-w-0 flex-1 truncate !text-nowrap'")
    expect(taskRow).toContain("'minmax(320px, min(28rem, 52vw))'")
    expect(tasks).toContain("['comfortable', 'compact'] as const")
  })
})
