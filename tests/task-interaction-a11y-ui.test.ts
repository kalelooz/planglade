import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("shared interactive task rows expose keyboard and zinc focus affordances", async () => {
  const source = await readProjectFile("src/components/lovable/flow-ui.tsx")

  assert.match(source, /interactive && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"/)
  assert.match(source, /role={role \?\? \(interactive && as !== "button" \? "button" : undefined\)}/)
  assert.match(source, /tabIndex={tabIndex \?\? \(interactive && as !== "button" \? 0 : undefined\)}/)
  assert.match(source, /event\.key === "Enter" \|\| event\.key === " "/)
  assert.match(source, /event\.currentTarget !== event\.target/)
})

test("shared and project task rows keep checkbox isolation with visible focus", async () => {
  const [sharedRow, projectDetail] = await Promise.all([
    readProjectFile("src/components/lovable/work-item-row.tsx"),
    readProjectFile("src/app/app/projects/projects-page-content.tsx"),
  ])

  for (const [name, source] of [
    ["shared row", sharedRow],
    ["project detail row", projectDetail],
  ] as const) {
    assert.match(source, /TaskCompletionToggle/, `${name} must use the shared circular task completion control`)
    assert.match(source, /ariaLabel=\{`\$\{completed \? "Reopen" : "Complete"\}/, `${name} checkbox needs an accessible task action label`)
    assert.match(source, /focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1/, `${name} open control needs visible zinc focus`)
  }
})

test("task drawer controls use accessible focus and close labeling", async () => {
  const source = await readProjectFile("src/components/lovable/task-drawer.tsx")

  assert.match(source, /aria-label="Close task drawer"/)
  assert.match(source, /StatusSelect/)
  assert.match(source, /PrioritySelect/)
  assert.match(source, /focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1/)
  assert.doesNotMatch(source, /focus:border-ring/)
})

test("task list and calendar controls avoid colored focus rings", async () => {
  const [tasks, calendar, board] = await Promise.all([
    readProjectFile("src/app/app/tasks/page.tsx"),
    readProjectFile("src/app/app/calendar/page.tsx"),
    readProjectFile("src/app/board/board-page-content.tsx"),
  ])

  for (const [name, source] of [
    ["tasks", tasks],
    ["calendar", calendar],
    ["board", board],
  ] as const) {
    assert.match(source, /focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950/, `${name} surface needs zinc focus`)
    assert.doesNotMatch(source, /focus-visible:(?:outline|ring)-(?:primary|ring)/, `${name} surface must not use colored focus rings`)
  }
})

test("mobile calendar keeps the month grid inside the viewport", async () => {
  const source = await readProjectFile("src/app/app/calendar/page.tsx")

  assert.match(source, /min-w-0 flex-1 overflow-x-hidden overflow-y-auto/)
  assert.match(source, /<div className="max-w-full overflow-x-hidden">/)
  assert.match(source, /grid h-full min-w-0 grid-cols-7/)
  assert.doesNotMatch(source, /min-w-\[720px\]/)
})
