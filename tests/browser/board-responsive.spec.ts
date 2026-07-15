import { expect, test, type Page } from "@playwright/test"

test.setTimeout(60_000)

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1720, height: 900 },
  { width: 1684, height: 896 },
  { width: 1440, height: 1000 },
  { width: 1280, height: 900 },
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]

const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"])

async function openBoardDrawer(page: Page) {
  const card = page.locator('[data-task-id="event-volunteer-roles"]')
  await expect(card).toBeVisible()
  const trigger = card.getByRole("button", { name: "Assign volunteer arrival roles", exact: true })
  await trigger.click()
  const drawer = page.locator('[data-board-drawer="true"]')
  await expect(drawer).toBeVisible()
  return { card, trigger, drawer }
}

async function geometry(page: Page) {
  return page.evaluate(() => {
    const drawer = document.querySelector<HTMLElement>('[data-board-drawer="true"]')
    const workspace = document.querySelector<HTMLElement>('[data-board-workspace="true"]')
    const board = document.querySelector<HTMLElement>('[data-board-scroll-region="true"]')
    const columns = [...document.querySelectorAll<HTMLElement>("[data-board-column]")]
    const cards = [...document.querySelectorAll<HTMLElement>("[data-task-card]")]
    const drawerRect = drawer?.getBoundingClientRect()
    return {
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
      workspaceClientWidth: workspace?.clientWidth ?? 0,
      workspaceScrollWidth: workspace?.scrollWidth ?? 0,
      boardClientWidth: board?.clientWidth ?? 0,
      boardScrollWidth: board?.scrollWidth ?? 0,
      boardWidth: board?.getBoundingClientRect().width ?? 0,
      drawerPosition: drawer ? getComputedStyle(drawer).position : "missing",
      drawerWidth: drawerRect?.width ?? 0,
      drawerRight: drawerRect?.right ?? Infinity,
      columnWidths: columns.map((column) => column.getBoundingClientRect().width),
      firstCardWidth: cards[0]?.getBoundingClientRect().width ?? 0,
      cardsInsideColumns: cards.every((card) => {
        const column = card.closest<HTMLElement>("[data-board-column]")
        if (!column) return false
        const cardRect = card.getBoundingClientRect()
        const columnRect = column.getBoundingClientRect()
        return cardRect.left >= columnRect.left - 1 && cardRect.right <= columnRect.right + 1
      }),
    }
  })
}

for (const viewport of viewports) {
  test(`Board and drawer stay contained at ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport)
    const writes: string[] = []
    page.on("request", (request) => {
      if (writeMethods.has(request.method())) writes.push(`${request.method()} ${request.url()}`)
    })
    await page.goto("/demo/tasks?view=board")

    await expect(page.locator('[data-board-scroll-region="true"]')).toBeVisible()
    await expect(page.locator("[data-board-column]")).toHaveCount(5)
    await expect(page.locator("[data-task-card]").first()).toBeVisible()
    const closed = await geometry(page)
    if (viewport.width === 1684) {
      await page.screenshot({ path: testInfo.outputPath("board-closed.png"), fullPage: true })
    }
    const { trigger, drawer } = await openBoardDrawer(page)
    const measured = await geometry(page)
    if (viewport.width === 1684 || viewport.width === 390) {
      await page.screenshot({ path: testInfo.outputPath("board-drawer-open.png"), fullPage: true })
    }

    expect(measured.documentScrollWidth).toBeLessThanOrEqual(measured.documentClientWidth)
    expect(measured.bodyScrollWidth).toBeLessThanOrEqual(measured.bodyClientWidth)
    expect(measured.workspaceScrollWidth).toBeLessThanOrEqual(measured.workspaceClientWidth)
    expect(measured.drawerRight).toBeLessThanOrEqual(viewport.width + 1)
    expect(measured.cardsInsideColumns).toBe(true)
    expect(measured.columnWidths).toHaveLength(5)
    await expect(drawer.getByRole("button", { name: "Close task drawer" })).toBeVisible()
    await expect(drawer.getByRole("button", { name: "Close task drawer" })).toBeFocused()

    if (viewport.width >= 1800) {
      expect(measured.drawerPosition).toBe("relative")
      expect(measured.boardScrollWidth).toBeLessThanOrEqual(measured.boardClientWidth)
    } else {
      expect(["absolute", "fixed"]).toContain(measured.drawerPosition)
      expect(Math.abs(measured.boardWidth - closed.boardWidth)).toBeLessThanOrEqual(2)
      expect(Math.abs(measured.columnWidths[0] - closed.columnWidths[0])).toBeLessThanOrEqual(2)
      expect(Math.abs(measured.firstCardWidth - closed.firstCardWidth)).toBeLessThanOrEqual(2)
    }
    if (viewport.width >= 1280) {
      expect(measured.boardScrollWidth).toBeLessThanOrEqual(measured.boardClientWidth)
    }
    if (viewport.width < 768) {
      expect(measured.drawerPosition).toBe("fixed")
      expect(measured.drawerWidth).toBeCloseTo(viewport.width, 0)
    }

    await drawer.getByRole("button", { name: "Close task drawer" }).click()
    await expect(drawer).toHaveCount(0)
    await expect(trigger).toBeFocused()
    expect(writes).toEqual([])
  })
}

test("project-filtered demo Board inherits the responsive drawer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/demo/tasks?view=board&project=community-event")
  await openBoardDrawer(page)
  const measured = await geometry(page)
  expect(measured.drawerPosition).toBe("absolute")
  expect(measured.documentScrollWidth).toBeLessThanOrEqual(measured.documentClientWidth)
  expect(measured.boardScrollWidth).toBeLessThanOrEqual(measured.boardClientWidth)
  expect(measured.cardsInsideColumns).toBe(true)
})
