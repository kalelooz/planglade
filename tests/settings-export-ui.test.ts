import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSettingsSource() {
  return readFile(path.join(root, "src/app/app/settings/page.tsx"), "utf8")
}

function exportBlock(source: string) {
  const start = source.indexOf('<Field label="PlanGlade export"')
  const end = source.indexOf('<Field label="PlanGlade import"', start)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  return source.slice(start, end)
}

test("Settings Data exposes workspace JSON export action", async () => {
  const source = await readSettingsSource()
  const block = exportBlock(source)

  assert.match(source, /section === "Data"/)
  assert.match(block, /PlanGlade export/)
  assert.match(block, /Download JSON/)
  assert.match(block, /workspace-owned projects, tasks, inbox captures, notes, labels/)
  assert.match(block, /Auth, session, password, and provider token data are never included/)
  assert.match(block, /workspaceExportBusy/)
  assert.match(block, /Downloading\.\.\./)
  assert.match(block, /workspaceExportMessage/)
  assert.match(block, /workspaceExportError/)
})

test("Settings export downloads the required workspace JSON filename", async () => {
  const source = await readSettingsSource()

  assert.match(source, /\/api\/workspace\/export\?workspaceId=/)
  assert.doesNotMatch(source, /\/api\/workspace\/export\?workspaceId=.*userId=/)
  assert.match(source, /const fileName = `planglade-workspace-\$\{new Date\(\)\.toISOString\(\)\.slice\(0, 10\)\}\.json`/)
  assert.match(source, /a\.download = fileName/)
})
