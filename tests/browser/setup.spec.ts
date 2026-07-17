import { expect, type Page, test } from "@playwright/test"

test.skip(process.env.PLANGLADE_BROWSER_SETUP_UI !== "true", "Runs only in the isolated local-auth setup harness.")
test.describe.configure({ mode: "serial" })

const fakeCodes = Array.from({ length: 10 }, (_, index) => `${index.toString(16).padStart(4, "0")}-1111-2222-3333-4444-5555-6666-7777`)

async function routeDiscovery(page: Page, response: { status: number; body?: unknown }) {
  await page.route(/\/api\/auth\/setup$/, (route) => route.fulfill({
    status: response.status,
    contentType: "application/json",
    body: JSON.stringify(response.body ?? {}),
  }))
}

async function reachOwner(page: Page) {
  await routeDiscovery(page, { status: 200, body: { status: "available" } })
  await page.route("**/api/auth/setup/claim", (route) => route.fulfill({ status: 201, contentType: "application/json", body: '{"status":"claimed"}' }))
  await page.goto("/setup")
  await page.getByLabel("Setup token").fill("test-only-token")
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Create the owner" })).toBeFocused()
}

async function fillOwner(page: Page) {
  await page.getByLabel("Owner name").fill("Setup Owner")
  await page.getByLabel("Email").fill("owner@example.com")
  await page.getByLabel("Password", { exact: true }).fill("correct horse battery staple")
  await page.getByLabel("Confirm password").fill("correct horse battery staple")
  await page.getByLabel("Workspace name").fill("My workspace")
}

async function reachRecovery(page: Page) {
  await reachOwner(page)
  await fillOwner(page)
  await page.route("**/api/auth/setup/complete", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "complete", recoveryCodes: fakeCodes }) }))
  await page.getByRole("button", { name: "Create owner and workspace" }).click()
  await expect(page.getByRole("heading", { name: "Recovery codes" })).toBeFocused()
}

test("login remains normal and hides setup discovery unless the exact available payload is returned", async ({ page }) => {
  await routeDiscovery(page, { status: 200, body: { status: "available", internal: "must stay hidden" } })
  await page.goto("/login")
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Set up this self-hosted installation" })).toBeHidden()
})

test("setup discovery works again after a route remount", async ({ page }) => {
  await routeDiscovery(page, { status: 200, body: { status: "available" } })
  await page.goto("/setup")
  await expect(page.getByRole("heading", { name: "Authorize setup" })).toBeVisible()
  await page.goto("/login")
  await page.goto("/setup")
  await expect(page.getByRole("heading", { name: "Authorize setup" })).toBeFocused()
})

test("direct setup shows unavailable and temporary discovery states", async ({ page }) => {
  await routeDiscovery(page, { status: 200, body: { status: "unavailable" } })
  await page.goto("/setup")
  await expect(page.getByRole("heading", { name: "Setup is not available" })).toBeFocused()
  await page.screenshot({ path: "test-results/setup-unavailable.png", fullPage: true })

  await page.unrouteAll()
  await routeDiscovery(page, { status: 503 })
  await page.reload()
  await expect(page.getByRole("heading", { name: "Setup is temporarily unavailable" })).toBeFocused()
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible()
})

test("invalid token is cleared and never enters the URL or browser storage", async ({ page }) => {
  await routeDiscovery(page, { status: 200, body: { status: "available" } })
  await page.route("**/api/auth/setup/claim", (route) => route.fulfill({ status: 401, contentType: "application/json", body: '{"error":{"code":"SETUP_AUTHORIZATION_FAILED"}}' }))
  await page.goto("/setup")
  await expect(page.getByRole("heading", { name: "Authorize setup" })).toBeFocused()
  await page.screenshot({ path: "test-results/setup-authorize.png", fullPage: true })
  await page.getByLabel("Setup token").fill("never-store-this-token")
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page.getByLabel("Setup token")).toHaveValue("")
  await expect(page).not.toHaveURL(/never-store-this-token/)
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
})

test("owner validation is field-associated and confirmation is excluded from completion", async ({ page }) => {
  await reachOwner(page)
  await page.screenshot({ path: "test-results/setup-owner.png", fullPage: true })
  await page.getByRole("button", { name: "Create owner and workspace" }).click()
  await expect(page.getByText("Fix the errors below and try again.", { exact: true })).toBeFocused()
  await expect(page.getByLabel("Owner name")).toHaveAttribute("aria-invalid", "true")
  await fillOwner(page)
  let requestBody: Record<string, unknown> = {}
  await page.route("**/api/auth/setup/complete", async (route) => {
    requestBody = route.request().postDataJSON()
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "complete", recoveryCodes: fakeCodes }) })
  })
  await page.getByRole("button", { name: "Create owner and workspace" }).click()
  await expect(page.getByRole("heading", { name: "Recovery codes" })).toBeFocused()
  expect(Object.keys(requestBody).sort()).toEqual(["email", "name", "password", "workspaceName"])
})

test("recovery codes render once, require acknowledgement, copy, and disappear on refresh", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"])
  await reachOwner(page)
  await fillOwner(page)
  await page.route("**/api/auth/setup/complete", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "complete", recoveryCodes: fakeCodes }) }))
  await page.getByRole("button", { name: "Create owner and workspace" }).click()
  await expect(page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem")).toHaveCount(10)
  await page.screenshot({ path: "test-results/setup-recovery.png", fullPage: true })
  await expect(page.getByRole("button", { name: "Continue to login" })).toBeDisabled()
  await page.getByRole("button", { name: "Copy all codes" }).click()
  await expect(page.getByText("Copied.")).toBeVisible()
  expect((await page.evaluate(() => navigator.clipboard.readText())).replaceAll("\r\n", "\n")).toBe(`PlanGlade recovery codes\n${new URL(page.url()).origin}\n${fakeCodes.join("\n")}`)
  await page.reload()
  await expect(page.getByRole("heading", { name: "Authorize setup" })).toBeVisible()
  await expect(page.getByText(fakeCodes[0])).toBeHidden()
})

test("copy failure is announced without reading the clipboard", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: () => Promise.reject(new Error("denied")) } }))
  await reachOwner(page)
  await fillOwner(page)
  await page.route("**/api/auth/setup/complete", (route) => route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "complete", recoveryCodes: fakeCodes }) }))
  await page.getByRole("button", { name: "Create owner and workspace" }).click()
  await page.getByRole("button", { name: "Copy all codes" }).click()
  await expect(page.getByText("Copy failed. Select and copy the codes manually.")).toBeVisible()
})

test("print failures keep recovery codes visible without a download", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "open", { configurable: true, value: () => null }))
  await reachRecovery(page)
  await page.getByRole("button", { name: "Print codes" }).click()
  await expect(page.getByText("Print failed. Select and copy the codes manually.")).toBeVisible()
  await expect(page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem")).toHaveCount(10)
  await expect(page.getByRole("link", { name: /download/i })).toHaveCount(0)
})

test("a throwing print dialog keeps recovery codes visible", async ({ page }) => {
  await page.addInitScript(() => {
    const printDocument = document.implementation.createHTMLDocument()
    Object.defineProperty(window, "open", {
      configurable: true,
      value: () => ({ closed: false, opener: null, document: printDocument, print: () => { throw new Error("blocked") }, close: () => {} }),
    })
  })
  await reachRecovery(page)
  await page.getByRole("button", { name: "Print codes" }).click()
  await expect(page.getByText("Print failed. Select and copy the codes manually.")).toBeVisible()
  await expect(page.getByText(fakeCodes[0])).toBeVisible()
})

test("expired claim returns to authorization and clears passwords", async ({ page }) => {
  await reachOwner(page)
  await fillOwner(page)
  await page.route("**/api/auth/setup/complete", (route) => route.fulfill({ status: 410, contentType: "application/json", body: '{"error":{"code":"SETUP_CLAIM_EXPIRED"}}' }))
  await page.getByRole("button", { name: "Create owner and workspace" }).click()
  await expect(page.getByRole("heading", { name: "Authorize setup" })).toBeFocused()
  await expect(page.getByText("Your setup session expired. Enter the setup token again to continue.")).toBeVisible()
})

test("lost completion response fails closed with login guidance", async ({ page }) => {
  await reachOwner(page)
  await fillOwner(page)
  await page.route("**/api/auth/setup/complete", (route) => route.abort("failed"))
  await page.getByRole("button", { name: "Create owner and workspace" }).click()
  await expect(page.getByRole("heading", { name: "Setup may already be complete" })).toBeFocused()
  await expect(page.getByText("Setup may already be complete. Try signing in with the owner email and password you entered.")).toBeVisible()
})

test("refresh and Back do not restore token or owner passwords", async ({ page }) => {
  await reachOwner(page)
  await fillOwner(page)
  await page.reload()
  await expect(page.getByRole("heading", { name: "Authorize setup" })).toBeVisible()
  await expect(page.getByLabel("Setup token")).toHaveValue("")
  await page.goBack()
  await page.goForward()
  await expect(page.getByLabel("Setup token")).toHaveValue("")
})

test("320px keyboard-only setup reaches login without creating a session", async ({ page, context }) => {
  await page.setViewportSize({ width: 320, height: 700 })
  await routeDiscovery(page, { status: 200, body: { status: "available" } })
  await page.route("**/api/auth/setup/claim", (route) => route.fulfill({ status: 201, contentType: "application/json", body: '{"status":"claimed"}' }))
  let completionBody: Record<string, unknown> = {}
  await page.route("**/api/auth/setup/complete", async (route) => {
    completionBody = route.request().postDataJSON()
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ status: "complete", recoveryCodes: fakeCodes }) })
  })
  await page.goto("/setup")
  await expect(page.getByRole("heading", { name: "Authorize setup" })).toBeFocused()
  await page.keyboard.press("Tab")
  await page.keyboard.type("keyboard-token")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "Create the owner" })).toBeFocused()
  await page.keyboard.press("Tab")
  await page.keyboard.type("Setup Owner")
  await page.keyboard.press("Tab")
  await page.keyboard.type("owner@localhost")
  await page.keyboard.press("Tab")
  await page.keyboard.type("correct horse battery staple")
  await page.keyboard.press("Tab")
  await page.keyboard.type("correct horse battery staple")
  await page.keyboard.press("Tab")
  await page.keyboard.type("My workspace")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "Recovery codes" })).toBeFocused()
  expect(completionBody.email).toBe("owner@localhost")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Space")
  await page.keyboard.press("Tab")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText(fakeCodes[0])).toBeHidden()
  expect((await context.cookies()).some((cookie) => /(?:next-auth|authjs)\.session-token/.test(cookie.name))).toBe(false)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: "test-results/setup-mobile-320.png", fullPage: true })
})

test("an operator can set up an owner and continue to normal login", async ({ page, context }) => {
  const discovery = page.waitForResponse((response) => response.url().endsWith("/api/auth/setup") && response.request().method() === "GET")
  await page.goto("/login")
  expect((await discovery).status()).toBe(200)
  await expect(page.getByRole("link", { name: "Set up this self-hosted installation" })).toBeVisible()
  await page.getByRole("link", { name: "Set up this self-hosted installation" }).click()
  await page.getByLabel("Setup token").fill("a".repeat(64))
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await fillOwner(page)
  await page.getByRole("button", { name: "Create owner and workspace" }).click()
  await expect(page.getByRole("heading", { name: "Recovery codes" })).toBeVisible()
  await page.getByRole("checkbox", { name: "I saved these recovery codes. PlanGlade cannot show them again." }).check()
  await page.getByRole("button", { name: "Continue to login" }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText(/^[0-9a-f]{4}-/)).toBeHidden()
  await expect(page.getByRole("button", { name: "Continue with email" })).toHaveCount(0)
  expect((await context.cookies()).some((cookie) => /(?:next-auth|authjs)\.session-token/.test(cookie.name))).toBe(false)
})
