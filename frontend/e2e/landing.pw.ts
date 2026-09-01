import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

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

  const homePreview = page.getByLabel('PlanGlade Home workspace preview')
  await expect(homePreview.getByText('Northstar Studio')).toBeVisible()
  await expect(homePreview.getByText('Quick capture')).toBeVisible()
  await expect(homePreview.getByText('Capture something - organize it later')).toBeVisible()
  await expect(homePreview.getByText('What needs your attention')).toBeVisible()
  await expect(homePreview.getByText('Coming up this week')).toBeVisible()
  await expect(homePreview.getByText('Mo Hamed')).toBeVisible()
  await expect(homePreview.locator('[data-sidebar-account-card]')).toBeVisible()
  await expect(homePreview.locator('[data-sidebar-utilities]')).toBeVisible()

  const inboxPreview = page.getByLabel('PlanGlade Inbox preview')
  await expect(inboxPreview.getByText('2 items to organize')).toBeVisible()
  await expect(inboxPreview.getByText('Send homepage draft to Mara')).toBeVisible()

  const tasksPreview = page.getByLabel('PlanGlade Tasks preview')
  await expect(tasksPreview.getByText('Plan, review, and present work from one place.')).toBeVisible()
  await expect(tasksPreview.getByText('List', { exact: true })).toBeVisible()
  await expect(tasksPreview.getByText('Board', { exact: true })).toBeVisible()
  await expect(tasksPreview.getByText('Timeline', { exact: true })).toBeVisible()
  await expect(tasksPreview.getByText('Show completed')).toBeVisible()
  await expect(page.getByLabel('PlanGlade daily Home preview')).toBeVisible()

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
  expect(await page.locator('.landing-app-preview').first().evaluate((element) => getComputedStyle(element).animationName)).toBe('none')
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
