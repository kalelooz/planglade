import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

function componentBody(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle)
  const end = source.indexOf(endNeedle, start)
  assert.ok(start >= 0, `${startNeedle} missing`)
  assert.ok(end > start, `${endNeedle} missing after ${startNeedle}`)
  return source.slice(start, end)
}

test("Home task rows reserve a real title slot and non-overlapping trailing metadata", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")
  const row = componentBody(source, "function TaskRow", "function TaskList")

  assert.match(row, /data-home-task-preview-row/)
  assert.match(row, /grid-cols-\[minmax\(0,1fr\)\]/)
  assert.match(row, /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/)
  assert.match(row, /data-home-row-title/)
  assert.match(row, /data-home-row-metadata/)
  assert.match(row, /data-home-row-priority-dependency/)
  assert.match(row, /block min-w-0 truncate/)
  assert.match(row, /data-home-row-metadata[\s\S]*flex min-w-0 items-center gap-x-2 gap-y-1/)
  assert.match(row, /sm:col-start-auto sm:min-w-max sm:shrink-0/)
  assert.match(row, /data-home-row-priority-dependency[\s\S]*inline-flex shrink-0 items-center gap-2 whitespace-nowrap/)
  assert.match(row, /<DependencyBadge item=\{item\} allItems=\{allItems\} \/>[\s\S]*<PriorityIndicator priority=\{item\.priority\} \/>/)
  assert.doesNotMatch(row, /sm:contents/)
  assert.doesNotMatch(row, /TaskCompletionToggle/)
  assert.doesNotMatch(row, /ariaLabel=\{`Complete \$\{displayTitle\}`\}/)
  assert.doesNotMatch(row, /absolute|-\s?m[trblxy]?-/)
})

test("Home compact rows keep titles first and hide noisy default metadata", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")
  const row = componentBody(source, "function TaskRow", "function TaskList")

  assert.match(source, /function homeTaskTitle\(item: WorkItem\)/)
  assert.match(source, /return description \|\| "New task"/)
  assert.match(row, /const displayTitle = homeTaskTitle\(item\)/)
  assert.match(source, /name\.toLowerCase\(\) !== "unassigned"/)
  assert.match(row, /displayLabel\.toLowerCase\(\) !== "task" && !isNextMode/)
  assert.match(row, /const dueLabel = item\.due \? formatDueLabel\(item\.due\) : null/)
  assert.match(row, /const showDate = !!dueLabel && mode !== "next"/)
  assert.match(row, /data-home-row-title[\s\S]*displayTitle[\s\S]*data-home-row-metadata/)
  assert.match(row, /type="button"[\s\S]*onClick=\{onOpen\}/)
  assert.doesNotMatch(row, /"No title"/)
  assert.doesNotMatch(row, /"No date"/)
  assert.doesNotMatch(row, /\?\? \{ id: "unassigned", name: "Unassigned" \}/)
})

test("Home sections use explicit compact row modes for metadata behavior", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")
  const recent = componentBody(source, 'title="Inbox"', "<aside")
  const nextUp = componentBody(source, 'title="Upcoming tasks"', 'title="Recent notes"')

  assert.match(recent, /mode="recent"/)
  assert.match(nextUp, /mode="next"/)
  assert.match(nextUp, /<TaskList[\s\S]*mode="next"/)
})

test("Home Next Up rows use sidebar typography and dependency-before-priority metadata only", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")
  const row = componentBody(source, "function TaskRow", "function TaskList")

  assert.match(row, /const isNextMode = mode === "next"/)
  assert.match(row, /isNextMode \? "font-semibold tracking-tight" : "font-medium"/)
  assert.match(row, /isNextMode \? "flex-nowrap text-\[10\.5px\]/)
  assert.match(row, /isNextMode \? "flex-nowrap text-\[10\.5px\] sm:col-start-auto sm:min-w-max sm:shrink-0 sm:justify-end sm:whitespace-nowrap"/)
  assert.match(row, /const showAssignee = !!assignedMember && !isNextMode/)
  assert.match(row, /displayLabel\.toLowerCase\(\) !== "task" && !isNextMode/)
  assert.match(row, /<DependencyBadge item=\{item\} allItems=\{allItems\} \/>[\s\S]*<PriorityIndicator priority=\{item\.priority\} \/>/)
})

test("Home task previews use the same individual row surface as task lists", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")
  const row = componentBody(source, "function TaskRow", "function TaskList")
  const list = componentBody(source, "function TaskList", "function ContextRow")

  assert.match(row, /className=\{`flow-row/)
  assert.match(row, /selected \? "flow-row-selected/)
  assert.doesNotMatch(list, /divide-y/)
})

test("Home uses one workspace canvas with transparent grouped rows", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")

  assert.doesNotMatch(source, /bg-white|bg-card/)
  assert.match(source, /app-workspace-canvas/)
  assert.match(source, /flow-row-flat/)
  assert.match(source, /flow-empty flow-empty-inline/)
  assert.match(source, /lg:border-l lg:border-border/)
  assert.doesNotMatch(source, /animate-fade-in|transition-all/)
})

test("PriorityIndicator is non-wrapping and avoids clipping-prone positioning", async () => {
  const source = await readProjectFile("src/components/lovable/priority-indicator.tsx")

  assert.match(source, /whitespace-nowrap/)
  assert.doesNotMatch(source, /absolute|-\s?m[trblxy]?-/)
})

test("Home is preview-only while task completion controls stay outside Home", async () => {
  const home = await readProjectFile("src/app/app/page.tsx")
  const row = componentBody(home, "function TaskRow", "function TaskList")
  const files = [
    "src/components/lovable/work-item-row.tsx",
    "src/components/lovable/task-drawer.tsx",
    "src/app/app/projects/projects-page-content.tsx",
    "src/app/app/settings/page.tsx",
  ]

  const toggle = await readProjectFile("src/components/lovable/task-completion-toggle.tsx")
  assert.match(toggle, /rounded-full/)
  assert.match(toggle, /h-3\.5 w-3\.5/)
  assert.match(toggle, /border-zinc-900 bg-zinc-900/)
  assert.match(toggle, /Check/)

  assert.doesNotMatch(row, /TaskCompletionToggle/)
  assert.match(row, /data-home-task-preview-row/)
  assert.match(row, /onClick=\{onOpen\}/)

  for (const file of files) {
    const source = await readProjectFile(file)
    assert.match(source, /TaskCompletionToggle/, `${file} should consume the shared circular task control`)
    assert.doesNotMatch(source, /type="checkbox"[\s\S]{0,220}Complete/, `${file} should not show a native task completion checkbox`)
    assert.doesNotMatch(source, /h-(?:3\.5|4) w-(?:3\.5|4) cursor-pointer accent-zinc-900 rounded(?!-full)/, `${file} should not keep the old square task checkbox classes`)
    assert.doesNotMatch(source, /h-3\.5 w-3\.5 accent-\[var\(--color-primary\)\]/, `${file} should not keep the old square task checkbox classes`)
  }
})
