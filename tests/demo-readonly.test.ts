import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { NextRequest } from "next/server"

import { middleware } from "../middleware"

const root = process.cwd()
const demoMessage = "Demo mode — changes are disabled."

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("DEMO-READONLY-001: /demo is public, fixture-backed, and read-only", async () => {
  const [page, client, fixtures, sessionClient, shell] = await Promise.all([
    readProjectFile("src/app/demo/[[...slug]]/page.tsx"),
    readProjectFile("src/app/demo/[[...slug]]/demo-client.tsx"),
    readProjectFile("src/lib/demo-data.ts"),
    readProjectFile("src/lib/server-session-client.ts"),
    readProjectFile("src/components/lovable/shell.tsx"),
  ])

  assert.match(page, /<DemoClient/)
  for (const realSurface of ["HomePage", "WorkItemsPage", "ProjectsPageContent", "NotesPage", "CalendarPage"]) {
    assert.match(client, new RegExp(realSurface))
  }
  assert.doesNotMatch(client, /function DemoShell|function ProjectsView|function TasksView|function NotesView|function CalendarView/)
  assert.match(sessionClient, /DEMO_MODE_HEADER/)
  assert.match(sessionClient, /getDemoApiResponse/)
  assert.match(shell, /isDemoMode/)
  assert.match(shell, /DEMO_MODE_MESSAGE/)
  assert.match(fixtures, new RegExp(demoMessage))
  assert.doesNotMatch(fixtures, /PlanGlade Public Launch|planglade\.com|alex\.morgan@flowboard\.dev/i)
})

test("DEMO-REAL-UI-RESCUE-001: demo navigation stays under /demo", async () => {
  const [client, projectsPage, shell, commandPalette] = await Promise.all([
    readProjectFile("src/app/demo/[[...slug]]/demo-client.tsx"),
    readProjectFile("src/app/app/projects/projects-page-content.tsx"),
    readProjectFile("src/components/lovable/shell.tsx"),
    readProjectFile("src/components/lovable/command-palette.tsx"),
  ])

  assert.match(client, /\/demo\/tasks/)
  assert.match(client, /\/demo\/projects/)
  assert.match(client, /\/demo\/notes/)
  assert.match(client, /\/demo\/calendar/)
  assert.match(client, /<ProjectsPageContent projectId=\{id\} basePath="\/demo" \/>/)
  assert.match(projectsPage, /basePath = "\/app"/)
  assert.match(projectsPage, /\$\{basePath\}\/projects/)
  assert.match(shell, /routePrefix/)
  assert.match(shell, /basePath=\{routePrefix\}/)
  assert.match(commandPalette, /basePath = "\/app"/)
  assert.match(commandPalette, /scopedRoute\(APP_COMMAND_ROUTES\.tasks, basePath\)/)
})

test("DEMO-REAL-UI-RESCUE-001: public demo stays light without changing the saved app theme", async () => {
  const [client, css] = await Promise.all([
    readProjectFile("src/app/demo/[[...slug]]/demo-client.tsx"),
    readProjectFile("src/app/demo/[[...slug]]/demo.module.css"),
  ])

  assert.match(client, /demo\.module\.css/)
  assert.match(client, /className=\{styles\.root\}/)
  assert.match(css, /--color-card: var\(--card\)/)
  assert.match(css, /--color-background: var\(--background\)/)
  assert.doesNotMatch(client, /setTheme\(|localStorage|MutationObserver|document\.documentElement/)
})

test("DEMO-READONLY-001: demo fixtures cover broad non-tech-only projects", async () => {
  const fixtures = await readProjectFile("src/lib/demo-data.ts")

  for (const name of [
    "Small bakery launch",
    "Student thesis plan",
    "Home renovation",
    "Freelance client website",
    "Community event",
    "Open-source release",
  ]) {
    assert.match(fixtures, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  assert.doesNotMatch(fixtures, /profanity|edgy|private|password|secret|token/i)
})

test("DEMO-READONLY-001: demo-marked API mutations are blocked server-side", async () => {
  const request = new NextRequest("http://localhost/api/work-items", {
    method: "POST",
    headers: { "x-planglade-demo-mode": "true" },
  })

  const response = middleware(request)
  assert.equal(response?.status, 403)
  assert.deepEqual(await response?.json(), { error: demoMessage })
})

test("DEMO-READONLY-001: normal API requests are not blocked by the demo guard", () => {
  const request = new NextRequest("http://localhost/api/work-items", {
    method: "POST",
  })

  assert.equal(middleware(request), undefined)
})

test("DEMO-READONLY-001: landing points to the working demo route", async () => {
  const landing = await readProjectFile("src/app/landing/page.tsx")

  assert.match(landing, /const demoUrl = "\/demo"/)
  assert.match(landing, /Try demo/)
  assert.doesNotMatch(landing, /const demoStatusUrl = "#status"/)
})
