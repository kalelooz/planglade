import { expect, test, type Locator } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(44)
  expect(box!.height).toBeGreaterThanOrEqual(44)
}

test('plans and support stay discoverable on desktop and mobile', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/app/plans', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Keep your work calm as it grows.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Plans', exact: true })).toHaveAttribute('aria-current', 'page')
  await expect(page.getByText('Your current edition: Free')).toBeVisible()
  await expect(page.getByText('Solo', { exact: true })).toBeVisible()
  await expect(page.getByText('Teams', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Help and support' }).click()
  const support = page.getByRole('dialog', { name: 'Help & support' })
  await expect(support.getByText('Help & support', { exact: true })).toBeVisible()
  await expect(support.getByRole('link', { name: /Email support/ })).toHaveAttribute('href', /mailto:support@planglade\.com/)
  await expect(support.getByText('Never include passwords')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('Control+K')
  await page.getByRole('option', { name: 'Help & support' }).click()
  await expect(page.getByRole('dialog', { name: 'Help & support' })).toBeVisible()
  await page.keyboard.press('Escape')

  const desktopAxe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(desktopAxe.violations.map((violation) => violation.id)).toEqual([])
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/plans', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  const navigation = page.getByRole('dialog', { name: 'Navigation' })
  const mobilePlans = navigation.getByRole('link', { name: 'Plans', exact: true })
  const mobileSupport = navigation.getByRole('button', { name: 'Help and support' })
  await expectTouchTarget(mobilePlans)
  await expectTouchTarget(mobileSupport)
  await mobileSupport.click()
  await expect(page.getByRole('dialog', { name: 'Help & support' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.goto('/app', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('Enjoying PlanGlade?', { exact: true })).toHaveCount(0)
  expect(consoleErrors).toEqual([])
})
