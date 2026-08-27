import { expect, test, type Locator } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { daysFromToday, relativeLabel } from '../src/lib/dates'

type Project = { id: string }
type WorkItem = { id: string }

const artifactDir = path.resolve('test-results/tasks-list-responsive-accessibility-001')

type Box = { x: number; y: number; width: number; height: number }

function overlaps(a: Box, b: Box) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

async function visibleBox(locator: Locator) {
  const boxes = await locator.evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect()
    const style = getComputedStyle(element)
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' ? [{ x: rect.x, y: rect.y, width: rect.width, height: rect.height }] : []
  }))
  expect(boxes).toHaveLength(1)
  return boxes[0]
}

test('Tasks List keeps full metadata clear and touch targets reachable', async ({ page }) => {
  await mkdir(artifactDir, { recursive: true })
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<{ workspace: { id: string } }>)
  const runId = Date.now()
  const projectName = `Tasks List metadata fixture ${runId} — a deliberately long project name`
  const title = `Tasks List responsive fixture ${runId} with a deliberately long title and every metadata field`
  const dueDate = daysFromToday(14)
  let project: Project | undefined
  let workItem: WorkItem | undefined

  try {
    const projectResponse = await page.request.post('/api/projects', {
      data: { workspaceId: session.workspace.id, name: projectName, slug: `tasks-list-responsive-${runId}` },
    })
    expect(projectResponse.status()).toBe(201)
    project = (await projectResponse.json() as { project: Project }).project
    const workItemResponse = await page.request.post('/api/work-items', {
      data: { workspaceId: session.workspace.id, projectId: project.id, title, status: 'IN_PROGRESS', priority: 'HIGH', dueDate: `${dueDate}T00:00:00.000Z` },
    })
    expect(workItemResponse.status()).toBe(201)
    workItem = (await workItemResponse.json() as { workItem: WorkItem }).workItem

    for (const [width, height] of [[320, 844], [390, 844], [768, 1024], [1024, 768], [1440, 900]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto('/app/tasks')
      const taskButton = page.getByRole('button', { name: `Task: ${title}` })
      await expect(taskButton).toBeVisible()
      const row = taskButton.locator('..')
      const checkbox = row.getByRole('checkbox', { name: 'Mark as done' })
      const projectButton = row.getByRole('button', { name: projectName, exact: true })
      const metadataBoxes = await Promise.all([
        visibleBox(row.getByText(title, { exact: true })),
        visibleBox(row.getByText('In Progress', { exact: true })),
        visibleBox(projectButton),
        visibleBox(row.getByText(relativeLabel(dueDate), { exact: true })),
        visibleBox(row.getByTitle('High priority')),
      ])

      for (let index = 0; index < metadataBoxes.length; index += 1) {
        for (let other = index + 1; other < metadataBoxes.length; other += 1) {
          expect(overlaps(metadataBoxes[index], metadataBoxes[other])).toBe(false)
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)).toBeTruthy()

      if (width <= 390) {
        const targets = await Promise.all([taskButton, checkbox, projectButton].map((locator) => locator.boundingBox()))
        expect(targets.every((box) => box && box.width >= 44 && box.height >= 44)).toBeTruthy()
      }
      await page.screenshot({ path: path.join(artifactDir, `${width}x${height}-light.png`), fullPage: width <= 390 })
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/app/tasks')
    const taskButton = page.getByRole('button', { name: `Task: ${title}` })
    const row = taskButton.locator('..')
    const checkbox = row.getByRole('checkbox', { name: 'Mark as done' })
    const projectButton = row.getByRole('button', { name: projectName, exact: true })
    await taskButton.focus()
    await expect(taskButton).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(checkbox).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(projectButton).toBeFocused()

    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 320, height: 844 })
    await page.goto('/app/tasks')
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    await expect(page.getByRole('button', { name: `Task: ${title}` })).toBeVisible()
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.classList.contains('dark'))).toBeTruthy()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)).toBeTruthy()
    await page.screenshot({ path: path.join(artifactDir, '320x844-dark-reduced-motion.png'), fullPage: true })
  } finally {
    if (workItem) {
      const workItemDelete = await page.request.delete(`/api/work-items/${encodeURIComponent(workItem.id)}?workspaceId=${encodeURIComponent(session.workspace.id)}`)
      expect(workItemDelete.ok()).toBeTruthy()
    }
    if (project) {
      const projectDelete = await page.request.delete(`/api/projects/${encodeURIComponent(project.id)}?workspaceId=${encodeURIComponent(session.workspace.id)}`)
      expect(projectDelete.ok()).toBeTruthy()
    }
  }
})
