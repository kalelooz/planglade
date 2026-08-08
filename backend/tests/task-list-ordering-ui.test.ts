import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

test("Tasks List keeps the lifted task in an overlay and persists its selected slot", async () => {
  const source = await readFile(path.join(process.cwd(), "src/app/app/tasks/page.tsx"), "utf8")

  assert.match(source, /sort === "Manual" && activeFilter === "all" && !query\.trim\(\)/)
  assert.match(source, /MeasuringStrategy\.BeforeDragging/)
  assert.match(source, /items\.filter\(\(item\) => item\.id !== activeDragId\)/)
  assert.match(source, /holeAt=\{dragTarget\?\.status === status \? dragTarget\.index : null\}/)
  assert.match(source, /<DragOverlay>/)
  assert.match(source, /patchTaskStatus\(activeId, target\.status, beforeId, snapshot\)/)
})
