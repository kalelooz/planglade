import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("Tasks exposes Map only outside demo and keeps it as a Tasks view", async () => {
  const [tasksSource, paletteSource] = await Promise.all([
    readFile("src/app/app/tasks/page.tsx", "utf8"),
    readFile("src/components/lovable/command-palette.tsx", "utf8"),
  ])
  const boardSource = await readFile("src/app/board/board-page-content.tsx", "utf8")

  assert.match(tasksSource, /viewParam === "map" && !isDemoMode/)
  assert.match(tasksSource, /\/app\/tasks\?view=map/)
  assert.match(tasksSource, /<TaskMap/)
  assert.match(boardSource, /!isDemoMode/)
  assert.match(boardSource, /\/app\/tasks\?view=map/)
  assert.doesNotMatch(tasksSource, /\/demo\/tasks\?view=map/)
  assert.match(paletteSource, /basePath === "\/app"/)
  assert.match(paletteSource, /Open Tasks Map/)
})

test("Map UI exposes persistence, conflict, fallback, and read-only task truth states", async () => {
  const source = await readFile("src/components/tasks/task-map.tsx", "utf8")

  assert.match(source, /method: "PUT"/)
  assert.match(source, /method: "PATCH"/)
  assert.match(source, /response\.status === 409/)
  assert.match(source, /Your local positions are still here/)
  assert.match(source, /data-task-map-mobile-fallback/)
  assert.match(source, /Task truth · read only/)
  assert.match(source, /nodesConnectable=\{false\}/)
})
