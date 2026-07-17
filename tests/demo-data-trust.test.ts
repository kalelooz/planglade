import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import { demoSession, getDemoFixtures } from "@/lib/demo-data"
import { getWorkspaceBootstrap } from "@/lib/workspace-bootstrap"

test("DEMO-DATA-TRUST-001: command palette selects canonical demo entities and keeps app state", async () => {
  const source = await readFile("src/components/lovable/command-palette.tsx", "utf8")
  const fixtures = getDemoFixtures(new Date("2026-07-17T12:00:00.000Z"))

  assert.match(source, /basePath === "\/demo" \? getDemoFixtures\(\) : null/)
  assert.match(source, /demoData\?\.projects \?\? storedProjects/)
  assert.match(source, /demoData\?\.tasks \?\? storedWorkItems/)
  assert.match(source, /demoData\?\.notes \?\? storedNotes/)
  assert.match(source, /`\$\{basePath\}\/projects\/\$\{encodeURIComponent\(project\.id\)\}`/)
  assert.match(source, /`\$\{basePath\}\/tasks\?task=\$\{encodeURIComponent\(item\.id\)\}`/)
  assert.match(source, /`\$\{basePath\}\/notes\?id=\$\{encodeURIComponent\(note\.id\)\}`/)

  assert.equal(fixtures.projects.find((project) => project.id === "bakery-launch")?.name, "Small bakery launch")
  assert.equal(fixtures.tasks.find((task) => task.id === "bakery-menu-print")?.title, "Approve opening menu card")
  assert.equal(fixtures.notes.find((note) => note.id === "bakery-opening-note")?.title, "Opening week checklist")
})

test("DEMO-DATA-TRUST-001: public bootstrap is canonical, fake, and database-free", async () => {
  const [librarySource, routeSource] = await Promise.all([
    readFile("src/lib/workspace-bootstrap.ts", "utf8"),
    readFile("src/app/api/workspace/bootstrap/route.ts", "utf8"),
  ])
  const source = `${librarySource}\n${routeSource}`
  const now = new Date("2026-07-17T12:00:00.000Z")
  const fixtures = getDemoFixtures(now)
  const payload = getWorkspaceBootstrap(now)

  assert.equal(payload.generatedAt, now.toISOString())
  assert.deepEqual(payload.workspace, { ...demoSession.workspace, mode: "demo" })
  assert.deepEqual(payload.data.projects, fixtures.projects)
  assert.deepEqual(payload.data.workItems, fixtures.tasks)
  assert.deepEqual(payload.data.notes, fixtures.notes)
  assert.deepEqual(payload.data.activity, [])
  assert.deepEqual(payload.counts, {
    projects: fixtures.projects.length,
    workItems: fixtures.tasks.length,
    notes: fixtures.notes.length,
    activityEvents: 0,
  })
  assert.doesNotMatch(source, /@\/lib\/(?:db|mock-data)|@prisma|PrismaClient|\bdb\./)
  assert.doesNotMatch(JSON.stringify(payload), /ws-local-seed|PlanGlade Public Launch|launch-readiness|Docker quickstart/i)
})

test("DEMO-DATA-TRUST-001: existing demo surfaces remain on canonical fixtures", async () => {
  const sources = await Promise.all([
    "src/components/lovable/shell.tsx",
    "src/app/app/page.tsx",
    "src/app/app/tasks/page.tsx",
    "src/app/board/board-page-content.tsx",
    "src/app/app/calendar/page.tsx",
    "src/app/app/projects/projects-page-content.tsx",
    "src/app/app/notes/page.tsx",
    "src/lib/server-session-client.ts",
  ].map((file) => readFile(file, "utf8")))

  for (const source of sources) assert.match(source, /getDemoFixtures|getDemoApiResponse/)
})
