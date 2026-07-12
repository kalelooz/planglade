import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (filePath: string) => readFile(path.join(root, filePath), "utf8")

test("Connections and Settings are shared primary navigation routes", async () => {
  const [shell, palette] = await Promise.all([
    read("src/components/lovable/shell.tsx"),
    read("src/components/lovable/command-palette.tsx"),
  ])

  assert.match(shell, /connections: "\/app\/connections"/)
  assert.match(shell, /label: "Connections"/)
  assert.match(shell, /label: "Settings"/)
  assert.match(shell, /navMain/)
  assert.match(shell, /setMobileNavOpen\(false\)/)
  assert.match(palette, /Go to Connections/)
  assert.match(palette, /Go to Settings/)
})

test("workspace popover shows current identity and omits switching", async () => {
  const shell = await read("src/components/lovable/shell.tsx")

  assert.match(shell, /workspaceName/)
  assert.match(shell, /workspaceRole/)
  assert.match(shell, /Current workspace/)
  assert.match(shell, /Workspace settings/)
  assert.match(shell, /aria-expanded=\{workspaceOpen\}/)
  assert.match(shell, /event\.key === "Escape"/)
  assert.match(shell, /workspaceRef/)
  assert.doesNotMatch(shell, /Switch workspace|Create workspace|availableWorkspaces/)
})

