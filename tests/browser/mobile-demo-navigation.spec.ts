import { expect, test as base } from "@playwright/test"

const test = base.extend<{ applicationErrors: string[] }>({
  applicationErrors: async ({ page }, consume) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${message.text()} (${message.location().url})`)
    })
    page.on("pageerror", (error) => errors.push(error.message))

    await consume(errors)
    expect(errors).toEqual([])
  },
})

test.use({ viewport: { width: 375, height: 812 } })

test("mobile demo navigation stays contained and omits settings", async ({ page, applicationErrors }) => {
  await page.goto("/demo")
  await expect(page.locator('[data-demo-banner="mobile"]')).toHaveText(
    "Demo mode - changes are disabled."
  )
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.getByRole("button", { name: "Open navigation" }).click()
  await expect(page.getByRole("button", { name: "Close navigation" })).toBeVisible()

  const navigation = page.getByRole("navigation")
  for (const label of ["Inbox", "Tasks", "Projects", "Notes", "Calendar", "Connections"]) {
    await expect(
      navigation.getByRole("link", {
        name: label === "Inbox" ? /^Inbox\b/ : label,
        exact: label !== "Inbox",
      })
    ).toBeVisible()
  }
  await expect(navigation.getByRole("link", { name: "Settings", exact: true })).toHaveCount(0)

  await navigation.getByRole("link", { name: "Connections", exact: true }).click()
  await expect(page).toHaveURL(/\/demo\/connections$/)
  await expect(page.getByRole("heading", { name: "Connections", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Close navigation" })).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(applicationErrors).toEqual([])
})
