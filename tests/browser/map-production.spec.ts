import { mkdir } from "node:fs/promises"
import path from "node:path"

import { expect, test as base, type APIRequestContext } from "@playwright/test"

const test = base.extend<{ applicationErrors: string[] }>({
  applicationErrors: async ({ page }, consume) => {
    const errors: string[] = []
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(`${message.text()} (${message.location().url})`)
    })
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("response", (response) => {
      if (response.status() >= 500) errors.push(`${response.status()} ${response.url()}`)
    })

    await consume(errors)
    expect(errors).toEqual([])
  },
})

test.skip(process.env.PLANGLADE_BROWSER_MAP_UI !== "true", "Runs only in the Map browser harness")
test.describe.configure({ mode: "serial" })
test.setTimeout(90_000)

async function seedWorkspace(request: APIRequestContext) {
  let sessionResponse = await request.get("/api/auth/session")
  await expect
    .poll(
      async () => {
        if (sessionResponse.status() !== 200) {
          sessionResponse = await request.get("/api/auth/session")
        }
        return sessionResponse.status()
      },
      { timeout: 20_000 },
    )
    .toBe(200)
  const session = (await sessionResponse.json()) as {
    user: { id: string }
    workspace: { id: string }
  }
  const headers = {
    "content-type": "application/json",
    "x-flowboard-user-id": session.user.id,
  }

  const projectResponse = await request.post("/api/projects", {
    headers,
    data: {
      workspaceId: session.workspace.id,
      name: "Map launch",
      slug: "map-launch",
      color: "#4f766b",
    },
  })
  expect(projectResponse.status()).toBe(201)
  const project = (await projectResponse.json()) as { project: { id: string } }

  const taskBodies = [
    {
      workspaceId: session.workspace.id,
      projectId: project.project.id,
      title: "Shape the production Map",
      status: "IN_PROGRESS",
      priority: "HIGH",
    },
    {
      workspaceId: session.workspace.id,
      projectId: project.project.id,
      title: "Verify saved positions",
      status: "BACKLOG",
      priority: "MEDIUM",
    },
    {
      workspaceId: session.workspace.id,
      title: "Triage without a project",
      status: "BACKLOG",
      priority: "LOW",
    },
  ]
  const tasks: Array<{ id: string }> = []
  for (const body of taskBodies) {
    const response = await request.post("/api/work-items", { headers, data: body })
    expect(response.status()).toBe(201)
    const payload = (await response.json()) as { workItem: { id: string } }
    tasks.push(payload.workItem)
  }

  return {
    workspaceId: session.workspace.id,
    userId: session.user.id,
    projectId: project.project.id,
    taskIds: tasks.map((task) => task.id),
  }
}

test("production Map saves layout and preserves surrounding product behavior", async ({
  page,
  request,
  applicationErrors,
}) => {
  const seeded = await seedWorkspace(request)
  const captureScreenshots = process.env.PLANGLADE_CAPTURE_MAP_SCREENSHOTS === "true"
  const screenshotDirectory = path.resolve("docs", "assets", "map-production")
  if (captureScreenshots) await mkdir(screenshotDirectory, { recursive: true })

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto("/")
  await page.evaluate(() => localStorage.setItem("theme", "light"))
  await page.goto("/app/tasks?view=map")

  const map = page.locator("[data-task-map]")
  await expect(map).toBeVisible()
  await expect(page.locator("[data-task-map-node]")).toHaveCount(3)
  await expect(page.getByLabel("Choose workspace or project Map")).toHaveValue("")
  await expect(page.getByLabel("Filter Map by completion or status")).toHaveValue("open")
  await expect(page.getByText("Layout saved", { exact: true })).toBeVisible()
  if (captureScreenshots) {
    await page.screenshot({
      path: path.join(screenshotDirectory, "map-workspace-light.png"),
      fullPage: true,
    })
  }

  const taskNode = page.locator(`[data-task-map-node="${seeded.taskIds[0]}"]`)
  const taskNodeBox = await taskNode.boundingBox()
  expect(taskNodeBox).not.toBeNull()
  await page.mouse.move(taskNodeBox!.x + taskNodeBox!.width / 2, taskNodeBox!.y + taskNodeBox!.height / 2)
  await page.mouse.down()
  await page.mouse.move(taskNodeBox!.x + taskNodeBox!.width / 2 + 120, taskNodeBox!.y + taskNodeBox!.height / 2 + 60, {
    steps: 8,
  })
  await page.mouse.up()
  await expect(page.getByText("Save layout", { exact: true })).toBeVisible()
  await page.getByText("Save layout", { exact: true }).click()
  await expect(page.getByText("Saved", { exact: true })).toBeVisible()

  const mapResponse = await request.get(`/api/map?workspaceId=${encodeURIComponent(seeded.workspaceId)}`, {
    headers: { "x-flowboard-user-id": seeded.userId },
  })
  expect(mapResponse.status()).toBe(200)
  const persistedMap = (await mapResponse.json()) as {
    revision: number
    taskPlacements: Array<{ workItemId: string; x: number; y: number }>
  }
  expect(persistedMap.revision).toBe(1)
  expect(
    persistedMap.taskPlacements.some((placement) => placement.workItemId === seeded.taskIds[0]),
  ).toBe(true)

  await page.reload()
  await expect(page.locator(`[data-task-map-node="${seeded.taskIds[0]}"]`)).toBeVisible()
  await expect(page.getByText("Layout saved", { exact: true })).toBeVisible()

  await page.evaluate(() => localStorage.setItem("theme", "dark"))
  await page.reload()
  await expect(page.locator("html")).toHaveClass(/dark/)
  await expect(map).toBeVisible()
  await expect(page.getByText("Layout saved", { exact: true })).toBeVisible()
  if (captureScreenshots) {
    await page.screenshot({
      path: path.join(screenshotDirectory, "map-workspace-dark.png"),
      fullPage: true,
    })
  }

  await page.goto("/app/connections")
  await expect(page.getByRole("heading", { name: "Connections", exact: true })).toBeVisible()
  await expect(page.getByLabel("Interactive relationship graph")).toBeVisible()

  await page.goto("/demo/tasks?view=map")
  await expect(page.locator("[data-task-map]")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Map", exact: true })).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "Tasks", exact: true })).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/app/tasks?view=map")
  await expect(page.locator("[data-task-map-mobile-fallback]")).toBeVisible()
  await expect(page.getByRole("link", { name: "Open task list", exact: true })).toBeVisible()
  await expect(page.locator(".react-flow")).toHaveCount(0)
  if (captureScreenshots) {
    await page.screenshot({
      path: path.join(screenshotDirectory, "map-mobile-fallback.png"),
      fullPage: true,
    })
  }

  expect(applicationErrors).toEqual([])
})
