import { expect, test } from "@playwright/test"

test.skip(process.env.PLANGLADE_BROWSER_SETUP_UI !== "true", "Runs only in the isolated local-auth setup harness.")

test("an operator can set up an owner, save codes, then sign in locally", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("link", { name: "Set up this self-hosted installation" })).toBeVisible()

  await page.getByRole("link", { name: "Set up this self-hosted installation" }).click()
  await page.getByLabel("Setup token").fill("a".repeat(64))
  await page.getByRole("button", { name: "Continue", exact: true }).click()

  await expect(page.getByRole("heading", { name: "Owner and workspace details" })).toBeVisible()
  await page.getByLabel("Owner name").fill("Setup Owner")
  await page.getByLabel("Email").fill("owner@example.com")
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple")
  await page.getByLabel("Confirm password").fill("correct horse battery staple")
  await page.getByLabel("Workspace name").fill("My workspace")
  await page.getByRole("button", { name: "Create owner and workspace" }).click()

  await expect(page.getByRole("heading", { name: "Save recovery codes" })).toBeVisible()
  await expect(page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem")).toHaveCount(10)
  await expect(page.getByRole("button", { name: "Continue to login" })).toBeDisabled()
  await page.getByRole("checkbox", { name: "I saved these recovery codes. PlanGlade cannot show them again." }).check()
  await page.getByRole("button", { name: "Continue to login" }).click()

  await expect(page).toHaveURL(/\/login$/)
  await page.getByLabel("Email").fill("owner@example.com")
  await page.getByLabel("Password").fill("correct horse battery staple")
  await page.getByRole("button", { name: "Continue with email" }).click()
  await expect(page).toHaveURL(/\/app$/)
})
