import { expect, test, type Page, type Route } from '@playwright/test'
import { readFile } from 'node:fs/promises'

type Runtime = {
  projectName: string
  secondaryProjectId: string
  secondaryProjectName: string
  runId: string
  taskTitle: string
  reviewTaskTitle: string
  workspaceId: string
  workspaceName: string
}

async function runtime(): Promise<Runtime> {
  const runtimeFile = process.env.PLANGLADE_E2E_RUNTIME_FILE
  if (!runtimeFile) throw new Error('PLANGLADE_E2E_RUNTIME_FILE is required')
  return JSON.parse(await readFile(runtimeFile, 'utf8')) as Runtime
}

function collectConsoleErrors(page: Page) {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

function taskPatch(page: Page, matches: Record<string, unknown>) {
  return page.waitForResponse((response) => {
    if (response.request().method() !== 'PATCH' || !new URL(response.url()).pathname.startsWith('/api/work-items/')) return false
    const body = response.request().postDataJSON() as Record<string, unknown>
    return Object.entries(matches).every(([key, value]) => body[key] === value)
  })
}

async function openTaskDrawer(page: Page, title: string) {
  await page.goto('/app/tasks')
  await page.getByRole('button', { name: `Task: ${title}` }).click()
  await expect(page.getByLabel('Task details')).toBeVisible()
}

async function rawTask(page: Page, workspaceId: string, title: string) {
  return page.evaluate(async ({ title, workspaceId }) => {
    const response = await fetch(`/api/work-items?workspaceId=${encodeURIComponent(workspaceId)}`)
    if (!response.ok) throw new Error(`Task read returned ${response.status}`)
    const data = await response.json() as { workItems: Array<{ title: string }> }
    return data.workItems.find((task) => task.title === title)
  }, { title, workspaceId })
}

test.describe.configure({ mode: 'serial' })

test('Inbox edits serialize against current records, including newly captured items', async ({ page }) => {
  const fixture = await runtime()
  const errors = collectConsoleErrors(page)
  const patchStatuses: number[] = []
  page.on('response', (response) => {
    if (response.request().method() === 'PATCH' && new URL(response.url()).pathname.startsWith('/api/work-items/')) patchStatuses.push(response.status())
  })
  await page.goto('/app/inbox')
  for (const suffix of ['first', 'after queue initialization']) {
    const title = `Serialized inbox ${suffix} ${fixture.runId}`
    await page.getByRole('textbox', { name: 'Capture to inbox' }).fill(title)
    const created = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/work-items')
    await page.getByRole('textbox', { name: 'Capture to inbox' }).press('Enter')
    expect((await created).status()).toBe(201)
    const row = page.getByText(title, { exact: true }).locator('xpath=../..')
    let releaseFirst!: () => void
    const gate = new Promise<void>((resolve) => { releaseFirst = resolve })
    let first = true
    await page.route('**/api/work-items/*', async (route) => {
      if (route.request().method() === 'PATCH' && first) {
        first = false
        await gate
      }
      await route.continue()
    })
    try {
      await row.getByRole('combobox', { name: 'Assign project' }).click()
      await page.getByRole('option', { name: fixture.secondaryProjectName, exact: true }).click()
      await row.getByRole('button', { name: 'Set due date' }).click()
      await page.locator('[role="gridcell"]:not([data-outside]) button[data-day]:not([disabled])').first().click()
      await row.getByRole('combobox', { name: 'Set priority' }).click()
      await page.getByRole('option', { name: 'High', exact: true }).click()
    } finally {
      releaseFirst()
    }
    await expect.poll(() => rawTask(page, fixture.workspaceId, title)).toMatchObject({ projectId: fixture.secondaryProjectId, priority: 'HIGH', dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) })
    await page.unroute('**/api/work-items/*')
  }
  await page.reload()
  for (const suffix of ['first', 'after queue initialization']) {
    const row = page.getByText(`Serialized inbox ${suffix} ${fixture.runId}`, { exact: true }).locator('xpath=../..')
    await expect(row.getByRole('combobox', { name: 'Assign project' })).toContainText(fixture.secondaryProjectName)
    await expect(row.getByRole('combobox', { name: 'Set priority' })).toContainText('High')
    await expect(row.getByRole('button', { name: 'Set due date' })).not.toContainText('No date')
  }
  await page.screenshot({ path: '../artifacts/verification/PG-REL-021/inbox-edits.png' })
  expect(patchStatuses).toEqual([200, 200, 200, 200, 200, 200])
  expect(errors).toEqual([])
})

test('workspace entry enables an authenticated member and preserves access after refresh', async ({ page }) => {
  const fixture = await runtime()
  const consoleErrors = collectConsoleErrors(page)

  for (const viewport of [{ width: 1280, height: 720 }, { width: 768, height: 844 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    await page.goto('/auth/login')
    const continueButton = page.getByRole('link', { name: 'Continue to workspace' })
    await expect(continueButton).toBeVisible()
    await expect(continueButton).toBeEnabled()
    expect(await page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')).toBe(true)
  }

  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/auth/login')
  await page.getByRole('link', { name: 'Continue to workspace' }).press('Enter')
  await expect(page).toHaveURL('/app')
  const workspaceSwitcher = page.getByRole('button', { name: `Switch workspace. Current workspace: ${fixture.workspaceName}` })
  await expect(workspaceSwitcher).toBeVisible()
  await page.reload()
  await expect(workspaceSwitcher).toBeVisible()
  expect(consoleErrors).toEqual([])
})

test('workspace entry exposes a retryable backend failure', async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ contentType: 'application/json', status: 503, body: '{"error":"Temporary"}' })
  })
  await page.goto('/onboarding')
  await expect(page.getByText('PlanGlade is temporarily unavailable', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Try again' })).toBeEnabled()
})

test('workspace onboarding enables only valid input and refreshes the session after creation', async ({ page }) => {
  let onboardingRequired = true
  await page.route('**/api/auth/session', async (route) => {
    if (onboardingRequired) {
      await route.fulfill({ contentType: 'application/json', status: 409, body: '{"code":"ONBOARDING_REQUIRED","error":"Onboarding required"}' })
      return
    }
    await route.continue()
  })
  const creation = page.waitForRequest((request) =>
    new URL(request.url()).pathname === '/api/workspace/onboarding' && request.method() === 'POST',
  )
  await page.route('**/api/workspace/onboarding', async (route) => {
    onboardingRequired = false
    await route.fulfill({ contentType: 'application/json', status: 201, body: '{"workspace":{"id":"created","slug":"created","name":"Created workspace"}}' })
  })
  await page.goto('/onboarding')
  const name = page.getByLabel('Workspace name')
  await expect(name).toBeFocused()
  const continueButton = page.getByRole('button', { name: 'Continue to workspace' })
  await expect(continueButton).toBeDisabled()
  await name.fill('Created workspace')
  await expect(continueButton).toBeEnabled()
  await continueButton.press('Enter')
  await expect(creation).resolves.toBeTruthy()
  await expect(page).toHaveURL('/app')
})

test('authenticated API mode reads protected workspace data through Vite', async ({ page }) => {
  const fixture = await runtime()
  const directBackendRequests: string[] = []
  const corsFailures: string[] = []
  const consoleErrors = collectConsoleErrors(page)
  page.on('request', (request) => {
    if (new URL(request.url()).port === '3000') directBackendRequests.push(request.url())
  })
  page.on('requestfailed', (request) => {
    if (request.failure()?.errorText.toLowerCase().includes('cors')) corsFailures.push(request.url())
  })

  await page.goto('/app')
  await expect(page.getByRole('button', { name: `Switch workspace. Current workspace: ${fixture.workspaceName}` })).toBeVisible()
  await page.goto('/app/tasks')
  await expect(page.getByText(fixture.projectName, { exact: true }).first()).toBeVisible()
  await expect(page.getByText(fixture.taskTitle, { exact: true })).toBeVisible()
  expect(directBackendRequests).toEqual([])
  expect(corsFailures).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('primary, compatibility, back, and home navigation remain wired', async ({ page }) => {
  const destinations = [
    ['Home', '/app'],
    ['Inbox', '/app/inbox'],
    ['Tasks', '/app/tasks'],
    ['Projects', '/app/projects'],
    ['Notes', '/app/notes'],
    ['Calendar', '/app/calendar'],
    ['Connections', '/app/connections'],
    ['Settings', '/app/settings'],
  ] as const

  await page.goto('/app')
  for (const [name, path] of destinations.slice(1)) {
    await page.getByLabel('Sidebar').getByRole('link', { name }).click()
    await expect(page).toHaveURL(path)
    await expect(page.locator('main')).toBeVisible()
  }
  await page.getByLabel('Sidebar').getByRole('link', { name: 'Home' }).click()
  await expect(page).toHaveURL('/app')

  await page.goto('/tasks?view=board')
  await expect(page).toHaveURL('/app/tasks?view=board')
  await page.goto('/app/projects')
  await page.goto('/app/notes')
  await page.goBack()
  await expect(page).toHaveURL('/app/projects')
  await page.goForward()
  await expect(page).toHaveURL('/app/notes')
  await page.goto('/tasks?view=board')
  await page.goto('/missing-page')
  await expect(page.getByRole('heading', { name: 'This path does not lead to a PlanGlade page.' })).toBeVisible()
  await page.getByRole('button', { name: 'Go back' }).click()
  await expect(page).toHaveURL('/app/tasks?view=board')
  await page.goto('/missing-page')
  await page.getByRole('link', { name: 'Go home' }).click()
  await expect(page).toHaveURL('/')
})

test('Tasks view tabs keep their selected semantic state while switching views', async ({ page }) => {
  await page.goto('/app/tasks')
  const list = page.getByRole('tab', { name: 'List' })
  const board = page.getByRole('tab', { name: 'Board' })
  await expect(list).toHaveAttribute('aria-selected', 'true')
  await board.click()
  await expect(page).toHaveURL('/app/tasks?view=board')
  await expect(board).toHaveAttribute('aria-selected', 'true')
})

test('Tasks creates a server-backed task that persists after refresh', async ({ page }) => {
  const fixture = await runtime()
  const title = `Created task ${fixture.runId} with a deliberately long single-line title`
  await page.goto('/app/tasks')
  await page.getByRole('button', { name: 'New task' }).click()
  await page.getByRole('dialog').getByLabel('Task title').fill(title)
  const created = page.waitForResponse((response) =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/work-items',
  )
  await page.getByRole('button', { name: 'Create task' }).click()
  expect((await created).status()).toBe(201)
  const taskButton = page.getByRole('button', { name: `Task: ${title}` })
  await expect(taskButton).toBeVisible()
  const titleElement = taskButton.locator('..').locator('[data-task-title]')
  expect(await titleElement.evaluate((element) => getComputedStyle(element).whiteSpace)).toBe('nowrap')
  const taskCardStyle = await page.locator('[data-task-group-card]').first().evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      borderRadius: style.borderRadius,
      boxShadow: style.boxShadow,
    }
  })
  expect(taskCardStyle.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
  expect(taskCardStyle.borderRadius).toBe('8px')
  expect(taskCardStyle.boxShadow).not.toBe('none')
  await page.reload()
  await expect(page.getByRole('button', { name: `Task: ${title}` })).toBeVisible()
})

test('project and task deletion stay truthful while comments persist and retry', async ({ page }) => {
  const fixture = await runtime()
  const projectName = `Delete project ${fixture.runId}`
  const taskTitle = `Delete task ${fixture.runId}`
  const firstComment = `First comment ${fixture.runId}`
  const secondComment = `Second comment ${fixture.runId}`
  const retryComment = `Retry comment ${fixture.runId}`

  await page.goto('/app/projects')
  await page.getByRole('button', { name: /new project/i }).click()
  const projectDialog = page.getByRole('dialog', { name: 'New project' })
  await projectDialog.getByLabel('Name').fill(projectName)
  await projectDialog.getByLabel('Project URL slug').fill(`delete-project-${fixture.runId}`)
  const projectCreated = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/projects')
  await projectDialog.getByRole('button', { name: 'Create project' }).click()
  const projectResponse = await projectCreated
  expect(projectResponse.status()).toBe(201)
  const project = (await projectResponse.json() as { project: { id: string } }).project
  await expect(page.getByRole('heading', { name: projectName })).toBeVisible()

  await page.goto('/app/projects')
  await page.getByLabel('Search projects').fill(projectName)
  await expect(page.getByText(projectName, { exact: true })).toBeVisible()

  await page.goto('/app/tasks')
  await page.getByRole('button', { name: 'New task' }).click()
  const taskDialog = page.getByRole('dialog', { name: 'New task' })
  await taskDialog.getByLabel('Task title').fill(taskTitle)
  await taskDialog.getByRole('combobox', { name: 'Project' }).click()
  await page.getByRole('option', { name: projectName, exact: true }).click()
  const taskCreated = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/work-items')
  await taskDialog.getByRole('button', { name: 'Create task' }).click()
  const taskResponse = await taskCreated
  expect(taskResponse.status()).toBe(201)
  const task = (await taskResponse.json() as { workItem: { id: string } }).workItem

  const taskSearch = page.getByLabel('Search tasks')
  await taskSearch.fill(taskTitle)
  const taskButton = page.getByRole('button', { name: `Task: ${taskTitle}` })
  await expect(taskButton).toBeVisible()
  await taskButton.click()
  let drawer = page.getByLabel('Task details')
  const comment = drawer.getByLabel('Write a comment')
  const post = drawer.getByRole('button', { name: 'Post comment' })
  await expect(post).toBeDisabled()

  for (const body of [firstComment, secondComment]) {
    await comment.fill(body)
    await expect(post).toBeEnabled()
    const posted = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith(`/work-items/${task.id}/comments`))
    await post.click()
    expect((await posted).ok()).toBe(true)
    await expect(drawer.getByText(body, { exact: true })).toBeVisible()
  }

  await page.reload()
  await page.getByLabel('Search tasks').fill(taskTitle)
  await page.getByRole('button', { name: `Task: ${taskTitle}` }).click()
  drawer = page.getByLabel('Task details')
  await expect(drawer.getByText(firstComment, { exact: true })).toBeVisible()
  await expect(drawer.getByText(secondComment, { exact: true })).toBeVisible()

  await page.route(`**/api/work-items/${task.id}/comments**`, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Unavailable' }) })
      return
    }
    await route.continue()
  })
  await drawer.getByLabel('Write a comment').fill(retryComment)
  await drawer.getByRole('button', { name: 'Post comment' }).click()
  await expect(drawer.getByRole('alert')).toContainText('not posted')
  await expect(drawer.getByLabel('Write a comment')).toHaveValue(retryComment)
  await page.unroute(`**/api/work-items/${task.id}/comments**`)
  await drawer.getByRole('button', { name: 'Post comment' }).click()
  await expect(drawer.getByText(retryComment, { exact: true })).toBeVisible()
  await drawer.getByRole('button', { name: 'Close' }).click()

  await page.goto(`/app/projects/${project.id}`)
  await page.getByRole('button', { name: 'Edit project' }).click()
  await page.getByRole('dialog', { name: 'Edit project' }).getByRole('button', { name: 'Delete project' }).click()
  const projectDelete = page.getByRole('alertdialog', { name: 'Delete this project?' })
  await expect(projectDelete).toContainText('Its tasks and notes will remain without a project.')
  const projectDeleted = page.waitForResponse((response) => response.request().method() === 'DELETE' && new URL(response.url()).pathname.endsWith(`/projects/${project.id}`))
  await projectDelete.getByRole('button', { name: 'Delete project' }).click()
  expect((await projectDeleted).status()).toBe(200)
  await expect(page).toHaveURL('/app/projects')
  await expect(page.getByText(projectName, { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByText(projectName, { exact: true })).toHaveCount(0)

  await page.goto('/app/tasks')
  await page.getByLabel('Search tasks').fill(taskTitle)
  await page.getByRole('button', { name: `Task: ${taskTitle}` }).click()
  drawer = page.getByLabel('Task details')
  await expect(drawer.getByRole('combobox', { name: 'Project' })).toContainText('No project')
  await drawer.getByRole('button', { name: 'Delete task' }).click()
  const taskDelete = page.getByRole('alertdialog', { name: 'Delete this task?' })
  const taskDeleted = page.waitForResponse((response) => response.request().method() === 'DELETE' && new URL(response.url()).pathname.endsWith(`/work-items/${task.id}`))
  await taskDelete.getByRole('button', { name: 'Delete', exact: true }).click()
  expect((await taskDeleted).status()).toBe(200)
  await expect(page.getByRole('button', { name: `Task: ${taskTitle}` })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('button', { name: `Task: ${taskTitle}` })).toHaveCount(0)
})

test('task and note attachments support upload, list, rename, download, and delete', async ({ page }) => {
  const fixture = await runtime()
  const taskFile = `task-brief-${fixture.runId}.txt`
  const renamedTaskFile = `task-brief-renamed-${fixture.runId}.txt`
  await openTaskDrawer(page, fixture.taskTitle)
  const taskAttachments = page.getByRole('region', { name: 'Attachments' })
  await expect(taskAttachments).toContainText('No attachments yet.')
  await taskAttachments.getByLabel('Add attachment').setInputFiles({
    name: taskFile,
    mimeType: 'text/plain',
    buffer: Buffer.from('PlanGlade task attachment'),
  })
  await expect(taskAttachments.getByText(taskFile, { exact: true })).toBeVisible()

  await taskAttachments.getByRole('button', { name: `Rename ${taskFile}` }).click()
  await taskAttachments.getByLabel(`Rename ${taskFile}`).fill(renamedTaskFile)
  await taskAttachments.getByRole('button', { name: `Save name for ${taskFile}` }).click()
  await expect(taskAttachments.getByText(renamedTaskFile, { exact: true })).toBeVisible()
  await page.reload()
  await openTaskDrawer(page, fixture.taskTitle)
  await expect(taskAttachments.getByText(renamedTaskFile, { exact: true })).toBeVisible()

  const taskDownload = page.waitForEvent('download')
  await taskAttachments.getByRole('button', { name: `Download ${renamedTaskFile}` }).last().click()
  const downloadedTaskFile = await taskDownload
  expect(downloadedTaskFile.suggestedFilename()).toBe(renamedTaskFile)
  expect(await readFile(await downloadedTaskFile.path(), 'utf8')).toBe('PlanGlade task attachment')

  await taskAttachments.getByRole('button', { name: `Delete ${renamedTaskFile}` }).click()
  const deleteDialog = page.getByRole('alertdialog', { name: 'Delete this attachment?' })
  const confirmDelete = deleteDialog.getByRole('button', { name: /Delete attachment|Deleting/ })
  await expect(deleteDialog).toContainText(renamedTaskFile)
  let deleteAttempts = 0
  let releaseSecondDelete = () => {}
  const secondDeleteGate = new Promise<void>((resolve) => { releaseSecondDelete = resolve })
  await page.route('**/api/attachments/*', async (route) => {
    if (route.request().method() === 'DELETE') {
      deleteAttempts += 1
      if (deleteAttempts === 2) await secondDeleteGate
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Controlled deletion failure' }) })
      return
    }
    await route.continue()
  })
  await confirmDelete.click()
  await expect(deleteDialog.getByRole('alert')).toHaveText('The attachment service is temporarily unavailable. Try again.')
  await expect(confirmDelete).toBeFocused()
  await expect(deleteDialog).toBeVisible()
  await confirmDelete.click()
  await expect(confirmDelete).toHaveText('Deleting…')
  await expect(deleteDialog.getByRole('alert')).toHaveCount(0)
  releaseSecondDelete()
  await expect(deleteDialog.getByRole('alert')).toHaveText('The attachment service is temporarily unavailable. Try again.')
  await expect(confirmDelete).toBeFocused()
  await page.unroute('**/api/attachments/*')
  await confirmDelete.click()
  await expect(taskAttachments.getByText(renamedTaskFile, { exact: true })).toHaveCount(0)
  await expect(taskAttachments).toContainText('No attachments yet.')
  await page.reload()
  await openTaskDrawer(page, fixture.taskTitle)
  await expect(taskAttachments.getByText(renamedTaskFile, { exact: true })).toHaveCount(0)
  await expect(taskAttachments).toContainText('No attachments yet.')

  const note = await page.evaluate(async ({ fixture }) => {
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceId: fixture.workspaceId,
        projectId: fixture.secondaryProjectId,
        title: `Attachment note ${fixture.runId}`,
        body: 'A note with a stored file.',
        visibility: 'WORKSPACE',
        pinned: false,
        tags: [],
      }),
    })
    if (!response.ok) throw new Error(`Note creation returned ${response.status}`)
    return (await response.json() as { note: { id: string } }).note
  }, { fixture })
  await page.goto(`/app/notes?note=${encodeURIComponent(note.id)}`)
  const noteAttachments = page.getByRole('region', { name: 'Attachments' })
  const noteFile = `note-context-${fixture.runId}.md`
  await noteAttachments.getByLabel('Add attachment').setInputFiles({
    name: noteFile,
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Note context'),
  })
  await expect(noteAttachments.getByText(noteFile, { exact: true })).toBeVisible()
  await page.reload()
  await expect(noteAttachments.getByText(noteFile, { exact: true })).toBeVisible()
  await noteAttachments.getByRole('button', { name: `Delete ${noteFile}` }).click()
  await page.getByRole('alertdialog', { name: 'Delete this attachment?' }).getByRole('button', { name: 'Delete attachment' }).click()
  await expect(noteAttachments.getByText(noteFile, { exact: true })).toHaveCount(0)
  await page.reload()
  await expect(noteAttachments.getByText(noteFile, { exact: true })).toHaveCount(0)
  await expect(noteAttachments).toContainText('No attachments yet.')
})

test('task attachment availability follows project reassignment without a reload', async ({ page }) => {
  const fixture = await runtime()
  const disabledProjectName = `Attachments disabled ${fixture.runId}`
  await page.goto('/app')
  await page.evaluate(async ({ fixture, disabledProjectName }) => {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workspaceId: fixture.workspaceId,
        name: disabledProjectName,
        slug: `attachments-disabled-${fixture.runId}`,
        featureFlags: { attachments: false },
      }),
    })
    if (!response.ok) throw new Error(`Disabled project creation returned ${response.status}`)
  }, { fixture, disabledProjectName })

  await page.goto('/app/tasks')
  await openTaskDrawer(page, fixture.taskTitle)
  const taskDialog = page.getByRole('dialog', { name: 'Task details' })
  const taskAttachments = taskDialog.getByRole('region', { name: 'Attachments' })
  const projectSelect = taskDialog.getByRole('combobox', { name: 'Project' })
  await projectSelect.click()
  await page.getByRole('option', { name: disabledProjectName }).click()
  await expect(taskAttachments).toContainText('Attachments are unavailable for this item.')
  await projectSelect.click()
  await page.getByRole('option', { name: fixture.projectName }).click()
  await expect(taskAttachments).toContainText('No attachments yet.')
})

test('Connections renders authenticated Notes and normalized task relationships', async ({ page }) => {
  const fixture = await runtime()
  await page.goto('/app')
  const noteTitle = `Connections note ${fixture.runId}`
  const parentTitle = `Connections parent ${fixture.runId}`
  const childTitle = `Connections child ${fixture.runId}`
  const seeded = await rawTask(page, fixture.workspaceId, fixture.taskTitle) as { id: string; updatedAt: string } | undefined
  const reviewed = await rawTask(page, fixture.workspaceId, fixture.reviewTaskTitle) as { id: string; updatedAt: string } | undefined
  if (!seeded || !reviewed) throw new Error('Connections fixtures were not seeded')

  const seededConnections = await page.evaluate(async ({ childTitle, fixture, noteTitle, parentTitle, reviewedId, seedId, seedUpdatedAt }) => {
    const request = async (path: string, method: string, body: Record<string, unknown>) => {
      const response = await fetch(path, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      if (!response.ok) throw new Error(`${method} ${path} returned ${response.status}`)
      return response.json()
    }
    const note = await request('/api/notes', 'POST', {
      workspaceId: fixture.workspaceId,
      projectId: fixture.secondaryProjectId,
      title: noteTitle,
      body: 'An explicit authenticated task reference.',
      visibility: 'WORKSPACE',
      pinned: false,
      tags: [],
    }) as { note: { id: string } }
    await request(`/api/work-items/${encodeURIComponent(seedId)}?workspaceId=${encodeURIComponent(fixture.workspaceId)}`, 'PATCH', {
      noteIds: [note.note.id],
      expectedUpdatedAt: seedUpdatedAt,
    })
    const parent = await request('/api/work-items', 'POST', {
      workspaceId: fixture.workspaceId,
      projectId: fixture.secondaryProjectId,
      title: parentTitle,
      status: 'TODO',
      priority: 'MEDIUM',
    }) as { workItem: { id: string; updatedAt: string } }
    const child = await request('/api/work-items', 'POST', {
      workspaceId: fixture.workspaceId,
      projectId: fixture.secondaryProjectId,
      title: childTitle,
      status: 'TODO',
      priority: 'MEDIUM',
    }) as { workItem: { id: string; updatedAt: string } }
    await request(`/api/work-items/${encodeURIComponent(child.workItem.id)}?workspaceId=${encodeURIComponent(fixture.workspaceId)}`, 'PATCH', {
      parentId: parent.workItem.id,
      expectedUpdatedAt: child.workItem.updatedAt,
    })
    await request('/api/work-item-relations', 'POST', {
      workspaceId: fixture.workspaceId,
      sourceId: reviewedId,
      targetId: seedId,
      relationType: 'BLOCKS',
    })
  }, {
    childTitle,
    fixture,
    noteTitle,
    parentTitle,
    reviewedId: reviewed.id,
    seedId: seeded.id,
    seedUpdatedAt: seeded.updatedAt,
  })
  expect(seededConnections).toBeUndefined()

  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  await page.goto('/app/connections')
  await expect(page.getByText(noteTitle, { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'List' }).click()
  const relationships = page.getByRole('region', { name: 'Relationship list' })
  await expect(relationships.getByRole('button', { name: noteTitle }).first()).toBeVisible()
  await expect(relationships).toContainText('has note')
  await expect(relationships).toContainText('has child')
  await expect(relationships).toContainText('blocks')
  await relationships.getByRole('button', { name: fixture.taskTitle }).first().focus()
  await relationships.getByRole('button', { name: fixture.taskTitle }).first().press('Enter')
  await expect(page.getByLabel('Task details')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(relationships.getByRole('button', { name: fixture.taskTitle }).first()).toBeFocused()

  await page.getByRole('tab', { name: 'Map' }).click()
  await page.getByRole('textbox', { name: 'Find a node' }).fill(noteTitle)
  const noteNode = page.getByRole('button', { name: new RegExp(`^Select note: ${noteTitle}`) })
  await expect(noteNode).toBeVisible()
  await noteNode.press('Enter')
  await expect(page.getByRole('button', { name: 'Open note' })).toBeVisible()
  for (const width of [1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  }
  expect(consoleErrors).toEqual([])
})

test('Connections reports failed Notes and relationship data instead of showing a silent partial graph', async ({ page }) => {
  await page.route('**/api/notes?*', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: '{"error":"Temporary"}',
  }))
  await page.route('**/api/work-item-relations?*', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: '{"error":"Temporary"}',
  }))

  await page.goto('/app/connections')

  const alert = page.getByRole('alert')
  await expect(alert).toContainText('Connections are incomplete')
  await expect(alert).toContainText('notes or task relationships')
  await expect(alert.getByRole('button', { name: 'Reload connections' })).toBeVisible()
})

test('Connections states the exact 500-relationship response boundary', async ({ page }) => {
  const fixture = await runtime()
  await page.route('**/api/work-item-relations?*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      relations: Array.from({ length: 500 }, (_, index) => ({
        id: `relation-${index}`,
        workspaceId: fixture.workspaceId,
        sourceId: `source-${index}`,
        targetId: `target-${index}`,
        relationType: 'BLOCKS',
        createdAt: new Date(1_700_000_000_000 + index).toISOString(),
        source: { id: `source-${index}`, title: `Source ${index}`, projectId: null },
        target: { id: `target-${index}`, title: `Target ${index}`, projectId: null },
      })),
    }),
  }))

  await page.goto('/app/connections')

  const notice = page.getByRole('alert').filter({ hasText: 'Loaded the 500 newest task relationships' })
  await expect(notice).toContainText('Older relationships may not appear')
  await expect(notice).toContainText('Filters narrow only this loaded set')
})

test('invitation acceptance and already-accepted continuation activate the reviewed workspace', async ({ page }) => {
  const token = 'a'.repeat(32)
  let alreadyAccepted = false
  let acceptCalls = 0
  let targetWorkspaceId = 'accepted-workspace'
  const review = () => ({
    email: 'invited@example.test',
    role: 'MEMBER',
    status: 'PENDING',
    expiresAt: '2030-01-01T00:00:00.000Z',
    customMessage: null,
    alreadyAccepted,
    workspace: { id: targetWorkspaceId, name: 'Accepted workspace', slug: 'accepted-workspace' },
    invitedBy: { id: 'inviter', email: 'inviter@example.test', name: 'Inviter' },
  })
  await page.route('**/api/workspace/invitations/preview', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ review: review() }),
  }))
  await page.route('**/api/workspace/invitations/accept', (route) => {
    acceptCalls += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accepted: true,
        workspace: review().workspace,
        member: { userId: 'invited-user', role: 'MEMBER', joinedAt: '2026-09-03T00:00:00.000Z' },
      }),
    })
  })
  await page.route('**/api/auth/session?workspaceId=*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      user: { id: 'invited-user', email: 'invited@example.test', name: 'Invited user' },
      workspace: { id: targetWorkspaceId, slug: targetWorkspaceId, name: 'Accepted workspace' },
      workspaces: [{ id: targetWorkspaceId, slug: targetWorkspaceId, name: 'Accepted workspace', role: 'MEMBER' }],
      authMode: 'nextauth',
    }),
  }))

  await page.goto(`/invite/review?inviteToken=${token}&next=/app/tasks`)
  await page.getByRole('button', { name: 'Accept invitation' }).click()
  await expect(page).toHaveURL('/app/tasks')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('planglade-active-workspace-v1'))).toBe('accepted-workspace')
  expect(acceptCalls).toBe(1)

  alreadyAccepted = true
  targetWorkspaceId = 'already-accepted-workspace'
  await page.goto(`/invite/review?inviteToken=${token}&next=/app/projects`)
  await page.getByRole('link', { name: 'Continue to workspace' }).click()
  await expect(page).toHaveURL('/app/projects')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('planglade-active-workspace-v1'))).toBe('already-accepted-workspace')
  expect(acceptCalls).toBe(1)
})

test('server-backed Members are not offered Admin-only export actions', async ({ page }) => {
  await page.route('**/api/auth/session*', async (route) => {
    const response = await route.fetch()
    const session = await response.json() as {
      workspace: { id: string }
      workspaces?: Array<{ id: string; role: string }>
    }
    await route.fulfill({
      response,
      json: {
        ...session,
        workspaces: session.workspaces?.map((workspace) => workspace.id === session.workspace.id
          ? { ...workspace, role: 'MEMBER' }
          : workspace),
      },
    })
  })

  await page.goto('/app/settings')

  const dataSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Your data' }) })
  await expect(dataSection).toContainText('Only workspace admins can export workspace data.')
  await expect(dataSection).toContainText('Admin only')
  await expect(dataSection.getByRole('button', { name: 'Preview' })).toHaveCount(0)
  await expect(dataSection.getByRole('button', { name: 'Download' })).toHaveCount(0)
})

test('Quick Capture creates one persisted backend Inbox item', async ({ page }) => {
  const fixture = await runtime()
  const title = `Quick Capture ${fixture.runId}`
  const consoleErrors = collectConsoleErrors(page)
  await page.goto('/app')
  await page.getByLabel('Quick capture to inbox').fill(title)
  const response = page.waitForResponse((candidate) =>
    new URL(candidate.url()).pathname === '/api/work-items' && candidate.request().method() === 'POST',
  )
  await page.getByLabel('Quick capture to inbox').press('Enter')
  const created = await response
  expect(created.status()).toBe(201)
  await expect(created.json()).resolves.toMatchObject({ workItem: { title, status: 'BACKLOG' } })

  await page.goto('/app/inbox')
  await expect(page.getByText(title, { exact: true })).toHaveCount(1)
  await page.reload()
  await expect(page.getByText(title, { exact: true })).toHaveCount(1)
  expect(consoleErrors).toEqual([])
})

test('Quick Capture keeps the dialog open when the server rejects the save', async ({ page }) => {
  await page.route('**/api/work-items', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ contentType: 'application/json', status: 503, body: '{"error":"Temporary"}' })
      return
    }
    await route.continue()
  })
  await page.goto('/app/tasks')
  await page.getByRole('button', { name: 'Quick capture' }).click()

  const dialog = page.getByRole('dialog', { name: 'Capture something' })
  const input = dialog.getByRole('textbox', { name: 'Capture text' })
  await input.fill('Keep this capture on server failure')
  await dialog.getByRole('button', { name: 'Save to Inbox' }).click()

  await expect(dialog).toBeVisible()
  await expect(input).toHaveValue('Keep this capture on server failure')
  await expect(page.getByText('PlanGlade is temporarily unavailable.')).toBeVisible()
})

test('Task drawer keeps the newest debounced title when an older save settles late', async ({ page }) => {
  const fixture = await runtime()
  const firstTitle = `First title ${fixture.runId}`
  const finalTitle = `Final title ${fixture.runId}`
  let releaseFirstPatch: (() => void) | undefined
  let firstPatchSeen!: () => void
  const firstPatch = new Promise<void>((resolve) => { firstPatchSeen = resolve })
  const delayedPatch = async (route: Route) => {
    const request = route.request()
    if (request.method() === 'PATCH' && request.postDataJSON()?.title === firstTitle) {
      firstPatchSeen()
      await new Promise<void>((resolve) => { releaseFirstPatch = resolve })
    }
    await route.continue()
  }

  await openTaskDrawer(page, fixture.taskTitle)
  await page.route('**/api/work-items/**', delayedPatch)
  const title = page.getByLabel('Task title')
  await title.fill(firstTitle)
  await firstPatch
  await expect(page.getByText('Saving task changes')).toBeVisible()
  await title.fill(`Second title ${fixture.runId}`)
  await title.fill(finalTitle)
  const finalPatch = taskPatch(page, { title: finalTitle })
  releaseFirstPatch?.()
  expect((await finalPatch).status()).toBe(200)
  await page.unroute('**/api/work-items/**', delayedPatch)
  await expect(title).toHaveValue(finalTitle)
  await openTaskDrawer(page, finalTitle)
  await expect(page.getByLabel('Task title')).toHaveValue(finalTitle)
})

test('Task drawer preserves failed descriptions and accepts a deliberate retry without flattening source values', async ({ page }) => {
  const fixture = await runtime()
  const failedDescription = `Failed description ${fixture.runId}`
  const finalDescription = `Final description ${fixture.runId}`
  let failedPatches = 0
  const failDescription = async (route: Route) => {
    const request = route.request()
    if (request.method() === 'PATCH' && request.postDataJSON()?.description === failedDescription) {
      failedPatches += 1
      await route.fulfill({ contentType: 'application/json', status: 503, body: '{"error":"Temporary"}' })
      return
    }
    await route.continue()
  }

  await openTaskDrawer(page, fixture.reviewTaskTitle)
  await page.route('**/api/work-items/**', failDescription)
  const description = page.getByLabel('Task description')
  await description.fill(failedDescription)
  await expect(page.getByText('This change was not saved. Edit again to retry.')).toBeVisible()
  await expect(description).toHaveValue(failedDescription)
  await page.waitForTimeout(700)
  expect(failedPatches).toBe(1)
  await page.unroute('**/api/work-items/**', failDescription)

  const savedPatch = taskPatch(page, { description: finalDescription })
  await description.fill(finalDescription)
  expect((await savedPatch).status()).toBe(200)
  await openTaskDrawer(page, fixture.reviewTaskTitle)
  await expect(page.getByLabel('Task description')).toHaveValue(finalDescription)
  await expect.poll(() => rawTask(page, fixture.workspaceId, fixture.reviewTaskTitle)).toMatchObject({
    description: finalDescription,
    priority: 'URGENT',
    status: 'IN_REVIEW',
  })
})

test('Task drawer selectors, date, and completion persist with truthful failure recovery', async ({ page }) => {
  const fixture = await runtime()
  const title = `Final title ${fixture.runId}`
  let failedPatches = 0
  const failStatusAndCompletion = async (route: Route) => {
    const request = route.request()
    const body = request.postDataJSON() as Record<string, unknown> | null
    if (request.method() === 'PATCH' && (body?.status === 'IN_PROGRESS' || body?.status === 'DONE')) {
      failedPatches += 1
      await route.fulfill({ contentType: 'application/json', status: 503, body: '{"error":"Temporary"}' })
      return
    }
    await route.continue()
  }

  await openTaskDrawer(page, title)
  await page.route('**/api/work-items/**', failStatusAndCompletion)
  await page.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'In Progress', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Status' })).toContainText('Planned')
  await page.waitForTimeout(250)
  expect(failedPatches).toBe(1)
  await page.unroute('**/api/work-items/**', failStatusAndCompletion)

  const statusPatch = taskPatch(page, { status: 'IN_PROGRESS' })
  await page.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'In Progress', exact: true }).click()
  expect((await statusPatch).status()).toBe(200)

  const projectPatch = taskPatch(page, { projectId: fixture.secondaryProjectId })
  await page.getByRole('combobox', { name: 'Project' }).click()
  await page.getByRole('option', { name: fixture.secondaryProjectName, exact: true }).click()
  expect((await projectPatch).status()).toBe(200)

  const priorityPatch = taskPatch(page, { priority: 'HIGH' })
  await page.getByRole('combobox', { name: 'Priority' }).click()
  await page.getByRole('option', { name: 'High', exact: true }).click()
  expect((await priorityPatch).status()).toBe(200)

  const clearDatePatch = taskPatch(page, { dueDate: null })
  await page.getByLabel('Clear due date').click()
  expect((await clearDatePatch).status()).toBe(200)
  await page.getByLabel('Due date').click()
  const dayButton = page.locator('[data-slot="calendar"] button[data-day]').first()
  const selectedDay = await dayButton.getAttribute('data-day')
  if (!selectedDay) throw new Error('Calendar day did not provide a date')
  const [month, day, year] = selectedDay.split('/')
  const dueDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  const setDatePatch = taskPatch(page, { dueDate: `${dueDate}T00:00:00.000Z` })
  await dayButton.click()
  expect((await setDatePatch).status()).toBe(200)

  const failCompletion = async (route: Route) => {
    const request = route.request()
    if (request.method() === 'PATCH' && request.postDataJSON()?.status === 'DONE') {
      await route.fulfill({ contentType: 'application/json', status: 503, body: '{"error":"Temporary"}' })
      return
    }
    await route.continue()
  }
  await page.route('**/api/work-items/**', failCompletion)
  const completion = page.getByRole('checkbox', { name: 'Mark as done' })
  await completion.click()
  await expect(completion).toHaveAttribute('aria-checked', 'false')
  await page.unroute('**/api/work-items/**', failCompletion)
  const completePatch = taskPatch(page, { status: 'DONE' })
  await completion.click()
  expect((await completePatch).status()).toBe(200)
  await expect(page.getByRole('checkbox', { name: 'Mark as not done' })).toHaveAttribute('aria-checked', 'true')

  await expect(page.getByRole('combobox', { name: 'Project' })).toContainText(fixture.secondaryProjectName)
  await expect(page.getByRole('combobox', { name: 'Status' })).toContainText('Done')
  await expect(page.getByRole('combobox', { name: 'Priority' })).toContainText('High')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await expect.poll(() => rawTask(page, fixture.workspaceId, title)).toMatchObject({
    dueDate: `${dueDate}T00:00:00.000Z`,
    priority: 'HIGH',
    projectId: fixture.secondaryProjectId,
    status: 'DONE',
  })
})

test('List completion can be reopened and completed again, then survives refresh', async ({ page }) => {
  const fixture = await runtime()
  const title = `Final title ${fixture.runId}`
  await page.goto('/app/tasks')

  const row = page.locator('[data-task-id]').filter({ has: page.getByRole('button', { name: `Task: ${title} (done)` }) })
  await row.getByRole('button', { name: `Task: ${title} (done)` }).press('Enter')
  await expect(page.getByLabel('Task details')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(row.getByRole('button', { name: `Task: ${title} (done)` })).toBeFocused()
  const reopened = taskPatch(page, { status: 'TODO' })
  await row.getByRole('checkbox', { name: 'Mark as not done' }).click()
  expect((await reopened).status()).toBe(200)

  const completed = taskPatch(page, { status: 'DONE' })
  const openRow = page.locator('[data-task-id]').filter({ has: page.getByRole('button', { name: `Task: ${title}` }) })
  await expect(openRow.getByRole('checkbox', { name: 'Mark as done' })).toBeVisible()
  await openRow.getByRole('checkbox', { name: 'Mark as done' }).click()
  expect((await completed).status()).toBe(200)
  await page.reload()
  await expect(page.getByRole('button', { name: `Task: ${title} (done)` })).toBeVisible()
  await expect.poll(() => rawTask(page, fixture.workspaceId, title)).toMatchObject({ status: 'DONE' })
})

test('Board preserves IN_REVIEW in its dedicated column and restores rejected status changes', async ({ page }) => {
  const fixture = await runtime()
  const title = fixture.reviewTaskTitle
  await page.goto('/app/tasks?view=board')
  const source = await rawTask(page, fixture.workspaceId, title) as { id: string; status: string } | undefined
  if (!source) throw new Error('Review fixture task was not seeded')

  const inReview = page.getByRole('region', { name: 'In Review column' })
  const card = inReview.locator(`[data-task-id="${source.id}"]`)
  await expect(card).toBeVisible()
  await expect(card).toContainText(title)
  await card.getByRole('button', { name: `Task card: ${title}` }).press('Enter')
  await expect(page.getByLabel('Task details')).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Status' })).toContainText('In Review')
  await page.keyboard.press('Escape')
  await expect(card.getByRole('button', { name: `Task card: ${title}` })).toBeFocused()
  await page.goto('/app/tasks?view=board')

  const failStatus = async (route: Route) => {
    const request = route.request()
    if (request.method() === 'PATCH' && request.postDataJSON()?.status === 'IN_PROGRESS') {
      await route.fulfill({ contentType: 'application/json', status: 503, body: '{"error":"Temporary"}' })
      return
    }
    await route.continue()
  }
  await page.route('**/api/work-items/**', failStatus)
  await inReview.locator(`[data-task-id="${source.id}"]`).getByRole('button', { name: `Task card: ${title}` }).press('Enter')
  await page.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'In Progress', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Status' })).toContainText('In Review')
  await expect.poll(() => rawTask(page, fixture.workspaceId, title)).toMatchObject({ status: 'IN_REVIEW' })
  await page.unroute('**/api/work-items/**', failStatus)

  const moved = taskPatch(page, { status: 'IN_PROGRESS' })
  await page.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'In Progress', exact: true }).click()
  expect((await moved).status()).toBe(200)
  await expect(page.getByRole('combobox', { name: 'Status' })).toContainText('In Progress')
  await expect.poll(() => rawTask(page, fixture.workspaceId, title)).toMatchObject({ status: 'IN_PROGRESS' })

  const restored = taskPatch(page, { status: 'IN_REVIEW' })
  await page.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'In Review', exact: true }).click()
  expect((await restored).status()).toBe(200)
  await expect.poll(() => rawTask(page, fixture.workspaceId, title)).toMatchObject({ status: 'IN_REVIEW' })
})

test('Board keyboard drag moves a task between columns and persists', async ({ page }) => {
  const fixture = await runtime()
  const title = fixture.reviewTaskTitle
  await page.goto('/app/tasks?view=board')
  const source = await rawTask(page, fixture.workspaceId, title) as { id: string } | undefined
  if (!source) throw new Error('Review fixture task was not seeded')

  const card = page.locator(`[data-task-id="${source.id}"]`)
  const cardButton = card.getByRole('button', { name: `Task card: ${title}` })
  const planned = page.getByRole('region', { name: 'Planned column' })
  const sourceBox = await card.boundingBox()
  const targetBox = await planned.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Board keyboard drag targets were not measurable')
  const deltaX = targetBox.x + targetBox.width / 2 - (sourceBox.x + sourceBox.width / 2)
  const deltaY = targetBox.y + targetBox.height / 2 - (sourceBox.y + sourceBox.height / 2)
  await cardButton.focus()
  await page.keyboard.press('Space')
  for (let press = 0; press < Math.ceil(Math.abs(deltaY) / 25); press += 1) await page.keyboard.press(deltaY < 0 ? 'ArrowUp' : 'ArrowDown')
  for (let press = 0; press < Math.ceil(Math.abs(deltaX) / 25); press += 1) await page.keyboard.press(deltaX < 0 ? 'ArrowLeft' : 'ArrowRight')
  const moved = taskPatch(page, { status: 'TODO' })
  await page.keyboard.press('Space')
  expect((await moved).status()).toBe(200)
  await expect.poll(() => rawTask(page, fixture.workspaceId, title)).toMatchObject({ status: 'TODO' })

  const restored = taskPatch(page, { status: 'IN_REVIEW' })
  await page.getByRole('region', { name: 'Planned column' }).locator(`[data-task-id="${source.id}"]`).getByRole('button', { name: `Task card: ${title}` }).press('Enter')
  await page.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'In Review', exact: true }).click()
  expect((await restored).status()).toBe(200)
})

test('Board drag moves a task between supported columns and persists after refresh', async ({ page }) => {
  const fixture = await runtime()
  const title = fixture.reviewTaskTitle
  await page.goto('/app/tasks?view=board')
  const source = await rawTask(page, fixture.workspaceId, title) as { id: string } | undefined
  if (!source) throw new Error('Review fixture task was not seeded')

  const card = page.locator(`[data-task-id="${source.id}"]`)
  const planned = page.getByRole('region', { name: 'Planned column' })
  const moved = taskPatch(page, { status: 'TODO' })
  const sourceBox = await card.boundingBox()
  const targetBox = await planned.boundingBox()
  if (!sourceBox || !targetBox) throw new Error('Board drag targets were not measurable')
  await page.mouse.move(sourceBox.x + 24, sourceBox.y + 18)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 })
  await page.mouse.up()
  expect((await moved).status()).toBe(200)
  await expect.poll(() => rawTask(page, fixture.workspaceId, title)).toMatchObject({ status: 'TODO' })

  const restored = taskPatch(page, { status: 'IN_REVIEW' })
  await page.getByRole('region', { name: 'Planned column' }).locator(`[data-task-id="${source.id}"]`).getByRole('button', { name: `Task card: ${title}` }).press('Enter')
  await page.getByRole('combobox', { name: 'Status' }).click()
  await page.getByRole('option', { name: 'In Review', exact: true }).click()
  expect((await restored).status()).toBe(200)
  await page.reload()
  await expect(page.getByRole('region', { name: 'In Review column' }).locator(`[data-task-id="${source.id}"]`)).toBeVisible()
  await expect.poll(() => rawTask(page, fixture.workspaceId, title)).toMatchObject({ status: 'IN_REVIEW' })
})

test('Settings signs out through the authenticated backend', async ({ page }) => {
  await page.goto('/app/settings')
  const signOut = page.waitForResponse((response) =>
    response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/auth/signout',
  )
  await page.getByRole('button', { name: 'Sign out' }).click()
  expect((await signOut).ok()).toBe(true)
  await page.waitForURL(/\/auth\/login/)
  await expect(page.getByText(/sign in|welcome back/i).first()).toBeVisible()
})

test('core surfaces keep the document within desktop, tablet, and mobile widths', async ({ page }) => {
  const routes = ['/app', '/app/inbox', '/app/tasks?view=board', '/app/calendar', '/app/projects', '/app/connections', '/app/settings']
  for (const viewport of [{ width: 1280, height: 720 }, { width: 768, height: 844 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport)
    for (const route of routes) {
      await page.goto(route)
      expect(await page.evaluate(() => {
        const browser = globalThis as unknown as { document: { documentElement: { scrollWidth: number } }; innerWidth: number }
        return browser.document.documentElement.scrollWidth <= browser.innerWidth
      })).toBe(true)
    }
  }
})

test('signed-out API mode exposes no fixture data and sends no mutation', async ({ browser }) => {
  const fixture = await runtime()
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  const consoleErrors = collectConsoleErrors(page)
  let taskMutations = 0
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/work-items' && request.method() === 'POST') taskMutations += 1
  })

  try {
    expect(await context.cookies()).toEqual([])
    await page.goto('/app')
    await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
    await expect(page.getByText(fixture.taskTitle, { exact: true })).toHaveCount(0)
    expect(taskMutations).toBe(0)
    expect(consoleErrors.filter((error) => !error.includes('status of 401 (Unauthorized)'))).toEqual([])
  } finally {
    await context.close()
  }
})
