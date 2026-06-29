import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("Home task rows use compact title-first metadata order", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")
  const rowStart = source.indexOf("function TaskRow")
  const rowEnd = source.indexOf("function TaskList", rowStart)
  const rowSource = source.slice(rowStart, rowEnd)

  assert.match(rowSource, /data-home-task-preview-row/)
  assert.match(rowSource, /grid-cols-\[minmax\(0,1fr\)\]/)
  assert.match(rowSource, /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/)

  const rowButtonIndex = rowSource.indexOf("onClick={onOpen}")
  const titleIndex = rowSource.indexOf("title={displayTitle}")
  const priorityIndex = rowSource.indexOf("<PriorityIndicator")
  const dependencyIndex = rowSource.indexOf("<DependencyBadge")
  const assigneeIndex = rowSource.indexOf("<Avatar")
  const labelIndex = rowSource.indexOf("<Chip>{displayLabel}</Chip>")
  const dueIndex = rowSource.indexOf("{dueLabel}")

  assert.ok(rowButtonIndex > 0, "Home task preview row button missing")
  assert.ok(titleIndex > 0, "title must be available on the preview row button")
  assert.ok(dependencyIndex > titleIndex, "dependency state must follow title")
  assert.ok(priorityIndex > dependencyIndex, "priority must follow dependency state")
  assert.ok(assigneeIndex > priorityIndex, "assignee must follow dependency/priority state")
  assert.ok(labelIndex > assigneeIndex, "label/status/type must follow assignee")
  assert.ok(dueIndex > labelIndex, "due date must follow label/status/type")
  assert.doesNotMatch(rowSource, /TaskCompletionToggle/)
})

test("Calendar task chips expose metadata in canonical order after the title", async () => {
  const source = await readProjectFile("src/app/app/calendar/page.tsx")
  const chipStart = source.indexOf("function TaskChip")
  const chipEnd = source.indexOf("function accentFor", chipStart)
  const chipSource = source.slice(chipStart, chipEnd)
  const noDateStart = source.indexOf("function NoDateTask")
  const noDateEnd = source.indexOf("type CalView", noDateStart)
  const noDateSource = source.slice(noDateStart, noDateEnd)

  for (const [name, rowSource] of [
    ["TaskChip", chipSource],
    ["NoDateTask", noDateSource],
  ] as const) {
    const titleIndex = rowSource.indexOf("item.title")
    const priorityIndex = rowSource.indexOf("<PriorityIcon")
    const assigneeIndex = rowSource.indexOf("<Avatar")
    const labelIndex = rowSource.indexOf("<Chip>{displayLabel}</Chip>")
    const dueIndex = rowSource.indexOf("{dueLabel}")

    assert.ok(titleIndex > 0, `${name} title missing`)
    assert.ok(priorityIndex > titleIndex, `${name} priority must follow title`)
    assert.ok(assigneeIndex > priorityIndex, `${name} assignee must follow priority`)
    assert.ok(labelIndex > assigneeIndex, `${name} label/status/type must follow assignee`)
    assert.ok(dueIndex > labelIndex, `${name} due date must follow label/status/type`)
  }
})

test("Tasks board cards keep card layout but use canonical metadata order", async () => {
  const source = await readProjectFile("src/app/board/board-page-content.tsx")
  const cardStart = source.indexOf("function Card")
  const cardEnd = source.indexOf("function CardGhost", cardStart)
  const cardSource = source.slice(cardStart, cardEnd)
  const ghostStart = source.indexOf("function CardGhost")
  const ghostSource = source.slice(ghostStart)

  for (const [name, rowSource] of [
    ["Card", cardSource],
    ["CardGhost", ghostSource],
  ] as const) {
    const priorityIndex = rowSource.indexOf("<PriorityIndicator")
    const assigneeIndex = rowSource.indexOf("<Avatar")
    const labelIndex = rowSource.indexOf("item.label")
    const dueIndex = rowSource.indexOf("formatDueLabel(item.due)")

    assert.ok(priorityIndex > 0, `${name} priority missing`)
    assert.ok(assigneeIndex > priorityIndex, `${name} assignee must follow priority`)
    assert.ok(labelIndex > assigneeIndex, `${name} label/type must follow assignee`)
    assert.ok(dueIndex > labelIndex, `${name} due date must follow label/type`)
  }
})

test("Task drawer details follow task row metadata order", async () => {
  const source = await readProjectFile("src/components/lovable/task-drawer.tsx")
  const detailsStart = source.indexOf("<dl")
  const detailsEnd = source.indexOf("<DrawerSection", detailsStart)
  const detailsSource = source.slice(detailsStart, detailsEnd)

  const priorityIndex = detailsSource.indexOf(">Priority</dt>")
  const assigneeIndex = detailsSource.indexOf(">Assignee</dt>")
  const labelIndex = detailsSource.indexOf(">Label</dt>")
  const dueIndex = detailsSource.indexOf(">Due</dt>")

  assert.ok(priorityIndex > 0, "priority field missing")
  assert.ok(assigneeIndex > priorityIndex, "assignee must follow priority")
  assert.ok(labelIndex > assigneeIndex, "label must follow assignee")
  assert.ok(dueIndex > labelIndex, "due date must follow label")
})
