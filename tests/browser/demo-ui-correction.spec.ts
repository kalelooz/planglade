import { expect, test } from "@playwright/test"

test.use({ viewport: { width: 1440, height: 1000 } })

test("clean system-light demo starts light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.addInitScript(() => window.localStorage.clear())

  await page.goto("/demo")
  await expect(page.locator("html")).toHaveClass(/\blight\b/)
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
  await expect(page.getByRole("link", { name: "2 due today" })).toBeVisible()
})

test("clean system-dark demo stays light and direct task routes remain populated", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.addInitScript(() => window.localStorage.clear())

  await page.goto("/demo")
  await expect(page.locator("html")).toHaveClass(/\blight\b/)
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
  await expect(page.getByRole("link", { name: "2 due today" })).toBeVisible()
  await expect(page.getByRole("link", { name: "1 overdue", exact: true })).toBeVisible()
  await expect(page.getByRole("navigation").getByRole("link", { name: "Connections", exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("link", { name: "2 due today" })).toBeVisible()
  await expect(page.locator("html")).toHaveClass(/\blight\b/)

  await page.goto("/demo/tasks")
  const task = page.getByRole("button", { name: "Review homepage copy with client", exact: true })
  await expect(task).toBeVisible()
  await task.click()
  await expect(page.locator('input[value="Review homepage copy with client"]')).toBeVisible()

  await page.goto("/demo/tasks?view=board")
  await expect(page).toHaveURL(/\/demo\/tasks\?view=board$/)
  await expect(page.getByText("Review homepage copy with client", { exact: true }).first()).toBeVisible()
})

test("explicit dark selection remains persisted", async ({ page }) => {
  await page.goto("/demo/settings")
  await page.getByRole("button", { name: "Dark", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)

  await page.reload()
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)

  await page.goto("/demo/tasks")
  const activeTaskTitle = page.locator('button[title="Assign volunteer arrival roles"]')
  await expect(activeTaskTitle).toBeVisible()
  const usesForeground = await activeTaskTitle.evaluate((element) => {
    const probe = document.createElement("span")
    probe.style.color = "var(--foreground)"
    document.body.append(probe)
    const expected = getComputedStyle(probe).color
    probe.remove()
    return getComputedStyle(element).color === expected
  })
  expect(usesForeground).toBe(true)
})
