import { expect, test } from '@playwright/test'

async function expectTarget(locator: ReturnType<import('@playwright/test').Page['getByRole']>) {
  await expect.poll(async () => {
    const box = await locator.boundingBox()
    return Math.min(box?.width ?? 0, box?.height ?? 0)
  }).toBeGreaterThanOrEqual(44)
}

test('Tasks keeps narrow controls reachable without document overflow', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  })

  for (const width of [1280, 1024, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/tasks')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()

    if (width <= 768) {
      await expectTarget(page.getByRole('tab', { name: 'List' }))
      await expectTarget(page.getByRole('tab', { name: 'Board' }))
      await expectTarget(page.getByRole('button', { name: 'New task' }))
      await expectTarget(page.getByLabel('Search tasks'))
      await expectTarget(page.getByRole('button', { name: 'Filters' }))
      await expectTarget(page.getByRole('switch', { name: 'Show completed tasks' }))
      await expectTarget(page.getByRole('checkbox', { name: 'Mark as done' }).first())
    }

    await page.getByRole('tab', { name: 'Board' }).click()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()

    if (width <= 768) {
      await expectTarget(page.getByRole('button', { name: /Add task to/ }).first())
      await expectTarget(page.getByRole('button', { name: /Task card:/ }).first())
      await expectTarget(page.getByRole('combobox', { name: /Move .* to status/ }).first())
    }
  }

  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/tasks')
  const task = page.getByRole('button', { name: /Task:/ }).first()
  await task.press('Enter')
  await expectTarget(page.getByRole('button', { name: 'Close' }))
  await expectTarget(page.getByRole('checkbox', { name: 'Mark as done' }).last())
  await expectTarget(page.getByRole('combobox', { name: 'Project' }))
  await expectTarget(page.getByRole('combobox', { name: 'Status' }))
  await expectTarget(page.getByRole('combobox', { name: 'Priority' }))
  await expectTarget(page.getByRole('button', { name: 'Due date', exact: true }))
  await expectTarget(page.getByLabel('Add a subtask'))
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(task).toBeFocused()

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 320, height: 844 })
  await page.goto('/tasks')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  expect(consoleErrors).toEqual([])
})
