import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

describe('solo first-run flow', () => {
  it('preserves the requested workspace destination through sign-in and onboarding', async () => {
    const [entry, store] = await Promise.all([
      readFile(path.join(root, 'src/pages/WorkspaceEntry.tsx'), 'utf8'),
      readFile(path.join(root, 'src/store/workspace.tsx'), 'utf8'),
    ])

    expect(entry).toContain('normalizeWorkspaceDestination')
    expect(entry).toContain('authLoginHref(destination)')
    expect(entry).toContain("navigate(destination, { replace: true })")
    expect(store).toContain('authLoginHref(currentWorkspaceDestination())')
    expect(entry).not.toContain('/auth/login?next=/login')
  })

  it('keeps every user-facing entry route in Vite and proxies only the API', async () => {
    const [viteConfig, nginxConfig, devLauncher, app] = await Promise.all([
      readFile(path.join(root, 'vite.config.ts'), 'utf8'),
      readFile(path.join(root, 'deploy/default.conf.template'), 'utf8'),
      readFile(path.join(root, 'scripts/dev-local.mjs'), 'utf8'),
      readFile(path.join(root, 'src/App.tsx'), 'utf8'),
    ])

    expect(viteConfig).toContain("'/api':")
    expect(viteConfig).not.toContain("'/auth/login':")
    expect(viteConfig).not.toContain("'/setup':")
    expect(nginxConfig).not.toMatch(/location .*\/(?:auth|login|setup|_next)/)
    expect(app).toContain('<Route path="/auth/login" element={<DeferredRoute><AuthLogin /></DeferredRoute>} />')
    expect(app).toContain('<Route path="/setup" element={<DeferredRoute><Setup /></DeferredRoute>} />')
    expect(devLauncher).toContain("NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? 'http://127.0.0.1:5173'")
    expect(devLauncher).toContain("'db', 'push', '--skip-generate'")
  })

  it('derives the first-run checklist from real workspace records', async () => {
    const home = await readFile(path.join(root, 'src/pages/Home.tsx'), 'utf8')

    expect(home).toContain('ws.tasks.length + ws.inbox.length > 0')
    expect(home).toContain('ws.projects.length > 0')
    expect(home).toContain('ws.notes.length > 0')
    expect(home).toContain('No sample records are added.')
    expect(home).not.toContain('seedWorkspace')
  })
})
