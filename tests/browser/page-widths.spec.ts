import { expect, test, type Page } from "@playwright/test"

test.use({ viewport: { width: 1680, height: 1000 } })

async function expectFixedWidth(page: Page, path: string, mode: "standard" | "wide" | "reading", width: number) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  const content = page.locator(`[data-page-width="${mode}"]`).first()
  await expect(content).toBeVisible()
  await expect(content).toHaveCSS("max-width", `${width}px`)
  expect((await content.boundingBox())?.width).toBeCloseTo(width, 0)
}

async function expectFluidWidth(page: Page, path: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" })
  const content = page.locator('[data-page-width="canvas"]')
  await expect(content).toBeVisible()
  await expect(content).toHaveCSS("max-width", "none")
}

test("demo workspace applies the page width policy without constraining canvases", async ({ page }) => {
  await expectFixedWidth(page, "/demo", "standard", 1080)
  await expectFixedWidth(page, "/demo/tasks", "standard", 1080)
  await expectFixedWidth(page, "/demo/settings", "reading", 900)

  await page.goto("/demo/notes", { waitUntil: "domcontentloaded" })
  await expect(page.getByText("Read only", { exact: true })).toBeVisible()
  const notes = page.locator('[data-page-width="reading"]')
  await expect(notes).toHaveCSS("max-width", "900px")
  expect((await notes.boundingBox())?.width).toBeCloseTo(900, 0)

  await expectFixedWidth(page, "/demo/projects/bakery-launch", "wide", 1320)
  await expectFluidWidth(page, "/demo/tasks?view=board")
  await expectFluidWidth(page, "/demo/calendar")
  await expectFluidWidth(page, "/demo/connections")
})

test("mobile demo routes do not create page-level horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })

  for (const path of ["/demo", "/demo/notes", "/demo/calendar", "/demo/connections"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})
