import { expect, test, type Page } from '@playwright/test'

type Project = { id: string; name: string }
type Session = { workspace: { id: string } }
type WorkItem = { id: string; title: string; projectId: string | null; dueDate: string | null; status: string }

async function session(page: Page) {
  const response = await page.request.get('/api/auth/session')
  expect(response.ok()).toBeTruthy()
  return response.json() as Promise<Session>
}

async function projects(page: Page, workspaceId: string) {
  const response = await page.request.get(`/api/projects?workspaceId=${encodeURIComponent(workspaceId)}`)
  expect(response.ok()).toBeTruthy()
  const data = await response.json() as { projects: Project[] }
  return data.projects
}

async function task(page: Page, workspaceId: string, title: string) {
  const response = await page.request.get(`/api/work-items?workspaceId=${encodeURIComponent(workspaceId)}`)
  expect(response.ok()).toBeTruthy()
  const data = await response.json() as { workItems: WorkItem[] }
  return data.workItems.find((item) => item.title === title)
}

async function createTask(page: Page, workspaceId: string, projectId: string, title: string, dueDate: string) {
  const response = await page.request.post('/api/work-items', {
    data: { workspaceId, projectId, title, status: 'TODO', priority: 'MEDIUM', dueDate: `${dueDate}T00:00:00.000Z` },
  })
  expect(response.status()).toBe(201)
  const data = await response.json() as { workItem: WorkItem }
  return data.workItem
}

async function deleteTask(page: Page, workspaceId: string, id: string) {
  const response = await page.request.delete(`/api/work-items/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`)
  expect(response.ok()).toBeTruthy()
}

function patch(page: Page, fields: Record<string, unknown>) {
  return page.waitForResponse((response) => {
    if (response.request().method() !== 'PATCH' || !new URL(response.url()).pathname.startsWith('/api/work-items/')) return false
    const body = response.request().postDataJSON() as Record<string, unknown>
    return Object.entries(fields).every(([key, value]) => body[key] === value)
  })
}

test('task mutations stay synchronized across Tasks, Calendar, Home, and both Project views', async ({ page }) => {
  test.setTimeout(60_000)
  const current = await session(page)
  const availableProjects = await projects(page, current.workspace.id)
  if (availableProjects.length < 2) throw new Error('Cross-view test needs two existing projects')
  const [oldProject, newProject] = availableProjects
  const runId = `cross-view-${Date.now()}`
  const originalTitle = `Cross-view task ${runId}`
  const editedTitle = `${originalTitle} edited`
  const oldDate = '2026-07-24'
  const newDate = '2026-07-22'
  let created: WorkItem | undefined

  try {
    created = await createTask(page, current.workspace.id, oldProject.id, originalTitle, oldDate)
    await page.goto('/app/tasks')
    await expect(page.getByText(originalTitle, { exact: true })).toBeVisible()

    await page.getByRole('button', { name: `Task: ${originalTitle}` }).click()
    await expect(page.getByLabel('Task details')).toBeVisible()
    const titleSave = patch(page, { title: editedTitle })
    await page.getByLabel('Task title').fill(editedTitle)
    expect((await titleSave).status()).toBe(200)
    await page.goto('/app/projects')
    await page.getByText(oldProject.name, { exact: true }).click()
    await expect(page.getByRole('heading', { name: oldProject.name })).toBeVisible()
    await page.getByRole('tab', { name: /tasks/i }).click()
    await expect(page.getByText(editedTitle, { exact: true })).toBeVisible()

    await page.goto('/app/calendar')
    const oldDay = page.getByRole('button', { name: /Friday, July 24.*tasks/ })
    await expect(oldDay.getByText(editedTitle, { exact: true })).toBeVisible()

    await page.goto('/app/tasks')
    await page.getByRole('button', { name: `Task: ${editedTitle}` }).click()
    const dueDate = page.getByRole('button', { name: 'Due date', exact: true })
    await dueDate.click()
    const newDay = page.locator('[data-slot="calendar"] button[data-day]').filter({ hasText: /^22$/ }).first()
    await expect(newDay).toBeVisible()
    const duePatch = patch(page, { dueDate: `${newDate}T00:00:00.000Z` })
    await newDay.click()
    expect((await duePatch).status()).toBe(200)
    await page.goto('/app/calendar')
    await expect(page.getByRole('button', { name: /Friday, July 24.*tasks/ }).getByText(editedTitle, { exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Wednesday, July 22.*tasks/ }).getByText(editedTitle, { exact: true })).toBeVisible()

    await page.goto('/app/tasks')
    await page.getByRole('button', { name: `Task: ${editedTitle}` }).click()
    const projectPatch = patch(page, { projectId: newProject.id })
    await page.getByRole('combobox', { name: 'Project' }).click()
    await page.getByRole('option', { name: newProject.name, exact: true }).click()
    expect((await projectPatch).status()).toBe(200)
    await page.goto(`/app/projects/${oldProject.id}?tab=tasks`)
    await expect(page.getByText(editedTitle, { exact: true })).toHaveCount(0)
    await page.goto(`/app/projects/${newProject.id}?tab=tasks`)
    await expect(page.getByText(editedTitle, { exact: true })).toBeVisible()

    await page.goto('/app/tasks')
    const row = page.getByRole('button', { name: `Task: ${editedTitle}` })
    const complete = patch(page, { status: 'DONE' })
    await row.getByRole('checkbox', { name: 'Mark as done' }).click()
    expect((await complete).status()).toBe(200)
    await page.goto('/app')
    await expect(page.getByRole('region', { name: 'Coming up this week' }).getByText(editedTitle, { exact: true })).toHaveCount(0)

    await page.goto('/app/tasks')
    const doneRow = page.getByRole('button', { name: `Task: ${editedTitle} (done)` })
    const reopen = patch(page, { status: 'TODO' })
    await doneRow.getByRole('checkbox', { name: 'Mark as not done' }).click()
    expect((await reopen).status()).toBe(200)
    await expect(page.getByRole('button', { name: `Task: ${editedTitle}` })).toBeVisible()

    await page.goto('/app/calendar')
    await expect(page.getByRole('button', { name: /Wednesday, July 22.*tasks/ }).getByText(editedTitle, { exact: true })).toBeVisible()
    await page.goto('/app/tasks')
    await expect(page.getByText(editedTitle, { exact: true })).toBeVisible()
    const persisted = await task(page, current.workspace.id, editedTitle)
    expect(persisted).toMatchObject({ projectId: newProject.id, dueDate: `${newDate}T00:00:00.000Z`, status: 'TODO' })
  } finally {
    if (created) await deleteTask(page, current.workspace.id, created.id)
  }
})
