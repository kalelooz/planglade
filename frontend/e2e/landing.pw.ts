import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const taskTitle = 'Send homepage draft to Mara'

function collectRuntimeFailures(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = []
  const failedRequests: string[] = []
  const workspaceRequests: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })
  page.on('requestfailed', (request) => failedRequests.push(request.url()))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/') || /firebase|firestore/i.test(url.hostname)) workspaceRequests.push(request.url())
  })

  return { consoleErrors, failedRequests, workspaceRequests }
}

test('desktop landing explains the product without loading the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  const failures = collectRuntimeFailures(page)

  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.getByRole('heading', { level: 1, name: 'Your work, without the work of managing it.' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Open PlanGlade/ }).first()).toHaveAttribute('href', '/auth/login?next=/app')
  await expect(page.getByRole('button', { name: 'Watch the 30-second tour' })).toBeVisible()

  const demo = page.locator('.landing-demo-card')
  const capture = demo.getByRole('textbox', { name: 'Quick capture' })
  await expect(capture).toHaveValue('Send homepage draft to Mara tomorrow #Client Refresh')
  await capture.fill('Send homepage draft to Mara tomorrow #Client Refresh')
  await demo.getByRole('button', { name: 'Capture' }).click()
  await expect(demo.getByText(taskTitle, { exact: true }).first()).toBeVisible()
  await expect(demo.getByText('Client Refresh', { exact: true }).first()).toBeVisible()
  await expect(demo.getByText('Tomorrow', { exact: true }).first()).toBeVisible()
  await expect(demo.getByText('Inbox', { exact: true }).first()).toBeVisible()

  for (const view of ['List', 'Board', 'Timeline', 'Calendar', 'Connections']) {
    await demo.getByRole('tab', { name: view }).click()
    await expect(demo.getByText(taskTitle, { exact: true }).first()).toBeVisible()
  }

  await capture.fill('Buy milk')
  const captureButton = demo.getByRole('button', { name: 'Capture' })
  await captureButton.click()

  await demo.getByRole('tab', { name: 'List' }).click()
  const listPreview = demo.getByLabel('List view preview')
  await expect(listPreview.getByText('Buy milk', { exact: true })).toBeVisible()
  await expect(listPreview.getByText('No project', { exact: true })).toBeVisible()
  await expect(listPreview.getByText('No date', { exact: true })).toBeVisible()

  await demo.getByRole('tab', { name: 'Board' }).click()
  const boardPreview = demo.getByLabel('Board view preview')
  await expect(boardPreview.getByText('Buy milk', { exact: true })).toBeVisible()
  await expect(boardPreview.getByText('No project', { exact: true })).toBeVisible()
  await expect(boardPreview.getByText('No date', { exact: true })).toBeVisible()

  await demo.getByRole('tab', { name: 'Timeline' }).click()
  const timelinePreview = demo.getByLabel('Timeline view preview')
  await expect(timelinePreview.getByText('Buy milk', { exact: true })).toBeVisible()
  await expect(timelinePreview.getByText('No date set — not placed on the timeline.')).toBeVisible()
  await expect(timelinePreview.getByText('Due tomorrow')).toHaveCount(0)

  await demo.getByRole('tab', { name: 'Calendar' }).click()
  const calendarPreview = demo.getByRole('table', { name: 'Calendar view preview' })
  await expect(calendarPreview.getByText('Buy milk', { exact: true })).toHaveCount(0)
  await expect(demo.getByText('No date set — not placed on the calendar.')).toBeVisible()

  await demo.getByRole('tab', { name: 'Connections' }).click()
  const connectionsPreview = demo.locator('figure[aria-labelledby="connections-preview-caption"]')
  await expect(connectionsPreview.getByText('No project or date connections yet.')).toBeVisible()
  await expect(connectionsPreview.getByText('Project', { exact: true })).toHaveCount(0)
  await expect(connectionsPreview.getByText('Due', { exact: true })).toHaveCount(0)

  await capture.fill('   ')
  await expect(captureButton).toBeDisabled()
  await capture.press('Enter')
  await expect(demo.locator('.landing-demo-structured')).toContainText('Buy milk')
  await expect(demo.getByText('No task text', { exact: true })).toHaveCount(0)

  await page.getByRole('button', { name: 'Is PlanGlade an AI product?' }).click()
  await expect(page.getByText('No. The current product focuses on direct, predictable planning tools.')).toBeVisible()

  await page.getByRole('button', { name: 'Watch the 30-second tour' }).click()
  const tour = page.getByRole('dialog', { name: 'A short tour of the living project ledger' })
  await expect(tour.getByText('The film is not included in this build.')).toBeVisible()
  await expect(tour.getByRole('heading', { name: 'Text tour and transcript' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(tour).toBeHidden()

  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(accessibility.violations.map((violation) => violation.id)).toEqual([])
  await page.setViewportSize({ width: 1440, height: 900 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  expect(failures.workspaceRequests).toEqual([])
  expect(failures.failedRequests).toEqual([])
  expect(failures.consoleErrors).toEqual([])
})

test('mobile navigation, reduced motion, and page width remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'dark' })
  const failures = collectRuntimeFailures(page)

  await page.goto('/', { waitUntil: 'networkidle' })
  const menu = page.getByRole('button', { name: 'Open navigation' })
  const menuBox = await menu.boundingBox()
  expect(menuBox?.width).toBeGreaterThanOrEqual(44)
  expect(menuBox?.height).toBeGreaterThanOrEqual(44)

  await menu.click()
  const sheet = page.getByRole('dialog', { name: 'PlanGlade' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('link', { name: 'FAQ' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(sheet).toBeHidden()
  await expect(menu).toBeFocused()

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  expect(await page.locator('.landing-demo-structured').evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
  const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
  expect(accessibility.violations.map((violation) => violation.id)).toEqual([])
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true)
  }
  expect(failures.workspaceRequests).toEqual([])
  expect(failures.failedRequests).toEqual([])
  expect(failures.consoleErrors).toEqual([])
})

test('non-marketing and unknown routes clear landing discovery metadata', async ({ page }) => {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  await expect(page).toHaveTitle('Sign in · PlanGlade')

  for (const path of ['/unknown', '/app/unknown']) {
    await page.goto(path, { waitUntil: 'domcontentloaded' })
    await expect(page).toHaveTitle('Page not found · PlanGlade')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(0)
    await expect(page.locator('meta[name="twitter:title"]')).toHaveCount(0)
  }

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow')
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', 'PlanGlade — Calm personal project planning')
})
