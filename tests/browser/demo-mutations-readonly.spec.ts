import { expect, test, type Page } from "@playwright/test"

const message = "Demo mode - changes are disabled."
const genericErrors = /Failed to (update capture|update task|move task|save)/i
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"])

test.use({ viewport: { width: 1440, height: 1000 } })

function observePage(page: Page) {
  const writes: string[] = []
  const errors: string[] = []
  page.on("request", (request: { method(): string; url(): string }) => {
    if (writeMethods.has(request.method())) writes.push(`${request.method()} ${request.url()}`)
  })
  page.on("console", (entry: { type(): string; text(): string }) => {
    if (entry.type() === "error") errors.push(entry.text())
  })
  page.on("pageerror", (error: Error) => errors.push(error.message))
  return { writes, errors }
}

async function expectCanonical(page: Page) {
  await expect(page.getByRole("region", { name: "Notifications alt+T" }).getByText(message, { exact: true })).toBeVisible()
  await expect(page.getByText(genericErrors)).toHaveCount(0)
}

test("Inbox mutations preserve capture identity and drafts", async ({ page }) => {
  const observed = observePage(page)
  await page.goto("/demo/inbox")
  const rows = page.locator('[data-inbox-row="pending-capture"]')
  const beforeTitles = await rows.locator("button[title]").evaluateAll((buttons: HTMLButtonElement[]) => buttons.map((button) => button.title))

  const firstRow = rows.filter({ hasText: "Clean survey response spreadsheet" })
  await firstRow.getByTitle("Convert to task").click()
  await expectCanonical(page)
  await expect(rows.locator("button[title]")).toHaveCount(beforeTitles.length)

  const capture = page.getByRole("textbox", { name: "Quick Capture" })
  await capture.fill("Keep this unsaved draft")
  await capture.press("Enter")
  await expectCanonical(page)
  await expect(capture).toHaveValue("Keep this unsaved draft")
  expect(await rows.locator("button[title]").evaluateAll((buttons: HTMLButtonElement[]) => buttons.map((button) => button.title))).toEqual(beforeTitles)
  expect(observed.writes).toEqual([])
  expect(observed.errors).toEqual([])
})

test("Tasks completion and drawer edits remain unchanged", async ({ page }) => {
  const observed = observePage(page)
  await page.goto("/demo/tasks")
  const completion = page.getByRole("checkbox", { name: "Complete Assign volunteer arrival roles" })
  await expect(completion).not.toBeChecked()
  await completion.click()
  await expectCanonical(page)
  await expect(completion).not.toBeChecked()

  await page.getByRole("button", { name: "Assign volunteer arrival roles", exact: true }).click()
  const title = page.locator('input[value="Assign volunteer arrival roles"]')
  const description = page.locator("textarea[readonly]").first()
  await expect(title).toHaveAttribute("readonly", "")
  await expect(page.getByRole("status").getByText(message, { exact: true })).toBeVisible()
  const originalDescription = await description.inputValue()
  await description.press("ControlOrMeta+A")
  await description.pressSequentially("Must not appear")
  await expect(description).toHaveValue(originalDescription)

  const priority = page.locator("select").filter({ has: page.locator('option[value="High"]') })
  const originalPriority = await priority.inputValue()
  await priority.selectOption(originalPriority === "High" ? "Low" : "High")
  await expectCanonical(page)
  await expect(priority).toHaveValue(originalPriority)
  await page.locator('input[type="date"][readonly]').first().click()
  await expectCanonical(page)
  expect(observed.writes).toEqual([])
  expect(observed.errors).toEqual([])
})

test("Board pointer drags and quick moves cannot change column, order, or position", async ({ page }) => {
  const observed = observePage(page)
  await page.goto("/demo/tasks?view=board")
  const card = page.locator('[data-task-id="event-volunteer-roles"]')
  const targetColumn = page.locator('[data-board-column="To Do"]')
  const beforeColumn = await card.evaluate((element) => element.closest("[data-board-column]")?.getAttribute("data-board-column"))
  const beforeOrder = await page.locator("[data-task-card]").evaluateAll((cards) => cards.map((item) => item.getAttribute("data-task-id")))
  const beforeBox = await card.boundingBox()
  const handle = card.getByRole("button", { name: "Drag Assign volunteer arrival roles" })
  const handleBox = await handle.boundingBox()
  const targetBox = await targetColumn.boundingBox()
  if (!beforeBox || !handleBox || !targetBox) throw new Error("Board drag geometry unavailable")

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 100, { steps: 12 })
  await page.mouse.up()
  await expectCanonical(page)
  expect(await card.evaluate((element) => element.closest("[data-board-column]")?.getAttribute("data-board-column"))).toBe(beforeColumn)
  expect(await page.locator("[data-task-card]").evaluateAll((cards) => cards.map((item) => item.getAttribute("data-task-id")))).toEqual(beforeOrder)
  const afterBox = await card.boundingBox()
  expect(afterBox?.x).toBeCloseTo(beforeBox.x, 0)
  expect(afterBox?.y).toBeCloseTo(beforeBox.y, 0)

  await card.getByRole("button", { name: "More actions" }).click()
  await page.getByRole("menuitem", { name: "Move to" }).click()
  await page.getByRole("menuitem", { name: "To Do" }).click()
  await expectCanonical(page)
  expect(await card.getAttribute("data-task-status")).toBe("Backlog")
  expect(await page.locator("[data-task-card]").evaluateAll((cards) => cards.map((item) => item.getAttribute("data-task-id")))).toEqual(beforeOrder)
  expect(observed.writes).toEqual([])
  expect(observed.errors).toEqual([])
})

test("Notes loads directly and after refresh without chunk or page errors", async ({ page, browserName }) => {
  const observed = observePage(page)
  const failedChunks: string[] = []
  page.on("response", (response) => {
    if (response.status() >= 400 && /\.(?:js|mjs)(?:\?|$)/.test(response.url())) failedChunks.push(`${response.status()} ${response.url()}`)
  })
  page.on("requestfailed", (request) => {
    if (/\.(?:js|mjs)(?:\?|$)/.test(request.url())) failedChunks.push(`failed ${request.url()}`)
  })

  await page.goto("/demo/notes")
  await expect(page.getByText("Read only", { exact: true })).toBeVisible()
  await expect(page.locator('[contenteditable="false"]')).toBeVisible()
  await page.reload()
  await expect(page.getByText("Read only", { exact: true })).toBeVisible()
  await expect(page.locator('[contenteditable="false"]')).toBeVisible()
  expect(failedChunks, `${browserName} failed chunks`).toEqual([])
  expect(observed.errors.filter((error) => /ChunkLoadError|Loading chunk/i.test(error))).toEqual([])
  expect(observed.writes).toEqual([])
})

test("Calendar add uses canonical feedback and preserves tasks", async ({ page }) => {
  const observed = observePage(page)
  await page.goto("/demo/calendar")
  const cards = page.locator('[data-calendar-task-card="month"]')
  await expect(cards).toHaveCount(12)
  const before = await cards.evaluateAll((items) => items.map((item) => item.textContent))
  await page.locator('[data-calendar-add="day"]').first().click()
  await expectCanonical(page)
  expect(await cards.evaluateAll((items) => items.map((item) => item.textContent))).toEqual(before)
  expect(observed.writes).toEqual([])
  expect(observed.errors).toEqual([])
})
