import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('reference mode stays independent from the backend', async ({ page }) => {
  const backendRequests: string[] = []
  const consoleErrors: string[] = []
  page.on('request', (request) => {
    if (new URL(request.url()).port === '3000') backendRequests.push(request.url())
  })
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('PlanGlade Public Alpha', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Draft alpha announcement post', { exact: true })).toBeVisible()
  const capture = page.getByLabel('Quick capture to inbox')
  await capture.fill('Reference harness capture')
  await capture.press('Enter')
  await expect(capture).toHaveValue('')
  await page.goto('/inbox')
  await expect(page.getByText('Reference harness capture', { exact: true })).toBeVisible()
  expect(backendRequests).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('primary product surfaces pass axe and Settings radios support native keyboard navigation', async ({ page }) => {
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  const missingLabelTargets = await page.locator('[aria-labelledby]').evaluateAll((elements) => elements.flatMap((element) =>
    (element.getAttribute('aria-labelledby') ?? '')
      .split(/\s+/)
      .filter((id) => id && !document.getElementById(id)),
  ))
  expect(missingLabelTargets).toEqual([])

  const themeRadios = page.getByRole('group', { name: 'Theme' }).getByRole('radio')
  const checkedIndex = await themeRadios.evaluateAll((radios) => radios.findIndex((radio) => (radio as HTMLInputElement).checked))
  expect(checkedIndex).toBeGreaterThanOrEqual(0)
  const checkedRadio = themeRadios.nth(checkedIndex)
  const nextRadio = themeRadios.nth((checkedIndex + 1) % await themeRadios.count())
  await checkedRadio.focus()
  await checkedRadio.press('ArrowRight')
  await expect(nextRadio).toBeChecked()
  await expect(nextRadio).toBeFocused()
  await nextRadio.press('ArrowLeft')
  await expect(checkedRadio).toBeChecked()

  for (const [path, heading] of [['/settings', 'Settings'], ['/tasks', 'Tasks'], ['/connections', 'Connections']] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    expect(results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      targets: violation.nodes.flatMap((node) => node.target),
    }))).toEqual([])
  }
})
