import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (filePath: string) => readFile(path.join(root, filePath), "utf8")

test("Connections canonical route renders a supported relationship surface", async () => {
  const page = await read("src/app/app/connections/page.tsx")

  assert.doesNotMatch(page, /redirect\("\/app"\)/)
  assert.match(page, /buildConnectionsModel/)
  assert.match(page, /Loading connections/)
  assert.match(page, /No connections yet/)
  assert.match(page, /Unable to load connections/)
  assert.match(page, /You do not have access to these connections/)
  assert.match(page, /connection\.label/)
  assert.match(page, /tasks\?task=/)
  assert.match(page, /projects\//)
})

test("legacy Connections route redirects once to the canonical route", async () => {
  const legacy = await read("src/app/connections/page.tsx")
  assert.match(legacy, /redirect\("\/app\/connections"\)/)
  assert.doesNotMatch(legacy, /redirect\("\/app"\)/)
})

test("Connections layout stays responsive and exposes relationship text", async () => {
  const page = await read("src/app/app/connections/page.tsx")
  assert.match(page, /overflow-x-hidden/)
  assert.match(page, /md:grid-cols|lg:grid-cols/)
  assert.match(page, /aria-live/)
  assert.doesNotMatch(page, /ReactFlow|canvas|drag-to-connect|zoom/)
})

test("demo Connections uses fixture relationships without write controls", async () => {
  const [page, data, client] = await Promise.all([
    read("src/app/demo/connections/page.tsx"),
    read("src/lib/demo-data.ts"),
    read("src/app/demo/demo-client.tsx"),
  ])

  assert.match(page, /ConnectionsPageContent/)
  assert.match(page, /basePath="\/demo"/)
  assert.match(data, /parentId:/)
  assert.match(data, /demoRelations/)
  assert.match(data, /BLOCKED_BY/)
  assert.match(client, /\/demo\/connections/)
  assert.doesNotMatch(page, /create|update|delete/i)
})
