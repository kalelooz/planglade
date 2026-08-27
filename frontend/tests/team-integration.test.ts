import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

describe('team integration', () => {
  it('allows assignee changes through the server workspace adapter', () => {
    const workspaceSource = readFileSync(fileURLToPath(new URL('../src/store/workspace.tsx', import.meta.url)), 'utf8')
    expect(workspaceSource).toMatch(/supported = \[[^\]]*'assigneeId'/)
  })
})
