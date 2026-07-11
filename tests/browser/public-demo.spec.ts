import { expect, test as base, type APIResponse } from "@playwright/test"

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

async function expectJson(response: APIResponse) {
  expect(response.headers()["content-type"]).toContain("application/json")
  const body = await response.json()
  expect(body).toEqual(expect.any(Object))
  expect(await response.text()).not.toContain("Internal Server Error")
  return body
}

test("public landing, demo navigation, and sign-in fallback stay trustworthy", async ({
  page,
  applicationErrors,
}) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "A calm clearing for your projects." })).toBeVisible()
  await expect(page.getByText("Self-host now. Cloud soon.", { exact: true })).toBeVisible()

  await page.goto("/demo")
  await expect(page.getByRole("link", { name: "Small bakery launch", exact: true })).toBeVisible()
  await expect(
    page.getByRole("banner").getByText("Demo mode - changes are disabled.", { exact: true })
  ).toBeVisible()

  for (const [label, path] of [
    ["Inbox", "/demo/inbox"],
    ["Tasks", "/demo/tasks"],
    ["Projects", "/demo/projects"],
    ["Notes", "/demo/notes"],
    ["Calendar", "/demo/calendar"],
  ] as const) {
    const navigation = page.getByRole("navigation")
    const link = navigation.getByRole("link", {
      name: label === "Inbox" ? /^Inbox\b/ : label,
      exact: label !== "Inbox",
    })
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${path}$`))
  }

  await page.goto("/demo/projects/bakery-launch")
  await expect(page.getByRole("heading", { name: "Small bakery launch", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "New task", exact: true })).toHaveAttribute(
    "aria-disabled",
    "true"
  )
  await expect(page.getByRole("button", { name: "Edit", exact: true })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled()

  await page.goto("/demo/settings")
  await expect(page).toHaveURL(/\/demo$/)

  await page.goto("/login")
  await expect(page.getByText("Ask the workspace owner to configure Google sign-in before continuing.")).toBeVisible()
  await expect(page.getByText("Loading sign-in...", { exact: true })).toHaveCount(0)
  expect(applicationErrors).toEqual([])
})

test("public API contracts remain structured when providers are unavailable", async ({ request }) => {
  const health = await request.get("/api/health")
  expect([200, 503]).toContain(health.status())
  const healthBody = await expectJson(health)
  expect(["ok", "degraded"]).toContain(healthBody.status)

  const session = await request.get("/api/auth/session")
  expect(session.status()).toBe(401)
  const sessionBody = await expectJson(session)
  expect(sessionBody.error).toEqual(expect.any(String))

  const projects = await request.get("/api/projects?workspaceId=browser-smoke")
  expect(projects.status()).toBe(401)
  const projectsBody = await expectJson(projects)
  expect(projectsBody.error).toEqual(expect.any(String))
})
