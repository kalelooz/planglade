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

async function expectAbove(parent: Locator, overlay: Locator) {
  const [parentZ, overlayZ] = await Promise.all([
    parent.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || '0', 10)),
    overlay.evaluate((element) => Number.parseInt(getComputedStyle(element).zIndex || '0', 10)),
  ])
  expect(overlayZ).toBeGreaterThan(parentZ)
}

async function renderedColors(locator: Locator, surfaceSelector?: string) {
  return locator.evaluate((element, selector) => {
    const parseColor = (value: string) => {
      const channels = value.match(/[\d.]+/g)?.map(Number) ?? []
      return {
        red: channels[0] ?? 0,
        green: channels[1] ?? 0,
        blue: channels[2] ?? 0,
        alpha: channels[3] ?? 1,
      }
    }
    const composite = (foreground: ReturnType<typeof parseColor>, background: ReturnType<typeof parseColor>) => {
      const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha)
      if (alpha === 0) return { red: 0, green: 0, blue: 0, alpha: 0 }
      return {
        red: (foreground.red * foreground.alpha + background.red * background.alpha * (1 - foreground.alpha)) / alpha,
        green: (foreground.green * foreground.alpha + background.green * background.alpha * (1 - foreground.alpha)) / alpha,
        blue: (foreground.blue * foreground.alpha + background.blue * background.alpha * (1 - foreground.alpha)) / alpha,
        alpha,
      }
    }
    const resolvedBackground = (node: Element | null) => {
      const layers: ReturnType<typeof parseColor>[] = []
      for (let current = node; current; current = current.parentElement) {
        layers.push(parseColor(getComputedStyle(current).backgroundColor))
      }
      return layers.reverse().reduce((background, foreground) => composite(foreground, background), { red: 0, green: 0, blue: 0, alpha: 0 })
    }
    const luminance = (color: ReturnType<typeof parseColor>) => {
      const channels = [color.red, color.green, color.blue].map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    }
    const target = selector ? element.querySelector(selector) : element
    if (!target) throw new Error(`Missing rendered surface: ${selector}`)
    const targetStyle = getComputedStyle(target)
    const parentBackground = resolvedBackground(target.parentElement)
    const surface = composite(parseColor(targetStyle.backgroundColor), parentBackground)
    const text = parseColor(targetStyle.color)

    return {
      backgroundColor: targetStyle.backgroundColor,
      contrast: (Math.max(luminance(text), luminance(surface)) + 0.05) / (Math.min(luminance(text), luminance(surface)) + 0.05),
      surfaceDelta: Math.abs(luminance(surface) - luminance(parentBackground)),
    }
  }, surfaceSelector)
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

  await page.goto('/app', { waitUntil: 'domcontentloaded' })
  await expect(page.getByText('PlanGlade Public Alpha', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Draft alpha announcement post', { exact: true })).toBeVisible()
  const capture = page.getByLabel('Quick capture to inbox')
  await capture.fill('Reference harness capture')
  await capture.press('Enter')
  await expect(capture).toHaveValue('')
  await page.goto('/app/inbox')
  await expect(page.getByText('Reference harness capture', { exact: true })).toBeVisible()
  expect(backendRequests).toEqual([])
  expect(consoleErrors).toEqual([])
})

test('Quick Capture examples fill the input and saving closes the dialog', async ({ page }) => {
  await page.goto('/app/tasks')
  await page.getByRole('button', { name: 'Quick capture' }).click()

  const dialog = page.getByRole('dialog', { name: 'Capture something' })
  const input = dialog.getByRole('textbox', { name: 'Capture text' })
  await dialog.getByRole('button', { name: 'Send homepage draft tomorrow' }).click()

  await expect(input).toHaveValue('Send homepage draft tomorrow')
  await expect(dialog.getByText('Ready for Inbox')).toBeVisible()
  await dialog.getByRole('button', { name: 'Save to Inbox' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('link', { name: /Inbox/ }).click()
  await expect(page.getByText('Send homepage draft', { exact: true }).first()).toBeVisible()
})

test('project schedule, appearance, status, and advanced fields remain interactive and durable', async ({ page }) => {
  const projectName = `Control audit ${Date.now()}`
  const slug = `control-audit-${Date.now()}`
  await page.goto('/app/projects')
  await page.getByRole('button', { name: 'New project' }).click()
  const dialog = page.getByRole('dialog', { name: 'New project' })
  await dialog.getByLabel('Name').fill(projectName)
  await dialog.getByLabel('Project URL slug').fill(slug)

  const color = dialog.getByRole('button', { name: 'Project color' })
  await color.click()
  const colorPopover = page.locator('[data-slot="popover-content"]').filter({ visible: true })
  await expectAbove(dialog, colorPopover)
  await colorPopover.getByRole('button', { name: 'Blue', exact: true }).click()
  await expect(color).toContainText('Blue')
  await expect(colorPopover).toBeHidden()

  const icon = dialog.getByRole('button', { name: 'Project icon' })
  await icon.click()
  const iconPopover = page.locator('[data-slot="popover-content"]').filter({ visible: true })
  await expectAbove(dialog, iconPopover)
  await iconPopover.getByRole('button', { name: 'Launch', exact: true }).click()
  await expect(icon).toContainText('Launch')
  await expect(iconPopover).toBeHidden()

  const startDate = dialog.getByRole('button', { name: 'Start date' })
  await startDate.click()
  const startCalendar = page.locator('[data-slot="popover-content"]').filter({ visible: true })
  await expectAbove(dialog, startCalendar)
  await startCalendar.locator('button[data-day]').filter({ visible: true }).nth(10).click()
  await expect(startDate).not.toContainText('Set date')

  const targetDate = dialog.getByRole('button', { name: 'Target date' })
  await targetDate.click()
  const targetCalendar = page.locator('[data-slot="popover-content"]').filter({ visible: true })
  await targetCalendar.locator('[role="gridcell"]:not([data-outside]) button[data-day]:not([disabled])').last().click()
  await expect(targetDate).not.toContainText('Set date')

  await dialog.getByRole('combobox', { name: 'Project status' }).click()
  const statusMenu = page.locator('[data-slot="select-content"]').filter({ visible: true })
  await expectAbove(dialog, statusMenu)
  await statusMenu.getByRole('option', { name: 'On hold', exact: true }).click()
  await dialog.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByRole('heading', { name: projectName })).toBeVisible()

  await page.getByRole('button', { name: 'Edit project' }).click()
  const editor = page.getByRole('dialog', { name: 'Edit project' })
  await expect(editor.getByRole('button', { name: 'Project color' })).toContainText('Blue')
  await expect(editor.getByRole('button', { name: 'Project icon' })).toContainText('Launch')
  await expect(editor.getByRole('button', { name: 'Start date' })).not.toContainText('Set date')
  await expect(editor.getByRole('button', { name: 'Target date' })).not.toContainText('Set date')
  await expect(editor.getByRole('combobox', { name: 'Project status' })).toContainText('On hold')
  await editor.locator('summary').click()
  await expect(editor.getByLabel('Project URL slug')).toHaveValue(slug)

  await editor.getByRole('button', { name: 'Project color' }).click()
  await page.locator('[data-slot="popover-content"]').filter({ visible: true }).getByRole('button', { name: 'Rose', exact: true }).click()
  await editor.getByRole('button', { name: 'Project icon' }).click()
  await page.locator('[data-slot="popover-content"]').filter({ visible: true }).getByRole('button', { name: 'Goal', exact: true }).click()
  await editor.getByRole('combobox', { name: 'Project status' }).click()
  await page.getByRole('option', { name: 'In review', exact: true }).click()
  await editor.getByLabel('Project URL slug').fill(`${slug}-edited`)
  await editor.getByRole('button', { name: 'Save changes' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Edit project' }).click()
  const persisted = page.getByRole('dialog', { name: 'Edit project' })
  await expect(persisted.getByRole('button', { name: 'Project color' })).toContainText('Rose')
  await expect(persisted.getByRole('button', { name: 'Project icon' })).toContainText('Goal')
  await expect(persisted.getByRole('combobox', { name: 'Project status' })).toContainText('In review')
  await persisted.locator('summary').click()
  await expect(persisted.getByLabel('Project URL slug')).toHaveValue(`${slug}-edited`)
})

test('Task and Note controls remain interactive above their sheets and dialogs', async ({ page }) => {
  await page.goto('/app/tasks')
  await page.getByRole('textbox', { name: 'Search tasks' }).fill("Renew driver's license")
  await page.getByRole('button', { name: "Task: Renew driver's license" }).click()
  const drawer = page.getByLabel('Task details')
  const sheet = page.locator('[data-slot="sheet-content"]')

  await drawer.getByRole('combobox', { name: 'Status' }).click()
  let selectMenu = page.locator('[data-slot="select-content"]').filter({ visible: true })
  await expectAbove(sheet, selectMenu)
  await selectMenu.getByRole('option', { name: 'In Review', exact: true }).click()
  await expect(drawer.getByRole('combobox', { name: 'Status' })).toContainText('In Review')

  await drawer.getByRole('combobox', { name: 'Priority' }).click()
  selectMenu = page.locator('[data-slot="select-content"]').filter({ visible: true })
  await selectMenu.getByRole('option', { name: 'High', exact: true }).click()
  await expect(drawer.getByRole('combobox', { name: 'Priority' })).toContainText('High')

  await drawer.getByRole('combobox', { name: 'Project' }).click()
  selectMenu = page.locator('[data-slot="select-content"]').filter({ visible: true })
  await selectMenu.getByRole('option', { name: 'Research Notes', exact: true }).click()
  await expect(drawer.getByRole('combobox', { name: 'Project' })).toContainText('Research Notes')

  await drawer.getByRole('button', { name: 'Due date', exact: true }).click()
  const taskCalendar = page.locator('[data-slot="popover-content"]').filter({ visible: true })
  await expectAbove(sheet, taskCalendar)
  await taskCalendar.locator('button[data-day]').filter({ visible: true }).last().click()
  await expect(drawer.getByRole('button', { name: 'Due date', exact: true })).not.toContainText('Set a date')
  await drawer.getByRole('button', { name: 'Close' }).click()

  await page.reload()
  await page.getByRole('textbox', { name: 'Search tasks' }).fill("Renew driver's license")
  await page.getByRole('button', { name: "Task: Renew driver's license" }).click()
  const persistedTask = page.getByLabel('Task details')
  await expect(persistedTask.getByRole('combobox', { name: 'Status' })).toContainText('In Review')
  await expect(persistedTask.getByRole('combobox', { name: 'Priority' })).toContainText('High')
  await expect(persistedTask.getByRole('combobox', { name: 'Project' })).toContainText('Research Notes')
  await persistedTask.getByRole('button', { name: 'Close' }).click()

  await page.goto('/app/notes')
  await page.getByRole('button', { name: /Attention residue — reading notes/ }).click()
  const noteContent = page.getByRole('textbox', { name: 'Note content (Markdown)' })
  await noteContent.fill('Control audit note')
  await noteContent.press('Control+A')
  await page.getByRole('button', { name: 'Bold' }).click()
  await expect(noteContent).toHaveValue('**Control audit note**')
  await noteContent.blur()

  await page.getByRole('combobox', { name: 'Linked project' }).click()
  await page.getByRole('option', { name: 'Personal Admin', exact: true }).click()
  await expect(page.getByRole('combobox', { name: 'Linked project' })).toContainText('Personal Admin')

  await noteContent.focus()
  await noteContent.press('Control+A')
  await page.getByRole('button', { name: 'Convert selection to task' }).click()
  const convertDialog = page.getByRole('dialog', { name: 'Convert to task' })
  await convertDialog.getByRole('combobox', { name: 'Project' }).click()
  selectMenu = page.locator('[data-slot="select-content"]').filter({ visible: true })
  await expectAbove(convertDialog, selectMenu)
  await selectMenu.getByRole('option', { name: 'Personal Admin', exact: true }).click()
  await convertDialog.getByRole('button', { name: 'No date' }).click()
  const noteCalendar = page.locator('[data-slot="popover-content"]').filter({ visible: true })
  await expectAbove(convertDialog, noteCalendar)
  await noteCalendar.locator('button[data-day]').filter({ visible: true }).last().click()
  await convertDialog.getByRole('combobox', { name: 'Priority' }).click()
  await page.getByRole('option', { name: 'High', exact: true }).click()
  await convertDialog.getByRole('button', { name: 'Cancel' }).click()

  await page.reload()
  await page.getByRole('button', { name: /Attention residue — reading notes/ }).click()
  await expect(page.getByRole('textbox', { name: 'Note content (Markdown)' })).toHaveValue('**Control audit note**')
  await expect(page.getByRole('combobox', { name: 'Linked project' })).toContainText('Personal Admin')
})

test('primary product surfaces pass axe and Settings radios support native keyboard navigation', async ({ page }) => {
  await page.goto('/app/settings')
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

  for (const [path, heading] of [['/app/settings', 'Settings'], ['/app/tasks', 'Tasks'], ['/app/connections', 'Connections']] as const) {
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
  await page.goto('/app/tasks')
  await page.getByRole('tab', { name: 'List' }).click()
  await expect(page.getByText('Show completed', { exact: true })).toBeVisible()
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

  expect(identityCell.width).toBeLessThanOrEqual(448)
  expect(statusCell.x - (titleText.x + titleText.width)).toBeLessThanOrEqual(368)
  for (let index = 1; index < desktopCells.length; index += 1) {
    const previous = desktopCells[index - 1]
    const current = desktopCells[index]
    expect(current.x - (previous.x + previous.width)).toBeGreaterThanOrEqual(0)
    expect(current.x - (previous.x + previous.width)).toBeLessThanOrEqual(24)
  }
  expect(priorityCell.x + priorityCell.width - identityCell.x).toBeLessThanOrEqual(840)

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

test('selected Calendar agenda tasks keep readable text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/app/calendar')

  const agenda = page.getByRole('heading', { name: 'Agenda' }).locator('..')
  const taskButton = agenda.locator('button').first()
  await expect(taskButton).toBeVisible()
  const taskButtonHandle = await taskButton.elementHandle()
  expect(taskButtonHandle).not.toBeNull()
  await taskButton.click()
  await expect(page.getByLabel('Task details')).toBeVisible()

  const selectedState = await taskButtonHandle!.evaluate((button) => ({
    className: button.className,
    current: button.getAttribute('aria-current'),
  }))
  expect(selectedState.current).toBe('true')
  expect(selectedState.className).toContain('bg-accent')
  expect(selectedState.className).not.toContain('bg-foreground')

  const contrast = await taskButtonHandle!.evaluate((button) => {
    const parse = (value: string) => value.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [0, 0, 0]
    const luminance = (rgb: number[]) => {
      const channels = rgb.map((channel) => {
        const value = channel / 255
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
    }
    const foreground = luminance(parse(getComputedStyle(button).color))
    const background = luminance(parse(getComputedStyle(button).backgroundColor))
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)
  })

  expect(contrast).toBeGreaterThanOrEqual(4.5)
})

test('task controls and Home cards stay calm and readable in both themes', async ({ page }) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.emulateMedia({ colorScheme })
    await page.goto('/app/tasks')

    const activeView = page.getByRole('tab', { name: 'Board' })
    await activeView.click()
    await expect(activeView).toHaveAttribute('data-state', 'active')
    const activeViewColors = await renderedColors(activeView)
    expect(activeViewColors.contrast).toBeGreaterThanOrEqual(4.5)
    expect(activeViewColors.surfaceDelta).toBeLessThanOrEqual(0.22)

    const completedSwitch = page.getByRole('switch', { name: 'Show completed tasks' })
    if (await completedSwitch.getAttribute('aria-checked') === 'true') await completedSwitch.click()
    await expect(completedSwitch).toHaveAttribute('aria-checked', 'false')
    const uncheckedSwitchColors = await renderedColors(completedSwitch, '[data-slot="switch-track"]')
    const switchBox = await visibleBox(completedSwitch)
    let thumbBox = await visibleBox(completedSwitch.locator('[data-slot="switch-thumb"]'))
    expect(thumbBox.x).toBeGreaterThanOrEqual(switchBox.x)
    expect(thumbBox.x + thumbBox.width).toBeLessThanOrEqual(switchBox.x + switchBox.width)

    await completedSwitch.click()
    await expect(completedSwitch).toHaveAttribute('aria-checked', 'true')
    const switchColors = await renderedColors(completedSwitch, '[data-slot="switch-track"]')
    expect(switchColors.surfaceDelta).toBeGreaterThanOrEqual(0.03)
    expect(switchColors.surfaceDelta).toBeLessThanOrEqual(0.6)
    expect(switchColors.backgroundColor).not.toBe(uncheckedSwitchColors.backgroundColor)
    thumbBox = await visibleBox(completedSwitch.locator('[data-slot="switch-thumb"]'))
    expect(thumbBox.x).toBeGreaterThanOrEqual(switchBox.x)
    expect(thumbBox.x + thumbBox.width).toBeLessThanOrEqual(switchBox.x + switchBox.width)

    await page.goto('/app')
    const capture = page.getByRole('textbox', { name: 'Quick capture to inbox' })
    await expect(capture).toHaveCSS('border-radius', '0px')
    await expect(capture).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')

    for (const heading of ['What needs your attention', 'Inbox', 'Recent notes']) {
      const card = page.getByRole('heading', { name: heading }).locator('xpath=ancestor::section[1]')
      await expect(card).toHaveCSS('border-style', 'solid')
      await expect(card).toHaveCSS('border-radius', '8px')
      await expect(card).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
    }

    const attentionCount = page.getByRole('heading', { name: 'What needs your attention' }).locator('..').getByLabel(/items/)
    const countColors = await renderedColors(attentionCount)
    expect(countColors.contrast).toBeGreaterThanOrEqual(4.5)
    expect(countColors.surfaceDelta).toBeLessThanOrEqual(0.22)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/app')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await expectTouchTarget(page.getByRole('button', { name: /project progress/ }))
    for (const heading of ['What needs your attention', 'Inbox', 'Recent notes']) {
      const box = await visibleBox(page.getByRole('heading', { name: heading }).locator('xpath=ancestor::section[1]'))
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(390)
    }
  }
})

test('desktop sidebar gives account identity and utilities separate rows', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/app')

  const accountCard = page.locator('[data-sidebar-account-card]')
  const account = accountCard.getByRole('button', { name: 'Account' })
  const utilities = page.locator('[data-sidebar-utilities]')
  await expect(page.getByRole('complementary', { name: 'Sidebar' })).toHaveCSS('background-color', 'rgb(247, 247, 248)')
  await expect(accountCard).toBeVisible()
  await expect(accountCard.getByText('Alex', { exact: true })).toBeVisible()
  await expect(accountCard).toContainText('owner · Local')
  await expect(utilities.getByRole('link', { name: 'PlanGlade on GitHub' })).toBeVisible()
  await expect(utilities.getByRole('button', { name: 'Change appearance' })).toBeVisible()
  await expect(utilities.getByRole('button', { name: 'Collapse sidebar' })).toBeVisible()

  const accountBox = await visibleBox(accountCard)
  const utilityBox = await visibleBox(utilities)
  expect(accountBox.width).toBeGreaterThanOrEqual(200)
  expect(utilityBox.y).toBeGreaterThanOrEqual(accountBox.y + accountBox.height)
  expect(await utilities.locator(':scope > *').count()).toBe(3)

  await account.click()
  await expect(page).toHaveURL(/\/app\/settings$/)
})

test('item types and task description are explicit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 820 })
  await page.goto('/app')

  const attention = page.getByRole('heading', { name: 'What needs your attention' }).locator('xpath=ancestor::section[1]')
  await expect(attention.locator('[data-entity-type="task"]').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Inbox' }).locator('xpath=ancestor::section[1]').locator('[data-entity-type="capture"]').first()).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Recent notes' }).locator('xpath=ancestor::section[1]').locator('[data-entity-type="note"]').first()).toBeVisible()

  await attention.getByRole('button', { name: /^Task:/ }).first().click()
  const drawer = page.getByLabel('Task details')
  await expect(drawer.locator('[data-entity-type="task"]')).toBeVisible()
  await expect(drawer.getByRole('textbox', { name: 'Task description' })).toBeVisible()
  await expect(drawer.getByText('Custom labels', { exact: true })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Open Notes' })).toBeVisible()
  await expect(drawer.getByRole('textbox', { name: 'Task notes' })).toHaveCount(0)

  await page.goto('/app/connections')
  await expect(page.locator('[data-entity-type="person"]').first()).toBeVisible()
})
