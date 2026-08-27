import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const app = readFileSync(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8')
const viteConfig = readFileSync(fileURLToPath(new URL('../vite.config.ts', import.meta.url)), 'utf8')

describe('route loading', () => {
  it('loads product pages through route-level dynamic imports', () => {
    for (const page of ['Home', 'Inbox', 'Tasks', 'Projects', 'ProjectDetail', 'Notes', 'CalendarPage', 'Connections', 'Settings', 'WorkspaceEntry', 'AuthLogin', 'InvitationReview', 'Setup', 'NotFound']) {
      expect(app).toContain(`lazy(() => import('@/pages/${page}'))`)
      expect(app).not.toMatch(new RegExp(`import ${page} from ['"]@/pages/${page}['"]`))
    }
  })

  it('keeps a named loading state at the route boundary', () => {
    expect(app).toContain('function DeferredRoute')
    expect(app).toContain('role="status"')
    expect(app).toContain('Loading page…')
  })

  it('separates shared UI, motion, and visualization dependencies from the entry chunk', () => {
    expect(viteConfig).toContain('manualChunks(id)')
    expect(viteConfig).toContain("return 'ui-vendor'")
    expect(viteConfig).toContain("return 'motion-vendor'")
    expect(viteConfig).toContain("return 'visualization-vendor'")
    expect(viteConfig).toContain("return 'react-vendor'")
  })
})
