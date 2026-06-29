import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("Home does not advertise Project Docs as a primary context surface", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")

  assert.doesNotMatch(source, /Project docs/)
  assert.doesNotMatch(source, /project docs/)
  assert.doesNotMatch(source, /kind: "Doc"/)
})

test("Home project context links do not point to the removed docs section", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")

  assert.doesNotMatch(source, /section=docs/)
  assert.doesNotMatch(source, /projectHref\(doc\.projectId, "docs"\)/)
  assert.doesNotMatch(source, /section\?: "notes" \| "docs"/)
})

test("Home recent notes remain notes-backed and can link to project Notes", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")
  const recentContextStart = source.indexOf("const recentContext = useMemo")
  const recentContextEnd = source.indexOf("const completeWithUndo", recentContextStart)
  const recentContextSource = source.slice(recentContextStart, recentContextEnd)

  assert.match(recentContextSource, /recentNotes\.map/)
  assert.match(recentContextSource, /note\.projectId \? projectHref\(note\.projectId, "notes"\)/)
  assert.match(source, /title="Recent notes"/)
  assert.doesNotMatch(source, /Recent Context/)
  assert.match(source, /No recent notes\./)
  assert.match(source, /New notes will appear here\./)
})
