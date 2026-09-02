import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { deleteCurrentProject, deleteCurrentWorkItem } from './collaborative-cleanup'

type Project = { id: string }
type WorkItem = { id: string; title: string }
const artifactDir = path.resolve('test-results/inbox-responsive-accessibility-001')
const desktopArtifactDir = path.resolve('test-results/inbox-desktop-column-containment-001')

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

test('Inbox responsive accessibility stays clear at mobile widths', async ({ page }) => {
  await mkdir(artifactDir, { recursive: true })
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<{ workspace: { id: string } }>)
  const title = `Inbox responsive accessibility ${Date.now()} with long content`
  const createdResponse = await page.request.post('/api/work-items', {
    data: { workspaceId: session.workspace.id, title, status: 'BACKLOG', priority: 'MEDIUM' },
  })
  expect(createdResponse.status()).toBe(201)
  const created = (await createdResponse.json() as { workItem: WorkItem }).workItem

  try {
    for (const [width, height] of [[1440, 900], [390, 844], [320, 844]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto('/app/inbox')
      const titleNode = page.getByText(title, { exact: true })
      await expect(titleNode).toBeVisible()
      const row = titleNode.locator('xpath=../..')
      const controls = [
        row.locator('label').first(),
        row.getByRole('combobox', { name: 'Assign project' }),
        row.getByRole('button', { name: 'Set due date' }),
        row.getByRole('combobox', { name: 'Set priority' }),
        row.getByRole('button', { name: `Convert "${title}" to task` }),
        row.getByRole('button', { name: `Dismiss "${title}"` }),
      ]
      const boxes = await Promise.all(controls.map((control) => control.boundingBox()))
      const titleBox = await titleNode.boundingBox()
      expect(titleBox).not.toBeNull()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)).toBeTruthy()

      if (width <= 390) {
        expect(boxes.every((box) => box && box.width >= 44 && box.height >= 44)).toBeTruthy()
        expect(boxes.slice(1).every((box) => box && box.y >= titleBox!.y + titleBox!.height)).toBeTruthy()
        for (let index = 0; index < boxes.length; index += 1) {
          for (let other = index + 1; other < boxes.length; other += 1) {
            expect(overlaps(boxes[index]!, boxes[other]!)).toBe(false)
          }
        }
      } else {
        expect(boxes.slice(1).every((box) => box && box.height <= 32)).toBeTruthy()
      }

      if (width === 390) {
        const checkbox = row.getByRole('checkbox', { name: `Select "${title}"` })
        await checkbox.focus()
        await expect(checkbox).toBeFocused()
        await page.keyboard.press('Tab')
        await expect(controls[1]).toBeFocused()
        await page.keyboard.press('Space')
        await expect(page.getByRole('option', { name: 'No project' })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(controls[1]).toBeFocused()
        await page.screenshot({ path: path.join(artifactDir, '390x844-light.png'), fullPage: true })
      }
      if (width === 320) await page.screenshot({ path: path.join(artifactDir, '320x844-light.png'), fullPage: true })
      if (width === 1440) await page.screenshot({ path: path.join(artifactDir, '1440x900-light.png') })
    }

    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    await page.evaluate(() => document.documentElement.classList.add('dark'))
    for (const [width, height] of [[390, 844], [320, 844]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto('/app/inbox')
      await expect(page.getByText(title, { exact: true })).toBeVisible()
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches && document.documentElement.classList.contains('dark'))).toBeTruthy()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)).toBeTruthy()
      await page.screenshot({ path: path.join(artifactDir, `${width}x${height}-dark-reduced-motion.png`), fullPage: true })
    }
  } finally {
    await deleteCurrentWorkItem(page.request, session.workspace.id, created.id)
  }
})

test('Inbox desktop project column contains long names without crossing controls', async ({ page }) => {
  await mkdir(desktopArtifactDir, { recursive: true })
  const session = await page.request.get('/api/auth/session').then((response) => response.json() as Promise<{ workspace: { id: string } }>)
  const runId = Date.now()
  const projectName = `Desktop containment fixture ${runId} — a deliberately long project name that must stay inside this narrow column`
  const title = `Inbox desktop containment ${runId}`
  let project: Project | undefined
  let workItem: WorkItem | undefined

  try {
    const projectResponse = await page.request.post('/api/projects', {
      data: {
        workspaceId: session.workspace.id,
        name: projectName,
        slug: `inbox-desktop-containment-${runId}`,
      },
    })
    expect(projectResponse.status()).toBe(201)
    project = (await projectResponse.json() as { project: Project }).project
    const workItemResponse = await page.request.post('/api/work-items', {
      data: { workspaceId: session.workspace.id, projectId: project.id, title, status: 'BACKLOG', priority: 'HIGH' },
    })
    expect(workItemResponse.status()).toBe(201)
    workItem = (await workItemResponse.json() as { workItem: WorkItem }).workItem

    for (const [width, height] of [[1024, 768], [1280, 800], [1440, 900]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto('/app/inbox')
      const titleNode = page.getByText(title, { exact: true })
      await expect(titleNode).toBeVisible()
      const row = titleNode.locator('xpath=../..')
      const controls = [
        row.getByRole('combobox', { name: 'Assign project' }),
        row.getByRole('button', { name: 'Set due date' }),
        row.getByRole('combobox', { name: 'Set priority' }),
        row.getByRole('button', { name: `Convert "${title}" to task` }),
        row.getByRole('button', { name: `Dismiss "${title}"` }),
      ]
      const boxes = await Promise.all(controls.map((control) => control.boundingBox()))
      const columnBoxes = boxes.map((box) => {
        expect(box).not.toBeNull()
        return box!
      })
      const projectValue = controls[0].locator(':scope > span').first()
      await expect(projectValue).toHaveText(projectName)
      const valueStyle = await projectValue.evaluate((element) => {
        const style = getComputedStyle(element)
        return { overflow: style.overflow, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace }
      })

      expect(valueStyle).toEqual({ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })
      expect(columnBoxes.slice(0, -1).every((box, index) => box.x + box.width <= columnBoxes[index + 1].x)).toBeTruthy()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth)).toBeTruthy()
      await page.screenshot({ path: path.join(desktopArtifactDir, `${width}x${height}-long-project.png`) })
    }
  } finally {
    if (workItem) {
      await deleteCurrentWorkItem(page.request, session.workspace.id, workItem.id)
    }
    if (project) {
      await deleteCurrentProject(page.request, session.workspace.id, project.id)
    }
  }
})
