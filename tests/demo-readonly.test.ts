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
  const [page, client, fixtures] = await Promise.all([
    readProjectFile("src/app/demo/page.tsx"),
    readProjectFile("src/app/demo/demo-client.tsx"),
    readProjectFile("src/lib/demo-data.ts"),
  ])

  assert.match(page, /<DemoClient/)
  assert.match(client, new RegExp(demoMessage))
  assert.match(client, /blockedDemoAction/)
  assert.doesNotMatch(client, /apiFetch|getServerSession|fetch\(["']\/api/)
  assert.doesNotMatch(fixtures, /PlanGlade Public Launch|planglade\.com|alex\.morgan@flowboard\.dev/i)
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
