import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const boardPath = path.join(process.cwd(), "src/app/board/board-page-content.tsx")

test("active board keeps the dragged task in the overlay and opens one measured drop hole", async () => {
  const source = await readFile(boardPath, "utf8")

  assert.match(source, /MeasuringStrategy\.BeforeDragging/)
  assert.match(source, /const \[dragTarget, setDragTarget\]/)
  assert.match(source, /items\.filter\(\(item\) => item\.id !== activeDragId\)/)
  assert.match(source, /holeAt=\{dragTarget\?\.status === col \? dragTarget\.index : null\}/)
  assert.match(source, /<DropHole height=\{dragHeight\} \/>/)
  assert.match(source, /<DragOverlay[^>]*>\s*\{activeDragItem \? <CardGhost/)
  assert.doesNotMatch(source, /opacity: isDragging \? 0\.4/)
})
