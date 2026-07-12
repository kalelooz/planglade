import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { NextRequest } from "next/server"

import nextConfig from "../next.config"
import { middleware } from "../middleware"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

const canonicalAppPages = [
  "src/app/app/page.tsx",
  "src/app/app/inbox/page.tsx",
  "src/app/app/tasks/page.tsx",
  "src/app/app/projects/page.tsx",
  "src/app/app/projects/[projectId]/page.tsx",
  "src/app/app/notes/page.tsx",
  "src/app/app/calendar/page.tsx",
  "src/app/app/settings/page.tsx",
]

test("public landing owns root and authenticated pages exist under /app", async () => {
  const rootPage = await readProjectFile("src/app/page.tsx")

  assert.match(rootPage, /from "\.\/landing\/page"/)
  await Promise.all(canonicalAppPages.map((filePath) => access(path.join(root, filePath))))
})

test("NETLIFY-LAUNCH-BLOCKERS-001: root stays public while cloud login is disabled", async () => {
  const rootPage = await readProjectFile("src/app/page.tsx")

  assert.doesNotMatch(rootPage, /getServerSession/)
  assert.doesNotMatch(rootPage, /authOptions/)
  assert.doesNotMatch(rootPage, /getConfiguredAuthMode/)
  assert.doesNotMatch(rootPage, /redirect\("\/app"\)/)
  assert.doesNotMatch(rootPage, /dynamic = "force-dynamic"/)
})

test("LANDING-RESTORE-001: root bypasses middleware and renders the full landing route", async () => {
  const response = middleware(new NextRequest("https://planglade.test/"))
  const middlewareSource = await readProjectFile("middleware.ts")

  assert.equal(response, undefined)
  assert.doesNotMatch(middlewareSource, /ROOT_LANDING_HTML|<h1>PlanGlade<\/h1>|Self-host<\/a>/)
})

test("ROOT-REDIRECT-1: root still renders landing for unauthenticated visitors", async () => {
  const rootPage = await readProjectFile("src/app/page.tsx")

  assert.match(rootPage, /import LandingPage/)
  assert.match(rootPage, /return <LandingPage \/>/)
})

test("ROOT-REDIRECT-1: /landing remains the public static landing page", async () => {
  const landingPage = await readProjectFile("src/app/landing/page.tsx")

  assert.match(landingPage, /export const metadata/)
  assert.doesNotMatch(landingPage, /getServerSession/)
  assert.doesNotMatch(landingPage, /redirect\("\/app"\)/)
})

test("ROOT-REDIRECT-1: gated and deferred route guards stay scoped outside root", async () => {
  const rootPage = await readProjectFile("src/app/page.tsx")

  assert.doesNotMatch(rootPage, /\/team|\/activity|\/timeline|\/connections/)
  assert.doesNotMatch(rootPage, /\/api\//)
})

test("legacy public and authenticated routes redirect to canonical paths", async () => {
  assert.ok(nextConfig.redirects)
  const redirects = await nextConfig.redirects()

  const expectedRedirects = new Map([
    ["/landing", "/"],
    ["/inbox", "/app/inbox"],
    ["/tasks", "/app/tasks"],
    ["/notes", "/app/notes"],
    ["/calendar", "/app/calendar"],
    ["/settings", "/app/settings"],
    ["/board", "/app/tasks?view=board"],
    ["/my-tasks", "/app/tasks?filter=mine"],
  ])

  for (const [source, destination] of expectedRedirects) {
    assert.ok(
      redirects.some((redirect) => redirect.source === source && redirect.destination === destination),
      `Missing redirect ${source} -> ${destination}`
    )
  }

})

test("legacy project query links become clean canonical project paths", async () => {
  const { buildLegacyProjectsDestination } = await import("../src/lib/legacy-route-redirects")

  assert.equal(buildLegacyProjectsDestination({ project: "project-123" }), "/app/projects/project-123")
  assert.equal(
    buildLegacyProjectsDestination({ project: "project-123", section: "docs" }),
    "/app/projects/project-123?section=docs"
  )
  assert.equal(buildLegacyProjectsDestination({ new: "1" }), "/app/projects?new=1")
})

test("primary navigation and auth defaults use canonical app routes", async () => {
  const [shell, commandPalette, login, onboarding, authContext] = await Promise.all([
    readProjectFile("src/components/lovable/shell.tsx"),
    readProjectFile("src/components/lovable/command-palette.tsx"),
    readProjectFile("src/components/lovable/login-page.tsx"),
    readProjectFile("src/app/onboarding/page.tsx"),
    readProjectFile("src/components/lovable/auth-context.tsx"),
  ])

  for (const route of ["/app", "/app/inbox", "/app/tasks", "/app/projects", "/app/notes", "/app/calendar", "/app/connections", "/app/settings"]) {
    assert.ok(shell.includes(`\"${route}\"`), `Shell is missing ${route}`)
  }

  for (const route of ["/app", "/app/inbox", "/app/tasks", "/app/projects", "/app/notes", "/app/calendar", "/app/connections", "/app/settings"]) {
    assert.ok(commandPalette.includes(`\"${route}\"`), `Command palette is missing ${route}`)
  }

  assert.match(shell, /label: "Connections"/)
  assert.match(commandPalette, /Go to Connections|\/app\/connections/)

  assert.match(login, /searchParams\.get\("next"\) \|\| "\/app"/)
  assert.match(onboarding, /searchParams\.get\("next"\) \|\| "\/app"/)
  assert.match(authContext, /callbackUrl: nextPath \?\? "\/app"/)
})

// SCOPE-FREEZE-001 regression guards: still-deferred product surfaces must not appear
// in primary navigation, command palette, or shell scope helpers, and must not
// be reachable as full product pages.
test("SCOPE-FREEZE-001: deferred routes are not present in MVP nav, command palette, or shell helpers", async () => {
  const [shell, commandPalette] = await Promise.all([
    readProjectFile("src/components/lovable/shell.tsx"),
    readProjectFile("src/components/lovable/command-palette.tsx"),
  ])

  const deferredRoutePatterns = [
    /\/team\b/,
    /\/activity\b/,
    /\/timeline\b/,
    /label: "Team"/,
    /label: "Activity"/,
    /label: "Timeline"/,
    /label: "Reports"/,
    /label: "Work Map"/,
  ]

  for (const pattern of deferredRoutePatterns) {
    assert.doesNotMatch(shell, pattern, `Shell should not reference deferred route: ${pattern}`)
    assert.doesNotMatch(commandPalette, pattern, `Command palette should not reference deferred route: ${pattern}`)
  }

  // Scope helper must only point at project-scoped routes.
  const scopedRoutesMatch = shell.match(/const scopedRoutes = \[[^\]]*\]/)
  assert.ok(scopedRoutesMatch, "scopedRoutes helper should exist")
  assert.doesNotMatch(scopedRoutesMatch[0], /\/timeline/)
  assert.doesNotMatch(scopedRoutesMatch[0], /\/connections/)

  // No shell action should push to /activity.
  assert.doesNotMatch(shell, /router\.push\("\/activity"\)/)
  assert.doesNotMatch(shell, /router\.push\('\/activity'\)/)
})

test("SCOPE-FREEZE-001: deferred routes redirect to /app instead of rendering product surfaces", async () => {
  const deferredRoutes = [
    "src/app/team/page.tsx",
    "src/app/activity/page.tsx",
    "src/app/timeline/page.tsx",
  ]

  for (const filePath of deferredRoutes) {
    const source = await readProjectFile(filePath)
    assert.match(source, /redirect\("\/app"\)/, `${filePath} should redirect to /app`)
    // Must not render the full product surface anymore.
    assert.doesNotMatch(source, /getServerSession\(\)/, `${filePath} must not bootstrap a session/product surface`)
  }
})

test("SCOPE-FREEZE-001: legacy redirect destinations for deferred routes point at /app", async () => {
  assert.ok(nextConfig.redirects)
  const redirects = await nextConfig.redirects()

  const deferredRedirectSources = ["/graph-view", "/activity-log"]
  for (const source of deferredRedirectSources) {
    const match = redirects.find((redirect) => redirect.source === source)
    assert.ok(match, `Missing redirect for ${source}`)
    assert.equal(match.destination, "/app", `${source} should redirect to /app, got ${match.destination}`)
  }
})
