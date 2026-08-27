import { expect, test } from '@playwright/test'

type Project = { id: string; name: string; status: string }

test('creates, persists, edits, and exposes a project through shared selectors', async ({ page }) => {
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<{ workspace: { id: string } }>)
  const runId = `Project browser ${Date.now()}`
  const slug = `project-browser-${Date.now()}`
  let created: Project | undefined
  try {
    await page.goto('/app/projects')
    await page.getByRole('button', { name: /new project/i }).click()
    await page.getByLabel('Name').fill(runId)
    await page.getByLabel('Project URL slug').fill(slug)
    const create = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/projects')
    await page.getByRole('button', { name: 'Create project' }).click()
    const createdResponse = await create
    expect(createdResponse.status()).toBe(201)
    created = (await createdResponse.json() as { project: Project }).project
    await expect(page.getByRole('heading', { name: runId })).toBeVisible()

    await page.goto('/app/tasks')
    await page.getByRole('button', { name: 'New task' }).click()
    await page.getByRole('combobox', { name: 'Project' }).click()
    await expect(page.getByRole('option', { name: runId, exact: true })).toBeVisible()

    await page.goto(`/app/projects/${created.id}`)
    await page.getByRole('button', { name: 'Edit project' }).click()
    await page.getByLabel('Name').fill(`${runId} renamed`)
    await page.getByLabel('Project status').click()
    await page.getByRole('option', { name: 'On hold', exact: true }).click()
    const update = page.waitForResponse((response) => response.request().method() === 'PATCH' && new URL(response.url()).pathname.endsWith(`/${created!.id}`))
    await page.getByRole('button', { name: 'Save changes' }).click()
    expect((await update).status()).toBe(200)
    await expect(page.getByRole('heading', { name: `${runId} renamed` })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: `${runId} renamed` })).toBeVisible()
    await page.goto('/app/projects')
    await expect(page.getByText(`${runId} renamed`, { exact: true })).toBeVisible()
  } finally {
    if (created) {
      const response = await page.request.delete(`/api/projects/${encodeURIComponent(created.id)}?workspaceId=${encodeURIComponent(session.workspace.id)}`)
      expect(response.ok()).toBeTruthy()
    }
  }
})
