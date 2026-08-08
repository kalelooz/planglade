import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

function required(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required for the integration harness`)
  return value
}

type Runtime = {
  runId: string
  workspaceName: string
  projectName: string
  secondaryProjectId: string
  secondaryProjectName: string
  taskTitle: string
  reviewTaskTitle: string
}

export default async function setupIntegration() {
  const baseURL = 'http://127.0.0.1:5173'
  const setupToken = required('PLANGLADE_E2E_SETUP_TOKEN')
  const email = required('PLANGLADE_E2E_EMAIL')
  const password = required('PLANGLADE_E2E_PASSWORD')
  const storageState = required('PLANGLADE_E2E_STORAGE_STATE')
  const runtimeFile = required('PLANGLADE_E2E_RUNTIME_FILE')
  const runId = required('PLANGLADE_E2E_RUN_ID')
  const workspaceName = `Integration ${runId}`
  const projectName = `Integration ${runId} Alpha`
  const secondaryProjectName = `Integration ${runId} Beta`
  const taskTitle = `Seed task ${runId}`
  const reviewTaskTitle = `Review task ${runId}`

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' })
    const seeded = await page.evaluate(async ({ email, password, projectName, reviewTaskTitle, runId, secondaryProjectName, setupToken, taskTitle, workspaceName }) => {
      const request = async (path: string, init?: RequestInit) => {
        const response = await fetch(path, {
          ...init,
          headers: { 'content-type': 'application/json', ...init?.headers },
        })
        if (!response.ok) throw new Error(`${path} returned ${response.status}`)
        return response.json() as Promise<Record<string, unknown>>
      }
      const csrfCookie = () => (globalThis as unknown as { document: { cookie: string } }).document.cookie
        .split('; ')
        .find((cookie) => cookie.startsWith('planglade-setup-csrf='))
        ?.split('=')
        .slice(1)
        .join('=')
      const discovery = await request('/api/auth/setup')
      if (discovery.status !== 'available') throw new Error('Local setup is unavailable')
      const claimCsrf = csrfCookie()
      if (!claimCsrf) throw new Error('Setup claim CSRF cookie was not issued')
      await request('/api/auth/setup/claim', {
        method: 'POST',
        headers: { 'x-planglade-csrf': claimCsrf },
        body: JSON.stringify({ setupToken }),
      })
      const completionCsrf = csrfCookie()
      if (!completionCsrf) throw new Error('Setup completion CSRF cookie was not issued')
      await request('/api/auth/setup/complete', {
        method: 'POST',
        headers: { 'x-planglade-csrf': completionCsrf },
        body: JSON.stringify({ email, name: `Integration ${runId}`, password, workspaceName }),
      })
      const csrf = await request('/api/auth/csrf') as { csrfToken: string }
      const login = await fetch('/api/auth/callback/credentials', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ callbackUrl: '/', csrfToken: csrf.csrfToken, email, json: 'true', password }),
      })
      if (!login.ok) throw new Error(`Credentials login returned ${login.status}`)
      const session = await request('/api/auth/session') as { workspace: { id: string } }
      const workspaceId = session.workspace.id
      const project = await request('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ workspaceId, name: projectName, slug: `integration-${runId}-alpha` }),
      }) as { project: { id: string } }
      const secondaryProject = await request('/api/projects', {
        method: 'POST',
        body: JSON.stringify({ workspaceId, name: secondaryProjectName, slug: `integration-${runId}-beta` }),
      }) as { project: { id: string } }
      for (const [title, status] of [[taskTitle, 'TODO'], [`Seed follow-up ${runId}`, 'IN_PROGRESS'], [`Seed inbox ${runId}`, 'BACKLOG']] as const) {
        await request('/api/work-items', {
          method: 'POST',
          body: JSON.stringify({ workspaceId, projectId: project.project.id, title, status, priority: 'MEDIUM', ...(title === taskTitle ? { dueDate: '2026-07-20T00:00:00.000Z' } : {}) }),
        })
      }
      await request('/api/work-items', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId,
          projectId: project.project.id,
          title: reviewTaskTitle,
          description: 'Review notes',
          status: 'IN_REVIEW',
          priority: 'URGENT',
          dueDate: '2026-07-20T00:00:00.000Z',
        }),
      })
      return { secondaryProjectId: secondaryProject.project.id, workspaceId }
    }, { email, password, projectName, reviewTaskTitle, runId, secondaryProjectName, setupToken, taskTitle, workspaceName })

    const state = await context.storageState({ path: storageState })
    if (JSON.stringify(state).includes(password) || JSON.stringify(state).includes(setupToken)) {
      throw new Error('Integration auth state must not contain generated credentials')
    }
    const runtime: Runtime = { runId, workspaceName, projectName, secondaryProjectId: seeded.secondaryProjectId, secondaryProjectName, taskTitle, reviewTaskTitle }
    await writeFile(runtimeFile, JSON.stringify({ ...runtime, workspaceId: seeded.workspaceId }), 'utf8')
  } finally {
    await context.close()
    await browser.close()
  }
}
