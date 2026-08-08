import { expect, test } from '@playwright/test'

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
