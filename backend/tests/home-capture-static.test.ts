import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("Home capture does not use the local inbox pre-write path", () => {
  const source = readFileSync("src/components/flowboard-home.tsx", "utf8")

  assert.equal(source.includes("addInboxItem"), false)
  assert.equal(source.includes("state.inboxItems"), false)
  assert.equal(source.includes('fetch("/api/work-items"'), true)
  assert.equal(source.includes('status: "BACKLOG"'), true)
  assert.equal(source.includes("setSelectedTaskId(next.id)"), false)
})

test("Home avoids fake metrics and horizontal-scroll patterns", () => {
  const source = readFileSync("src/components/flowboard-home.tsx", "utf8")

  assert.doesNotMatch(source, /productivity score|time tracking|tracked time|KPI|vanity metric/i)
  assert.equal(source.includes("overflow-x-auto"), false)
  assert.equal(source.includes("overflow-x-scroll"), false)
  assert.equal(source.includes("min-w-max"), false)
})

test("Home task rows use the shared drawer and Inbox captures link to Inbox", () => {
  const source = readFileSync("src/components/flowboard-home.tsx", "utf8")

  assert.equal(source.includes('import { TaskDrawer } from "@/components/tasks/task-drawer";'), true)
  assert.equal(source.includes("function InboxCaptureRow"), true)
  assert.match(source, /<Link href="\/app\/inbox"[^>]*>/)
  assert.match(source, /onOpen=\{\(\) => setSelectedTaskId\(item\.id\)\}/)
  assert.equal(source.includes('item.status === "In Review"'), false)
  assert.equal(source.includes("/block/i"), false)
})

test("Home task rows stay compact and avoid noisy fallback metadata", () => {
  const source = readFileSync("src/components/flowboard-home.tsx", "utf8")

  assert.equal(source.includes('"No project"'), false)
  assert.equal(source.includes('"Unassigned"'), false)
  assert.equal(source.includes("<Chip>{item.label}</Chip>"), false)
  assert.equal(source.includes("Id late"), false)
  assert.match(source, /return "Due today"/)
  assert.match(source, /return "No date"/)
})
