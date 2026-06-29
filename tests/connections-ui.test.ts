import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

// SCOPE-FREEZE-001: Connections/Work Map is a deferred product surface for the
// solo-first MVP. Both the canonical and legacy routes must redirect to /app
// instead of rendering a full relationship-graph product surface.
test("Connections canonical and legacy routes redirect to /app", async () => {
  const [canonical, legacy] = await Promise.all([
    readProjectFile("src/app/app/connections/page.tsx"),
    readProjectFile("src/app/connections/page.tsx"),
  ])

  assert.match(canonical, /redirect\("\/app"\)/)
  assert.match(legacy, /redirect\("\/app"\)/)
})

test("Connections no longer renders the graph product surface", async () => {
  const canonical = await readProjectFile("src/app/app/connections/page.tsx")

  assert.doesNotMatch(canonical, /getServerSession\(\)/)
  assert.doesNotMatch(canonical, /data-connection-graph="true"/)
  assert.doesNotMatch(canonical, /EDGE_STYLES/)
  assert.doesNotMatch(canonical, /TYPE_STYLE/)
})
