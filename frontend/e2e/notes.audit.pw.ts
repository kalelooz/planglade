/// <reference lib="dom" />

import { expect, test } from '@playwright/test'
import { deleteCurrentNote } from './collaborative-cleanup'

type Session = { workspace: { id: string } }
type Note = { id: string }

test('audits Notes responsive, semantic, motion, and focus behavior', async ({ page }) => {
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<Session>)
  const response = await page.request.post('/api/notes', {
    data: {
      workspaceId: session.workspace.id,
      title: `Responsive audit ${'long-title-'.repeat(12)}${Date.now()}`.slice(0, 170),
      body: `${'Long paragraph content. '.repeat(20)} https://example.test/${'token'.repeat(30)}\n\n- Markdown item\n- Another item`,
    },
  })
  expect(response.status()).toBe(201)
  const note = (await response.json() as { note: Note }).note
  let deleted = false

  try {
    for (const [width, height] of [[1440, 900], [1024, 768], [768, 1024], [390, 844], [320, 844]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(`/app/notes?note=${note.id}`)
      await expect(page.getByLabel('Note title')).toBeVisible()
      const audit = await page.evaluate(() => ({
        viewport: [window.innerWidth, window.innerHeight],
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        headingCount: document.querySelectorAll('h1').length,
        titleWidth: document.querySelector<HTMLInputElement>('input[aria-label="Note title"]')?.getBoundingClientRect().width ?? 0,
        contentHeight: document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Note content (Markdown)"]')?.getBoundingClientRect().height ?? 0,
        touchTargets: ['Back to notes', 'Convert selection to task', 'Delete note', 'Linked project'].map((label) => {
          const element = Array.from(document.querySelectorAll<HTMLElement>('[aria-label]')).find((candidate) => candidate.getAttribute('aria-label') === label)
          const rect = element?.getBoundingClientRect()
          return { label, width: rect?.width ?? 0, height: rect?.height ?? 0 }
        }),
        namedButtons: Array.from(document.querySelectorAll('button')).map((button) => button.getAttribute('aria-label') || button.textContent?.trim()).filter(Boolean),
      }))
      console.log(JSON.stringify({ width, height, ...audit }))
      expect(audit.scrollWidth).toBeLessThanOrEqual(width)
      expect(audit.bodyScrollWidth).toBeLessThanOrEqual(width)
      expect(audit.headingCount).toBe(1)
      expect(audit.titleWidth).toBeGreaterThan(0)
      expect(audit.contentHeight).toBeGreaterThan(240)
      expect(audit.namedButtons).toContain('Delete note')
      expect(audit.namedButtons).toContain('Back to notes')
      if (width <= 390) {
        expect(audit.touchTargets.every(({ width: targetWidth, height: targetHeight }) => targetWidth >= 44 && targetHeight >= 44)).toBe(true)
      }
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`/app/notes?note=${note.id}`)
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await expect(page.locator('html')).toHaveClass(/dark/)
    await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390)

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`/app/notes?note=${note.id}`)
    await page.getByRole('button', { name: 'Delete note' }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Delete note' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).press('Enter')
    deleted = true
    await expect(page.getByRole('heading', { name: 'Notes' })).toBeFocused()
  } finally {
    if (!deleted) {
      await deleteCurrentNote(page.request, session.workspace.id, note.id)
    }
    const remaining = await page.request.get(`/api/notes?workspaceId=${encodeURIComponent(session.workspace.id)}`).then((response) => response.json() as Promise<{ notes: Array<{ id: string; title: string }> }>)
    for (const candidate of remaining.notes.filter(({ title }) => title.startsWith('Responsive audit '))) {
      await deleteCurrentNote(page.request, session.workspace.id, candidate.id)
    }
  }
})
