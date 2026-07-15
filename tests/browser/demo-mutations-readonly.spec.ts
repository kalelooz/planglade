import { expect, test } from "@playwright/test"

const message = "Demo mode - changes are disabled."
const writeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"])

test.setTimeout(120_000)

test("demo mutation affordances stay read-only without write requests", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const writes: string[] = []
  page.on("request", (request) => {
    if (writeMethods.has(request.method())) writes.push(`${request.method()} ${request.url()}`)
  })

  await page.goto("/demo/inbox")
  const inboxRows = page.locator('[data-inbox-row="pending-capture"]')
  const inboxCount = await inboxRows.count()
  const capture = page.getByRole("textbox", { name: "Quick Capture" })
  await capture.fill("Must remain a draft")
  await capture.press("Enter")
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible()
  await expect(capture).toHaveValue("Must remain a draft")
  await expect(inboxRows).toHaveCount(inboxCount)
  await page.getByTitle("Convert to task").first().click()
  await expect(inboxRows).toHaveCount(inboxCount)

  await page.goto("/demo/tasks")
  await page.getByRole("button", { name: "New task", exact: true }).first().click()
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible()
  await page.getByRole("button", { name: "Assign volunteer arrival roles", exact: true }).click()
  await expect(page.locator('input[readonly][value]').first()).toBeVisible()

  await page.goto("/demo/tasks?view=board")
  const cards = page.locator("[data-task-card]")
  const cardCount = await cards.count()
  await page.getByRole("button", { name: /^Drag / }).first().click()
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible()
  await expect(cards).toHaveCount(cardCount)
  await page.getByRole("button", { name: "New task", exact: true }).click()

  await page.goto("/demo/projects")
  await expect(page.getByRole("button", { name: "New project", exact: true }).first()).toHaveAttribute("aria-disabled", "true")
  await page.goto("/demo/projects/bakery-launch")
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled()

  await page.goto("/demo/notes")
  await page.getByTitle("New note").click()
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible()
  await expect(page.locator('[contenteditable="false"]').first()).toBeVisible()

  await page.goto("/demo/calendar")
  await page.locator('[data-calendar-add="day"]').first().click()
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible()

  await page.goto("/demo/connections")
  await page.getByRole("button", { name: "Show labels" }).click()
  await expect(page.locator('[data-relationship-edge-label="true"]').first()).toBeVisible()

  await page.goto("/demo/settings")
  await page.getByRole("button", { name: "Dark", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await page.getByRole("button", { name: "Comfortable", exact: true }).click()
  await expect(page.getByRole("button", { name: "Comfortable", exact: true })).toHaveAttribute("aria-pressed", "true")

  await page.keyboard.press("Control+k")
  const palette = page.getByPlaceholder("Type a command or search.")
  await expect(palette).toBeVisible()
  await palette.fill("create delete invite import")
  await expect(page.getByText("No results", { exact: true })).toBeVisible()
  expect(writes).toEqual([])
})

test("mobile demo navigation keeps mutation shortcuts disabled", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const writes: string[] = []
  page.on("request", (request) => {
    if (writeMethods.has(request.method())) writes.push(`${request.method()} ${request.url()}`)
  })

  await page.goto("/demo/tasks")
  await page.getByRole("button", { name: "Open navigation" }).click()
  const createProject = page.getByRole("button", { name: "Create new project" })
  await expect(createProject).toHaveAttribute("aria-disabled", "true")
  await expect(createProject).toHaveAttribute("title", message)
  await createProject.click()
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible()
  await page.getByRole("link", { name: /^Inbox\b/ }).click()
  await page.getByRole("textbox", { name: "Quick Capture" }).fill("Mobile draft")
  await page.getByRole("textbox", { name: "Quick Capture" }).press("Enter")
  await expect(page.getByText(message, { exact: true }).last()).toBeVisible()
  expect(writes).toEqual([])
})
