import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const app = readFileSync(fileURLToPath(new URL('../src/App.tsx', import.meta.url)), 'utf8')
const workspaceRoutes = readFileSync(fileURLToPath(new URL('../src/WorkspaceRoutes.tsx', import.meta.url)), 'utf8')
const viteConfig = readFileSync(fileURLToPath(new URL('../vite.config.ts', import.meta.url)), 'utf8')

describe('route loading', () => {
  it('loads public and workspace pages through route-level dynamic imports', () => {
    for (const page of ['Landing', 'WorkspaceEntry', 'AuthLogin', 'InvitationReview', 'Setup', 'NotFound']) {
      expect(app).toContain(`lazy(() => import('@/pages/${page}'))`)
      expect(app).not.toMatch(new RegExp(`import ${page} from ['"]@/pages/${page}['"]`))
    }
    for (const page of ['Home', 'Inbox', 'Tasks', 'Projects', 'ProjectDetail', 'Notes', 'CalendarPage', 'Connections', 'Settings', 'NotFound']) {
      expect(workspaceRoutes).toContain(`lazy(() => import('@/pages/${page}'))`)
      expect(workspaceRoutes).not.toMatch(new RegExp(`import ${page} from ['"]@/pages/${page}['"]`))
    }
  })

  it('keeps workspace providers and shell out of the public entry chunk', () => {
    expect(app).toContain("lazy(() => import('@/WorkspaceRoutes'))")
    expect(app).not.toContain("from '@/store/workspace'")
    expect(app).not.toContain("from '@/components/AppShell'")
    expect(workspaceRoutes).toContain("from '@/store/workspace'")
    expect(workspaceRoutes).toContain("from '@/components/AppShell'")
  })

  it('keeps unknown workspace paths inside the workspace', () => {
    expect(workspaceRoutes).toContain('<NotFound homeHref={WORKSPACE_PATHS.home} />')
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
