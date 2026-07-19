import { expect, test, type Locator } from "@playwright/test"

test.use({ viewport: { width: 1440, height: 1000 } })

test("clean system-light demo starts light", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" })
  await page.addInitScript(() => window.localStorage.clear())

  await page.goto("/demo")
  await expect(page.locator("html")).toHaveClass(/\blight\b/)
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
  await expect(page.getByRole("heading", { name: "What needs your attention", exact: true })).toBeVisible()
})

test("clean system-dark demo stays light and direct task routes remain populated", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.addInitScript(() => window.localStorage.clear())

  await page.goto("/demo")
  await expect(page.locator("html")).toHaveClass(/\blight\b/)
  await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
  await expect(page.getByRole("heading", { name: "What needs your attention", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Project focus", exact: true })).toBeVisible()
  await expect(page.getByRole("navigation").getByRole("link", { name: "Connections", exact: true })).toBeVisible()

  await page.reload()
  await expect(page.getByRole("heading", { name: "What needs your attention", exact: true })).toBeVisible()
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

test("theme controls share durable Light, Dark, and System behavior", async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/demo/settings")
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()

  await expect(page.locator("html")).toHaveClass(/\blight\b/)
  await page.getByRole("button", { name: "Dark", exact: true }).click()
  await expect(page.getByRole("button", { name: "Dark", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("fb.store.v2") ?? "{}").state?.settings?.theme)).toBe("dark")
  await expect.poll(() => page.evaluate(() => localStorage.getItem("theme"))).toBe("dark")

  await page.goto("/demo/inbox")
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)

  const secondPage = await context.newPage()
  await secondPage.goto("/demo/calendar")
  await expect(secondPage.locator("html")).toHaveClass(/\bdark\b/)
  await secondPage.close()

  await page.goto("/demo/settings")
  await page.getByRole("button", { name: "System", exact: true }).click()
  await expect(page.getByRole("button", { name: "System", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)
  await page.emulateMedia({ colorScheme: "light" })
  await expect(page.locator("html")).toHaveClass(/\blight\b/)
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/\blight\b/)

  await page.emulateMedia({ colorScheme: "dark" })
  await page.getByRole("button", { name: "Light", exact: true }).click()
  await expect(page.getByRole("button", { name: "Light", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator("html")).toHaveClass(/\blight\b/)
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/\blight\b/)
})

test.describe("mobile theme preference", () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test("Light, Dark, and System remain deterministic", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" })
    await page.goto("/demo/settings")
    await page.evaluate(() => window.localStorage.clear())
    await page.reload()
    await expect(page.locator("html")).toHaveClass(/\blight\b/)

    await page.getByRole("button", { name: "Dark", exact: true }).click()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
    await page.reload()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)

    await page.getByRole("button", { name: "System", exact: true }).click()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
    await page.emulateMedia({ colorScheme: "light" })
    await expect(page.locator("html")).toHaveClass(/\blight\b/)

    await page.emulateMedia({ colorScheme: "dark" })
    await page.getByRole("button", { name: "Light", exact: true }).click()
    await expect(page.locator("html")).toHaveClass(/\blight\b/)
  })
})

test("dark Inbox and Calendar surfaces stay recessed with visible focus", async ({ page }) => {
  const surfaceLightness = async (locator: Locator) => locator.evaluate((element) => {
    const color = getComputedStyle(element).backgroundColor
    const oklMatch = color.match(/^okl(?:ch|ab)\(([\d.]+)/)
    if (oklMatch) return Number(oklMatch[1])
    const rgbMatch = color.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/)
    if (!rgbMatch) return 1
    return (Number(rgbMatch[1]) + Number(rgbMatch[2]) + Number(rgbMatch[3])) / (255 * 3)
  })

  await page.goto("/demo/settings")
  await page.getByRole("button", { name: "Dark", exact: true }).click()
  await expect(page.locator("html")).toHaveClass(/\bdark\b/)

  await page.goto("/demo/inbox")
  const capture = page.locator('[data-inbox-surface="quick-capture"]')
  const pending = page.locator('[data-inbox-surface="pending-captures"]')
  await expect(capture).toBeVisible()
  await expect(pending).toBeVisible()
  expect(await surfaceLightness(capture)).toBeLessThan(0.45)
  expect(await surfaceLightness(pending)).toBeLessThan(0.45)

  await page.goto("/demo/calendar")
  const taskCard = page.locator('[data-calendar-task-card="month"]').first()
  const addControl = page.locator('[data-calendar-add="day"]').first()
  await expect(taskCard).toBeVisible()
  await expect(addControl).toBeVisible()
  expect(await surfaceLightness(taskCard)).toBeLessThan(0.45)
  expect(await surfaceLightness(addControl)).toBeLessThan(0.45)

  await addControl.focus()
  const focusShadow = await addControl.evaluate((element) => getComputedStyle(element).boxShadow)
  expect(focusShadow).not.toBe("none")
})
