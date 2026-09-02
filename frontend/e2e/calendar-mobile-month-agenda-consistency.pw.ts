import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { addMonths, format, startOfMonth } from 'date-fns'
import { deleteCurrentProject, deleteCurrentWorkItem } from './collaborative-cleanup'

type Project = { id: string }
type WorkItem = { id: string }

const artifactDir = path.resolve('test-results/calendar-mobile-month-agenda-consistency-001')

async function selectFixtureProject(page: import('@playwright/test').Page, projectName: string) {
  await page.getByRole('combobox', { name: 'Filter by project' }).click()
  await page.getByRole('option', { name: projectName, exact: true }).click()
}

function agendaTask(page: import('@playwright/test').Page, title: string) {
  return page.getByText(title, { exact: true }).locator('..')
}

test('Calendar mobile agenda follows the selected month and preserves navigation focus', async ({ page }) => {
  await mkdir(artifactDir, { recursive: true })
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<{ workspace: { id: string } }>)
  const runId = Date.now()
  const projectName = `Calendar agenda fixture ${runId} with a long project label`
  const currentTitle = `Calendar current-month fixture ${runId} with a long title for agenda containment`
  const nextTitle = `Calendar next-month fixture ${runId} with a long title for agenda containment`
  const currentMonth = startOfMonth(new Date())
  const currentDate = format(new Date(), 'yyyy-MM-dd')
  const nextDate = format(startOfMonth(addMonths(currentMonth, 1)), 'yyyy-MM-dd')
  const currentMonthLabel = format(currentMonth, 'MMMM yyyy')
  const nextMonthLabel = format(addMonths(currentMonth, 1), 'MMMM yyyy')
  const emptyMonthLabel = format(addMonths(currentMonth, 2), 'MMMM yyyy')
  let project: Project | undefined
  let currentTask: WorkItem | undefined
  let nextTask: WorkItem | undefined

  try {
    const projectResponse = await page.request.post('/api/projects', {
      data: { workspaceId: session.workspace.id, name: projectName, slug: `calendar-agenda-${runId}` },
    })
    expect(projectResponse.status()).toBe(201)
    project = (await projectResponse.json() as { project: Project }).project

    for (const [title, dueDate] of [[currentTitle, currentDate], [nextTitle, nextDate]] as const) {
      const workItemResponse = await page.request.post('/api/work-items', {
        data: { workspaceId: session.workspace.id, projectId: project.id, title, status: 'TODO', priority: 'MEDIUM', dueDate: `${dueDate}T00:00:00.000Z` },
      })
      expect(workItemResponse.status()).toBe(201)
      const workItem = (await workItemResponse.json() as { workItem: WorkItem }).workItem
      if (title === currentTitle) currentTask = workItem
      else nextTask = workItem
    }

    for (const [width, height] of [[320, 844], [390, 844], [768, 1024], [1024, 768], [1440, 900]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto('/app/calendar')
      await expect(page.getByText(currentMonthLabel, { exact: true })).toBeVisible()
      await selectFixtureProject(page, projectName)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)).toBeTruthy()
      if (width < 768) {
        await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible()
        await expect(page.getByText(currentTitle, { exact: true })).toBeVisible()
        const taskButton = agendaTask(page, currentTitle)
        const taskBox = await taskButton.boundingBox()
        expect(taskBox && taskBox.width >= 44 && taskBox.height >= 44).toBeTruthy()
        expect(await page.locator('button button, button [role="button"], [role="button"] button, [role="button"] [role="button"]').count()).toBe(0)
      }
      await page.screenshot({ path: path.join(artifactDir, `${width}x${height}-light.png`), fullPage: width < 768 })
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/app/calendar')
    await selectFixtureProject(page, projectName)
    const nextButton = page.getByRole('button', { name: 'Next month' })
    const previousButton = page.getByRole('button', { name: 'Previous month' })
    const todayButton = page.getByRole('button', { name: 'Today' })

    await nextButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(nextMonthLabel, { exact: true })).toBeVisible()
    await expect(page.getByText(nextTitle, { exact: true })).toBeVisible()
    await expect(page.getByText(currentTitle, { exact: true })).toHaveCount(0)
    await expect(nextButton).toBeFocused()

    await previousButton.focus()
    await page.keyboard.press('Space')
    await expect(page.getByText(currentMonthLabel, { exact: true })).toBeVisible()
    await expect(page.getByText(currentTitle, { exact: true })).toBeVisible()
    await expect(page.getByText(nextTitle, { exact: true })).toHaveCount(0)
    await expect(previousButton).toBeFocused()

    await nextButton.focus()
    await page.keyboard.press('Enter')
    await todayButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(currentMonthLabel, { exact: true })).toBeVisible()
    await expect(page.getByText(currentTitle, { exact: true })).toBeVisible()
    await expect(todayButton).toBeFocused()

    await nextButton.focus()
    await page.keyboard.press('Enter')
    await nextButton.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByText(emptyMonthLabel, { exact: true })).toBeVisible()
    await expect(page.getByText('Nothing scheduled', { exact: true })).toBeVisible()
    await expect(page.getByText(currentTitle, { exact: true })).toHaveCount(0)
    await expect(page.getByText(nextTitle, { exact: true })).toHaveCount(0)
    expect(await page.locator('button button, button [role="button"], [role="button"] button, [role="button"] [role="button"]').count()).toBe(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)).toBeTruthy()

    await todayButton.focus()
    await page.keyboard.press('Enter')
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.goto('/app/calendar')
    await selectFixtureProject(page, projectName)
    await expect(page.getByText(currentTitle, { exact: true })).toBeVisible()
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.classList.contains('dark'))).toBeTruthy()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)).toBeTruthy()
    await page.screenshot({ path: path.join(artifactDir, '390x844-dark-reduced-motion.png'), fullPage: true })
  } finally {
    for (const workItem of [currentTask, nextTask]) {
      if (!workItem) continue
      await deleteCurrentWorkItem(page.request, session.workspace.id, workItem.id)
    }
    if (project) {
      await deleteCurrentProject(page.request, session.workspace.id, project.id)
    }
  }
})
