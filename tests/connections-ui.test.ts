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

  assert.match(page, /aria-label="Relationship list"/)
  assert.match(page, /Interactive relationship graph/)
  assert.match(page, /Select \$\{node\.type\}/)
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
  assert.match(page, /aria-label="Fit graph to view"/)
  assert.match(page, /MIN_ZOOM = 0\.25/)
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
  assert.match(page, /aria-label="Fit graph to view"/)
  assert.match(page, /aria-label="Relationship list"/)
  assert.doesNotMatch(page, /buildConnectionsGraphModel/)
})

test("Connections restores historical inline relationship tags and focused edge colors", async () => {
  const page = await read("src/app/app/connections/page.tsx")

  assert.match(page, /showRelationshipLabels/)
  assert.match(page, /Show labels/)
  assert.match(page, /data-relationship-edge-label="true"/)
  assert.match(page, /function edgeLabel\(edge: GraphEdge\)/)
  assert.match(page, /TYPE_STYLE\[focusNode\.type\]\.edge/)
  assert.match(page, /edge: "rgb\(29 78 216\)"/)
  assert.match(page, /edge: "rgb\(109 40 217\)"/)
})

test("Connections keeps parent links, exact direction text, and honest async states", async () => {
  const page = await read("src/app/app/connections/page.tsx")

  assert.match(page, /type: "hierarchy"/)
  assert.match(page, /return "has child"/)
  assert.match(page, /label: "BLOCKS"/)
  assert.match(page, /Unable to load connections/)
  assert.match(page, /No connections found/)
  assert.doesNotMatch(page, /edges\.slice\(0, 10\)/)
})

test("Connections clears hidden selection state when filters change", async () => {
  const page = await read("src/app/app/connections/page.tsx")

  assert.match(page, /visibleNodeIds/)
  assert.match(page, /!visibleNodeIds\.has\(selectedId\)/)
  assert.match(page, /!visibleNodeIds\.has\(hoveredId\)/)
})

test("relationship reads allow viewers and reject cross-workspace endpoints", async () => {
  const route = await read("src/app/api/work-item-relations/route.ts")
  const getHandler = route.slice(route.indexOf("export async function GET"), route.indexOf("export async function POST"))

  assert.match(getHandler, /"VIEWER"/)
  assert.match(getHandler, /source: \{ is: \{ workspaceId: query\.data\.workspaceId \} \}/)
  assert.match(getHandler, /target: \{ is: \{ workspaceId: query\.data\.workspaceId \} \}/)
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
