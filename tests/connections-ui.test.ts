import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (filePath: string) => readFile(path.join(root, filePath), "utf8")

test("Connections canonical route keeps the recovered workspace graph data sources", async () => {
  const page = await read("src/app/app/connections/page.tsx")

  assert.doesNotMatch(page, /redirect\("\/app"\)/)
  assert.match(page, /getServerSession\(\)/)
  assert.match(page, /\/api\/projects/)
  assert.match(page, /\/api\/work-items/)
  assert.match(page, /\/api\/notes/)
  assert.match(page, /\/api\/work-item-relations/)
  assert.match(page, /applyWorkItemDependencyRelations/)
  assert.match(page, /tasks\?task=/)
  assert.match(page, /projects\//)
})

test("Connections includes an accessible inspector and relationship fallback", async () => {
  const page = await read("src/app/app/connections/page.tsx")

  assert.match(page, /Relationship text fallback/)
  assert.match(page, /selectedNode/)
  assert.match(page, /Open task/)
  assert.match(page, /Open project/)
  assert.doesNotMatch(page, /drag-to-connect/)
})

test("legacy Connections route redirects once to the canonical route", async () => {
  const legacy = await read("src/app/connections/page.tsx")
  assert.match(legacy, /redirect\("\/app\/connections"\)/)
  assert.doesNotMatch(legacy, /redirect\("\/app"\)/)
})

test("Connections layout stays responsive with an interactive graph and authoritative relationship text", async () => {
  const page = await read("src/app/app/connections/page.tsx")
  assert.match(page, /overflow-x-hidden/)
  assert.match(page, /md:grid-cols|lg:grid-cols/)
  assert.match(page, /data-connection-graph/)
  assert.match(page, /aria-label="Zoom in"/)
  assert.match(page, /aria-label="Fit to view"/)
  assert.match(page, /MAX_TASK_ROWS/)
  assert.match(page, /Relationship list/)
  assert.doesNotMatch(page, /ReactFlow|drag-to-connect/)
})

test("Connections keeps the recovered Work Map composition instead of a fixed task grid", async () => {
  const page = await read("src/app/app/connections/page.tsx")

  assert.match(page, /ProjectViewTitle/)
  assert.match(page, /Search graph/)
  assert.match(page, /Current project/)
  assert.match(page, /data-graph-edges="true"/)
  assert.match(page, /aria-label="Fit to view"/)
  assert.match(page, /Relationship text fallback/)
  assert.doesNotMatch(page, /buildConnectionsGraphModel/)
})

test("demo Connections uses fixture relationships without write controls", async () => {
  const [page, data, client] = await Promise.all([
    read("src/app/demo/connections/page.tsx"),
    read("src/lib/demo-data.ts"),
    read("src/app/demo/demo-client.tsx"),
  ])

  assert.match(page, /ConnectionsPage/)
  assert.match(data, /parentId:/)
  assert.match(data, /demoRelations/)
  assert.match(data, /BLOCKED_BY/)
  assert.match(data, /RELATES_TO/)
  assert.match(client, /\/demo\/connections/)
  assert.doesNotMatch(page, /create|update|delete/i)
})
