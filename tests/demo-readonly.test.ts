import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { NextRequest } from "next/server"

import { middleware } from "../middleware"

const root = process.cwd()
const demoMessage = "Demo mode - changes are disabled."
const originalEnv = {
  NODE_ENV: process.env.NODE_ENV,
  PLANGLADE_AUTH_MODE: process.env.PLANGLADE_AUTH_MODE,
  FLOWBOARD_AUTH_MODE: process.env.FLOWBOARD_AUTH_MODE,
  GITHUB_ID: process.env.GITHUB_ID,
  GITHUB_SECRET: process.env.GITHUB_SECRET,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
}

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

function restoreEnv() {
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
}

test("DEMO-READONLY-001: /demo is public, fixture-backed, and read-only", async () => {
  const [page, client, fixtures, sessionClient, shell] = await Promise.all([
    readProjectFile("src/app/demo/page.tsx"),
    readProjectFile("src/app/demo/demo-client.tsx"),
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

test("WEBSITE-POST-LIVE-AUDIT-001: demo metadata is read-only specific and noindexed", async () => {
  const [page, sitemap] = await Promise.all([
    readProjectFile("src/app/demo/page.tsx"),
    readProjectFile("src/app/sitemap.ts"),
  ])

  assert.match(page, /title:\s*"PlanGlade read-only demo"/)
  assert.match(page, /description:\s*"Browse PlanGlade with sample projects\. Demo mode - changes are disabled\."/)
  assert.match(page, /robots:\s*\{[\s\S]*index:\s*false/)
  assert.match(page, /follow:\s*false/)
  assert.match(page, /openGraph:\s*\{[\s\S]*title:\s*"PlanGlade read-only demo"/)
  assert.match(page, /twitter:\s*\{[\s\S]*card:\s*"summary_large_image"/)
  assert.match(page, /images:\s*\["\/brand\/og-image\.png"\]/)
  assert.doesNotMatch(sitemap, /"\/demo"/)
})

test("WEBSITE-POST-LIVE-AUDIT-001: app shell has skip link and demo disabled affordances", async () => {
  const [shell, css] = await Promise.all([
    readProjectFile("src/components/lovable/shell.tsx"),
    readProjectFile("src/app/demo/demo.module.css"),
  ])

  assert.match(shell, /href="#app-main"/)
  assert.match(shell, /id="app-main"/)
  assert.match(shell, /data-demo-banner="mobile"/)
  assert.match(shell, /data-demo-disabled=\{demoDisabled \? "true" : undefined\}/)
  assert.match(shell, /aria-disabled=\{demoDisabled\}/)
  assert.match(shell, /title=\{demoDisabled \? DEMO_MODE_MESSAGE/)
  assert.match(shell, /\[&_a\]:min-h-\[44px\] \[&_button\]:min-h-\[44px\] \[&_button\]:min-w-\[44px\]/)
  assert.match(css, /data-demo-disabled="true"/)
  assert.match(css, /cursor: not-allowed/)
})

test("DEMO-NAV-001: demo navigation omits Settings on desktop and mobile", async () => {
  const shell = await readProjectFile("src/components/lovable/shell.tsx")

  assert.doesNotMatch(
    shell,
    /isDemoMode \? \([\s\S]*?<span>Settings<\/span>[\s\S]*?APP_ROUTES\.settings/,
  )
  assert.doesNotMatch(
    shell,
    /if \(isDemoMode\) toast\(DEMO_MODE_MESSAGE\); else router\.push\(APP_ROUTES\.settings\)/,
  )
  assert.match(shell, /href=\{APP_ROUTES\.settings\}/)
})

test("DEMO-NAV-001: direct demo Settings resolves to the supported demo landing", async () => {
  const route = await readProjectFile("src/app/demo/settings/page.tsx")

  assert.match(route, /redirect\("\/demo"\)/)
})

test("DEMO-NAV-001: demo project mutation controls are disabled and cannot reach mutation handlers", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const controlsStart = source.indexOf('<div className="grid w-full grid-cols-2')
  const controlsEnd = source.indexOf('id="demo-read-only-notice"', controlsStart)
  const controls = source.slice(controlsStart, controlsEnd)

  assert.match(controls, /(?<!aria-)disabled=\{isDemoMode\}/g)
  assert.equal((controls.match(/(?<!aria-)disabled=\{isDemoMode\}/g) ?? []).length, 3)
  assert.match(controls, /aria-describedby=\{isDemoMode \? "demo-read-only-notice" : undefined\}/g)
  assert.equal((controls.match(/aria-describedby=\{isDemoMode \? "demo-read-only-notice" : undefined\}/g) ?? []).length, 3)
  assert.match(source, /id="demo-read-only-notice"[\s\S]*?DEMO_MODE_MESSAGE/)
  assert.match(source, /const createAndFocusTask[\s\S]*?if \(isDemoMode\) \{[\s\S]*?return;/)
  assert.match(source, /const patchProject[\s\S]*?if \(isDemoMode\) \{[\s\S]*?return;/)
  assert.match(source, /const destroyProject[\s\S]*?if \(isDemoMode\) \{[\s\S]*?return false;/)
})

test("DEMO-NAV-001: normal project mutation controls are not unconditionally disabled", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")

  assert.doesNotMatch(source, /disabled=\{true\}/)
  assert.match(source, /disabled=\{isDemoMode\}/g)
  assert.match(source, /onClick=\{isDemoMode \? undefined : \(\) => setEditingProjectId\(selectedProject\.id\)\}/)
  assert.match(source, /onClick=\{isDemoMode \? undefined : async \(\) => \{/)
})

test("DEMO-REAL-UI-RESCUE-001: demo navigation stays under /demo", async () => {
  const [client, homePage, projectsPage, shell, commandPalette] = await Promise.all([
    readProjectFile("src/app/demo/demo-client.tsx"),
    readProjectFile("src/app/app/page.tsx"),
    readProjectFile("src/app/app/projects/projects-page-content.tsx"),
    readProjectFile("src/components/lovable/shell.tsx"),
    readProjectFile("src/components/lovable/command-palette.tsx"),
  ])

  assert.match(client, /\/demo\/tasks/)
  assert.match(client, /\/demo\/projects/)
  assert.match(client, /\/demo\/notes/)
  assert.match(client, /\/demo\/calendar/)
  assert.match(client, /<HomePage basePath="\/demo" \/>/)
  assert.match(homePage, /basePath = "\/app"/)
  assert.match(homePage, /\$\{basePath\}\/tasks/)
  assert.match(homePage, /\$\{basePath\}\/inbox/)
  assert.match(homePage, /\$\{basePath\}\/notes/)
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
    readProjectFile("src/app/demo/demo-client.tsx"),
    readProjectFile("src/app/demo/demo.module.css"),
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

test("DEMO-FULL-ROUTE-SMOKE-001: Netlify Prisma client includes the function runtime engine", async () => {
  const schema = await readProjectFile("prisma/schema.prisma")

  assert.match(schema, /binaryTargets\s*=\s*\[[^\]]*"native"[^\]]*"rhel-openssl-3\.0\.x"/)
})

test("DEMO-FULL-ROUTE-SMOKE-001: Notes keeps programmatic navigation inside demo mode", async () => {
  const notesPage = await readProjectFile("src/app/app/notes/page.tsx")

  assert.match(notesPage, /usePathname/)
  assert.match(notesPage, /pathname\.startsWith\("\/demo"\) \? "\/demo" : "\/app"/)
  assert.match(notesPage, /router\.replace\(`\$\{routePrefix\}\/notes\?id=\$\{id\}`/)
})

test("DEMO-READONLY-001: normal API requests are not blocked by the demo guard", () => {
  const request = new NextRequest("http://localhost/api/work-items", {
    method: "POST",
  })

  assert.equal(middleware(request), undefined)
})

test("NETLIFY-LAUNCH-BLOCKERS-001: public-only production leaves demo routes public", () => {
  try {
    Reflect.set(process.env, "NODE_ENV", "production")
    process.env.PLANGLADE_AUTH_MODE = "nextauth"
    delete process.env.FLOWBOARD_AUTH_MODE
    delete process.env.GITHUB_ID
    delete process.env.GITHUB_SECRET
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET

    for (const route of ["/demo", "/demo/inbox", "/demo/tasks", "/demo/projects", "/demo/projects/bakery-launch", "/demo/notes", "/demo/calendar", "/demo/settings"]) {
      assert.equal(middleware(new NextRequest(`https://planglade.test${route}`)), undefined, `${route} must stay public`)
    }
  } finally {
    restoreEnv()
  }
})

test("NETLIFY-LAUNCH-BLOCKERS-001: public-only production redirects /app to landing", () => {
  try {
    Reflect.set(process.env, "NODE_ENV", "production")
    process.env.PLANGLADE_AUTH_MODE = "nextauth"
    delete process.env.FLOWBOARD_AUTH_MODE
    delete process.env.GITHUB_ID
    delete process.env.GITHUB_SECRET
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET

    const response = middleware(new NextRequest("https://planglade.test/app"))

    assert.equal(response?.status, 307)
    assert.equal(response?.headers.get("location"), "https://planglade.test/")
  } finally {
    restoreEnv()
  }
})

test("NETLIFY-LAUNCH-BLOCKERS-001: configured production auth can reach /app", () => {
  try {
    Reflect.set(process.env, "NODE_ENV", "production")
    process.env.PLANGLADE_AUTH_MODE = "nextauth"
    process.env.GITHUB_ID = "github-id"
    process.env.GITHUB_SECRET = "github-secret"

    assert.equal(middleware(new NextRequest("https://planglade.test/app")), undefined)
  } finally {
    restoreEnv()
  }
})

test("DEMO-READONLY-001: landing points to the working demo route", async () => {
  const landing = await readProjectFile("src/app/landing/page.tsx")

  assert.match(landing, /const demoUrl = "\/demo"/)
  assert.match(landing, /Try demo/)
  assert.doesNotMatch(landing, /const demoStatusUrl = "#status"/)
})
