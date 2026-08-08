import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const tasksPagePath = path.join(root, "src/app/app/tasks/page.tsx")
const workItemRowPath = path.join(root, "src/components/lovable/work-item-row.tsx")

test("Tasks row gives the title the flexible desktop column", async () => {
  const row = await readFile(workItemRowPath, "utf8")

  assert.match(row, /grid-cols-\[auto_minmax\(0,1fr\)\]/)
  assert.match(row, /sm:grid-cols-\[auto_minmax\(22rem,1fr\)_96px_minmax\(7rem,9rem\)_112px_32px\]/)
  assert.doesNotMatch(row, /flex-\[1_1_18rem\]/)
  assert.doesNotMatch(row, /w-\[(?:12|14|16|18|20)rem\]/)
})

test("Tasks list avoids horizontal scrolling in the row surface", async () => {
  const tasksPage = await readFile(tasksPagePath, "utf8")
  const row = await readFile(workItemRowPath, "utf8")

  assert.match(tasksPage, /max-w-6xl overflow-x-hidden/)
  assert.doesNotMatch(row, /overflow-x-auto|overflow-scroll|whitespace-nowrap/)
})

test("Completed Tasks rows keep crossed-out titles", async () => {
  const row = await readFile(workItemRowPath, "utf8")

  assert.match(row, /completed \? "text-muted-foreground line-through" : "text-foreground"/)
  assert.match(row, /completed=\{completed\}/)
})

test("Tasks row exposes separate cross-browser controls for details, completion, and actions", async () => {
  const row = await readFile(workItemRowPath, "utf8")

  assert.match(row, /TaskCompletionToggle/)
  assert.match(row, /type="button"[\s\S]*?onClick=\{\(event\) =>/)
  assert.match(row, /event\.stopPropagation\(\);[\s\S]*?onClick\?\.\(\)/)
  assert.doesNotMatch(row, /\n\s+interactive\n/)
  assert.match(row, /ariaLabel=\{`\$\{completed \? "Reopen" : "Complete"\}/)
})
