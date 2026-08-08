import { expect, test } from '@playwright/test'

type Note = { id: string }

test('creates, persists, and deletes an authenticated note', async ({ page }) => {
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<{ workspace: { id: string } }>)
  const title = `Notes browser ${Date.now()}`
  const body = 'Persisted **Markdown** body\n\n[safe](https://example.test)\n\n[unsafe](javascript:alert(1))\n\n<script>globalThis.notesPwned = true</script>'
  let created: Note | undefined

  try {
    await page.goto('/notes')
    const create = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/notes')
    await page.getByLabel('New note', { exact: true }).click()
    const createResponse = await create
    expect(createResponse.status()).toBe(201)
    created = (await createResponse.json() as { note: Note }).note

    await page.getByLabel('Note title').fill(title)
    await page.getByLabel('Note content (Markdown)').fill(body)
    const save = page.waitForResponse((response) => response.request().method() === 'PATCH' && new URL(response.url()).pathname.endsWith(`/${created!.id}`))
    await page.getByLabel('Note content (Markdown)').blur()
    expect((await save).status()).toBe(200)

    await page.reload()
    await expect(page.getByLabel('Note title')).toHaveValue(title)
    await expect(page.getByLabel('Note content (Markdown)')).toHaveValue(body)
    await page.getByRole('tab', { name: 'Read' }).click()
    const preview = page.locator('.md-preview')
    await expect(preview.locator('strong')).toHaveText('Markdown')
    await expect(preview.getByRole('link', { name: 'safe' })).toHaveAttribute('href', 'https://example.test')
    await expect(preview.locator('a', { hasText: 'unsafe' })).toHaveCount(0)
    await expect(preview.locator('script')).toHaveCount(0)
    await expect(preview).toContainText('<script>globalThis.notesPwned = true</script>')
    await expect(page.evaluate(() => 'notesPwned' in globalThis)).resolves.toBe(false)

    const remove = page.waitForResponse((response) => response.request().method() === 'DELETE' && new URL(response.url()).pathname.endsWith(`/${created!.id}`))
    await page.getByRole('button', { name: 'Delete note' }).click()
    await page.getByRole('button', { name: 'Delete', exact: true }).click()
    expect((await remove).status()).toBe(200)
    created = undefined
    await expect(page.getByLabel('Note title')).toHaveCount(0)
  } finally {
    if (created) {
      const response = await page.request.delete(`/api/notes/${encodeURIComponent(created.id)}?workspaceId=${encodeURIComponent(session.workspace.id)}`)
      expect(response.ok()).toBeTruthy()
    }
  }
})

test('keeps a note draft when the authenticated save is temporarily unavailable', async ({ page }) => {
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<{ workspace: { id: string } }>)
  const response = await page.request.post('/api/notes', { data: { workspaceId: session.workspace.id, title: `Notes failed save ${Date.now()}`, body: 'Confirmed body' } })
  expect(response.status()).toBe(201)
  const created = (await response.json() as { note: Note }).note

  try {
    await page.route(`**/api/notes/${created.id}**`, async (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Unavailable' }) }))
    await page.goto(`/notes?note=${created.id}`)
    const input = page.getByLabel('Note content (Markdown)')
    await input.fill('Keep this local draft')
    await input.blur()
    await expect(input).toHaveValue('Keep this local draft')
    await expect(page.getByText('Could not save. Your edits are still here.')).toBeVisible()
  } finally {
    await page.unrouteAll({ behavior: 'ignoreErrors' })
    const cleanup = await page.request.delete(`/api/notes/${encodeURIComponent(created.id)}?workspaceId=${encodeURIComponent(session.workspace.id)}`)
    expect(cleanup.ok()).toBeTruthy()
  }
})
