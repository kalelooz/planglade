import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readSettingsSource() {
  return readFile(path.join(root, "src/app/app/settings/page.tsx"), "utf8")
}

function normalImportBlock(source: string) {
  const start = source.indexOf('<Field label="PlanGlade import"')
  const end = source.indexOf("{isDevelopment &&", start)
  assert.notEqual(start, -1)
  assert.notEqual(end, -1)
  return source.slice(start, end)
}

test("Settings Data shows guarded import in the normal Data area", async () => {
  const source = await readSettingsSource()
  const block = normalImportBlock(source)

  assert.match(source, /section === "Data"/)
  assert.match(block, /PlanGlade import/)
  assert.match(block, /Choose JSON to preview/)
  assert.match(block, /Import into this workspace/)
})

test("guided import calls preview before merge import", async () => {
  const source = await readSettingsSource()
  const block = normalImportBlock(source)

  assert.match(source, /previewGuidedImport[\s\S]*\/api\/workspace\/import-preview/)
  assert.match(source, /runGuidedImport[\s\S]*\/api\/workspace\/import-local/)
  assert.match(block, /void previewGuidedImport\(file\)/)
  assert.match(block, /void runGuidedImport\(\)/)
})

test("guided import renders counts and warnings from preview", async () => {
  const block = normalImportBlock(await readSettingsSource())

  assert.match(block, /guidedImportPreview\.counts\.projects/)
  assert.match(block, /guidedImportPreview\.counts\.tasks/)
  assert.match(block, /guidedImportPreview\.counts\.notes/)
  assert.match(block, /guidedImportPreview\.counts\.projectDocs/)
  assert.match(block, /guidedImportPreview\.counts\.settings/)
  assert.match(block, /guidedImportPreview\.counts\.archivedProjectDocs/)
  assert.match(block, /guidedImportPreview\.warnings/)
  assert.match(block, /Possible duplicates found/)
  assert.match(block, /simple name and title matches only/)
  assert.match(block, /may be skipped, merged, or imported/)
})

test("guided import disables final import until preview and confirmation", async () => {
  const source = await readSettingsSource()
  const block = normalImportBlock(source)

  assert.match(source, /guidedImportPreviewIsCurrent[\s\S]*guidedImportFileKey === guidedImportPreviewFileKey/)
  assert.match(source, /if \(!workspaceId \|\| !guidedImportPreview \|\| !guidedImportSnapshot \|\| !guidedImportConfirm \|\| !canRunGuidedImport\)/)
  assert.match(block, /checked={guidedImportConfirm}/)
  assert.match(block, /disabled={!canRunGuidedImport}/)
})

test("guided import resets confirmation when a new file preview starts", async () => {
  const source = await readSettingsSource()

  assert.match(source, /previewGuidedImport[\s\S]*setGuidedImportConfirm\(false\)/)
  assert.match(source, /previewGuidedImport[\s\S]*setGuidedImportPreview\(null\)/)
  assert.match(source, /previewGuidedImport[\s\S]*setGuidedImportPreviewFileKey\(null\)/)
  assert.match(source, /setGuidedImportPreviewFileKey\(getGuidedImportFileKey\(file\)\)/)
})

test("guided import prevents immediate repeated import of the same file", async () => {
  const source = await readSettingsSource()
  const block = normalImportBlock(source)

  assert.match(source, /lastGuidedImportFileKey/)
  assert.match(source, /setLastGuidedImportFileKey\(guidedImportFileKey\)/)
  assert.match(source, /guidedImportSameFileJustImported/)
  assert.match(block, /This file was just imported/)
})

test("normal guided import exposes merge only and no destructive tools", async () => {
  const source = await readSettingsSource()
  const block = normalImportBlock(source)

  assert.match(source, /mode: "append"/)
  assert.doesNotMatch(block, /replace/i)
  assert.doesNotMatch(block, /wipe/i)
  assert.doesNotMatch(block, /reset/i)
  assert.doesNotMatch(block, /CSV/)
  assert.doesNotMatch(block, /Local migration/)
})

test("guided import shows safe error and success states", async () => {
  const block = normalImportBlock(await readSettingsSource())

  assert.match(block, /guidedImportError/)
  assert.match(block, /guidedImportSummary/)
  assert.match(block, /Import merged/)
})

test("Settings layout stacks the section rail on narrow screens", async () => {
  const source = await readSettingsSource()

  assert.match(source, /flex h-full min-w-0 flex-col overflow-y-auto md:flex-row/)
  assert.match(source, /shrink-0 border-b bg-sidebar\/40 p-4 md:m-4 md:mr-0 md:w-60 md:rounded-xl md:border md:border-b/)
  assert.match(source, /flex gap-1 overflow-x-auto md:block md:space-y-1 md:overflow-visible/)
  assert.match(source, /grid grid-cols-1 gap-3 border-b pb-5 sm:grid-cols-\[180px_1fr\] sm:gap-6/)
})
