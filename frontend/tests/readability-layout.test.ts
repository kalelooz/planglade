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

  it('gives data-heavy pages room while preserving reading-width pages', () => {
    const bits = readFileSync(join(sourceRoot, 'components', 'bits.tsx'), 'utf8')
    const home = readFileSync(join(sourceRoot, 'pages', 'Home.tsx'), 'utf8')
    const inbox = readFileSync(join(sourceRoot, 'pages', 'Inbox.tsx'), 'utf8')
    const tasks = readFileSync(join(sourceRoot, 'pages', 'Tasks.tsx'), 'utf8')

    expect(bits).toContain("wide: 'mx-auto max-w-[1600px]")
    expect(bits).toContain("reading: 'mx-auto max-w-[900px]")
    expect(home).toContain('<PageContainer width="wide"')
    expect(inbox).toContain('<PageContainer width="wide"')
    expect(tasks).toContain('<PageContainer width="wide" className="pb-10">')
    expect(tasks).toContain("['comfortable', 'compact'] as const")
  })
})
