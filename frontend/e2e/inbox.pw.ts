import { expect, test } from '@playwright/test'
import { deleteCurrentWorkItem } from './collaborative-cleanup'

type WorkItem = { id: string; title: string; status: string }

test('captures, persists, and converts one Inbox item without a fake task', async ({ page }) => {
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<{ workspace: { id: string } }>)
  const runId = `Inbox browser ${Date.now()}`
  let created: WorkItem | undefined
  try {
    await page.goto('/app/inbox')
    const input = page.getByLabel('Capture to inbox')
    await input.fill(runId)
    const create = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/work-items')
    await page.getByRole('button', { name: 'Capture', exact: true }).click()
    const createdResponse = await create
    expect(createdResponse.status()).toBe(201)
    created = (await createdResponse.json() as { workItem: WorkItem }).workItem
    await expect(page.getByText(runId, { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText(runId, { exact: true })).toBeVisible()

    const patch = page.waitForResponse((response) => response.request().method() === 'PATCH' && new URL(response.url()).pathname.endsWith(`/${created!.id}`))
    await page.getByRole('button', { name: `Convert "${runId}" to task` }).click()
    expect((await patch).status()).toBe(200)
    await expect(page.getByText(runId, { exact: true })).toHaveCount(0)
    await page.goto('/app/tasks')
    await expect(page.getByText(runId, { exact: true })).toBeVisible()
  } finally {
    if (created) {
      await deleteCurrentWorkItem(page.request, session.workspace.id, created.id)
    }
  }
})

test('keeps confirmed Inbox state when capture or conversion is rejected and blocks a rapid duplicate capture', async ({ page }) => {
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<{ workspace: { id: string } }>)
  const existingTitle = `Inbox rejected conversion ${Date.now()}`
  const createdResponse = await page.request.post('/api/work-items', { data: { workspaceId: session.workspace.id, title: existingTitle, status: 'BACKLOG', priority: 'MEDIUM' } })
  expect(createdResponse.status()).toBe(201)
  const existing = (await createdResponse.json() as { workItem: WorkItem }).workItem
  let captureRequests = 0
  let releaseCapture: (() => void) | undefined
  try {
    await page.goto('/app/inbox')
    await expect(page.getByText(existingTitle, { exact: true })).toBeVisible()
    await page.route('**/api/work-items', async (route) => {
      if (route.request().method() === 'POST') {
        captureRequests += 1
        await new Promise<void>((resolve) => { releaseCapture = resolve })
        await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Unavailable' }) })
        return
      }
      await route.continue()
    })
    const input = page.getByLabel('Capture to inbox')
    await input.fill('Keep this capture on failure')
    await page.getByRole('button', { name: 'Capture', exact: true }).click()
    await expect.poll(() => captureRequests).toBe(1)
    await expect(page.getByRole('button', { name: 'Saving…', exact: true })).toBeDisabled()
    await page.getByRole('button', { name: 'Saving…', exact: true }).evaluate((button) => (button as { click: () => void }).click())
    expect(captureRequests).toBe(1)
    releaseCapture?.()
    await expect(input).toHaveValue('Keep this capture on failure')
    await expect(page.getByText('PlanGlade is temporarily unavailable.')).toBeVisible()
    await page.unroute('**/api/work-items')

    await page.route(`**/api/work-items/${existing.id}**`, async (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Unavailable' }) }))
    await page.getByRole('button', { name: `Convert "${existingTitle}" to task` }).click()
    await expect(page.getByText(existingTitle, { exact: true })).toBeVisible()
    await expect(page.getByText('PlanGlade is temporarily unavailable.').first()).toBeVisible()
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    await deleteCurrentWorkItem(page.request, session.workspace.id, existing.id)
  }
})

test('search fields accept values and expose a named clear button', async ({ page }) => {
  const surfaces = [
    ['/app/tasks', 'Search tasks'],
    ['/app/projects', 'Search projects'],
    ['/app/notes', 'Search notes'],
    ['/app/connections', 'Find a node'],
  ] as const

  for (const [route, label] of surfaces) {
    await page.goto(route)
    const input = page.getByLabel(label)
    await expect(input).toBeVisible()
    await input.fill('audit search')
    await expect(input).toHaveValue('audit search')

    const clear = page.getByRole('button', { name: 'Clear search' })
    await expect(clear).toBeVisible()
    await clear.click()
    await expect(input).toHaveValue('')
  }
})

test('Inbox rows keep mobile controls reachable without horizontal overflow', async ({ page }) => {
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<{ workspace: { id: string } }>)
  const title = `Inbox responsive target ${Date.now()} with deliberately long content`
  const createdResponse = await page.request.post('/api/work-items', {
    data: { workspaceId: session.workspace.id, title, status: 'BACKLOG', priority: 'MEDIUM' },
  })
  expect(createdResponse.status()).toBe(201)
  const created = (await createdResponse.json() as { workItem: WorkItem }).workItem

  try {
    for (const width of [1280, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 844 })
      await page.goto('/app/inbox')

      const row = page.getByText(title, { exact: true }).locator('xpath=../..')
      await expect(row).toBeVisible()
      const controls = [
        row.locator('label'),
        row.getByRole('combobox', { name: 'Assign project' }),
        row.getByRole('button', { name: 'Set due date' }),
        row.getByRole('combobox', { name: 'Set priority' }),
        row.getByRole('button', { name: `Convert "${title}" to task` }),
        row.getByRole('button', { name: `Dismiss "${title}"` }),
      ]
      const boxes = await Promise.all(controls.map((control) => control.boundingBox()))

      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
      if (width <= 768) {
        const titleBox = await page.getByText(title, { exact: true }).boundingBox()
        expect(titleBox).not.toBeNull()
        expect(boxes.every((box) => box && box.width >= 44 && box.height >= 44)).toBeTruthy()
        expect(boxes.slice(1).every((box) => box && box.y >= titleBox!.y + titleBox!.height)).toBeTruthy()
        for (let index = 0; index < boxes.length; index += 1) {
          for (let other = index + 1; other < boxes.length; other += 1) {
            const first = boxes[index]!
            const second = boxes[other]!
            expect(first.x + first.width <= second.x || second.x + second.width <= first.x || first.y + first.height <= second.y || second.y + second.height <= first.y).toBeTruthy()
          }
        }
      }
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/app/inbox')
    const row = page.getByText(title, { exact: true }).locator('xpath=../..')
    const checkbox = row.getByRole('checkbox', { name: `Select "${title}"` })
    const project = row.getByRole('combobox', { name: 'Assign project' })
    await checkbox.focus()
    await expect(checkbox).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(project).toBeFocused()
    await page.keyboard.press('Space')
    await expect(page.getByRole('option', { name: 'No project' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(project).toBeFocused()

    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await page.goto('/app/inbox')
    await expect(page.getByText(title, { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    await page.evaluate(() => document.documentElement.classList.remove('dark'))
  } finally {
    await deleteCurrentWorkItem(page.request, session.workspace.id, created.id)
  }
})
