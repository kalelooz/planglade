import { expect, test, type Locator } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.width).toBeGreaterThanOrEqual(44)
  expect(box!.height).toBeGreaterThanOrEqual(44)
}

async function visibleBox(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  return box!
}

async function expectTaskGridCentered(row: Locator, fields: string[]) {
  const rowBox = await visibleBox(row)
  const boxes = await Promise.all(fields.map((field) => visibleBox(row.locator(`[data-task-field="${field}"]`))))

  for (let index = 1; index < boxes.length; index += 1) {
    expect(boxes[index].x - (boxes[index - 1].x + boxes[index - 1].width)).toBeGreaterThanOrEqual(0)
  }

  const first = boxes[0]
  const last = boxes.at(-1)!
  expect(Math.abs((first.x - rowBox.x) - (rowBox.x + rowBox.width - last.x - last.width))).toBeLessThanOrEqual(2)
}

async function expectInsideRow(row: Locator, target: Locator) {
  const rowBox = await visibleBox(row)
  const targetBox = await visibleBox(target)
  expect(targetBox.x).toBeGreaterThanOrEqual(rowBox.x)
  expect(targetBox.x + targetBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width)
}

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

test('desktop task rows render metadata once', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/tasks')
  await page.getByRole('tab', { name: 'List' }).click()
  await page.getByRole('textbox', { name: 'Search tasks' }).fill("Renew driver's license")
  await expect(page.locator('[data-task-id]')).toHaveCount(1)

  const row = page.getByText("Renew driver's license", { exact: true }).locator('xpath=ancestor::*[@data-task-id][1]')
  await expect(row).toBeVisible()
  await expect(row.getByText('Planned', { exact: true }).filter({ visible: true })).toHaveCount(1)
  await expect(row.locator('svg.lucide-calendar-days').filter({ visible: true })).toHaveCount(1)
  await expect(row.getByText('Medium priority', { exact: true }).filter({ visible: true })).toHaveCount(1)

  const identityCell = await visibleBox(row.locator('[data-task-field="identity"]'))
  const titleText = await visibleBox(row.locator('[data-task-field="title"]'))
  const statusCell = await visibleBox(row.locator('[data-task-field="status"]'))
  const dueCell = await visibleBox(row.locator('[data-task-field="due-date"]'))
  const priorityCell = await visibleBox(row.locator('[data-task-field="priority"]'))
  const desktopCells = [identityCell, statusCell, dueCell, priorityCell]

  expect(identityCell.width).toBeLessThanOrEqual(320)
  expect(statusCell.x - (titleText.x + titleText.width)).toBeLessThanOrEqual(240)
  for (let index = 1; index < desktopCells.length; index += 1) {
    const previous = desktopCells[index - 1]
    const current = desktopCells[index]
    expect(current.x - (previous.x + previous.width)).toBeGreaterThanOrEqual(0)
    expect(current.x - (previous.x + previous.width)).toBeLessThanOrEqual(24)
  }
  expect(priorityCell.x + priorityCell.width - identityCell.x).toBeLessThanOrEqual(700)

  const listRegion = await visibleBox(page.locator('[data-task-list-region]'))
  const listSurface = await visibleBox(page.locator('[data-task-list-surface]'))
  expect(listSurface.width).toBeLessThanOrEqual(960)
  expect(Math.abs((listSurface.x - listRegion.x) - (listRegion.x + listRegion.width - listSurface.x - listSurface.width))).toBeLessThanOrEqual(1)
  await expectTaskGridCentered(row, ['completion', 'identity', 'status', 'due-date', 'priority'])

  await page.mouse.click(statusCell.x + statusCell.width / 2, statusCell.y + statusCell.height / 2)
  await expect(page.getByLabel('Task details')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByLabel('Task details')).toBeHidden()

  await page.getByRole('button', { name: 'Display options' }).click()
  for (const [label, field, remaining] of [
    ['Status', 'status', ['completion', 'identity', 'due-date', 'priority']],
    ['Due date', 'due-date', ['completion', 'identity', 'priority']],
    ['Priority', 'priority', ['completion', 'identity']],
  ] as const) {
    await page.getByRole('checkbox', { name: label }).click()
    await expect(row.locator(`[data-task-field="${field}"]`)).toHaveCount(0)
    await expectTaskGridCentered(row, [...remaining])
  }
  for (const [label, field] of [['Status', 'status'], ['Due date', 'due-date'], ['Priority', 'priority']] as const) {
    await page.getByRole('checkbox', { name: label }).click()
    await expect(row.locator(`[data-task-field="${field}"]`)).toHaveCount(1)
  }
  await page.keyboard.press('Escape')

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload()
  await expect(row).toBeVisible()
  await expect(row.getByText('Planned', { exact: true }).filter({ visible: true })).toHaveCount(1)
  await expect(row.locator('svg.lucide-calendar-days').filter({ visible: true })).toHaveCount(1)
  await expect(row.getByText('Medium priority', { exact: true }).filter({ visible: true })).toHaveCount(1)
  await expectInsideRow(row, row.getByText('Planned', { exact: true }).filter({ visible: true }))
  await expectInsideRow(row, row.locator('svg.lucide-calendar-days').filter({ visible: true }))
  await expectInsideRow(row, row.locator('svg[aria-label="Medium priority"]').filter({ visible: true }))

  for (const target of [
    page.getByRole('button', { name: 'New task' }),
    page.getByRole('tab', { name: 'List' }),
    page.getByRole('tab', { name: 'Board' }),
    page.getByRole('tab', { name: 'Timeline' }),
    page.getByRole('textbox', { name: 'Search tasks' }),
    page.getByRole('button', { name: 'Filters' }),
    page.getByRole('combobox', { name: 'Sort tasks' }),
    page.getByRole('combobox', { name: 'Group tasks' }),
    page.getByRole('button', { name: 'Display options' }),
    page.getByRole('switch', { name: 'Show completed tasks' }),
    row.getByRole('checkbox', { name: 'Mark as done' }),
    row.getByRole('button', { name: 'Personal Admin' }),
  ]) {
    await expectTouchTarget(target)
  }
})
