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

test("workspace menu uses the accessible dropdown primitive and omits switching", async () => {
  const shell = await read("src/components/lovable/shell.tsx")

  // Identity and role are still surfaced from the authenticated session.
  assert.match(shell, /workspaceName/)
  assert.match(shell, /workspaceRole/)
  assert.match(shell, /Current workspace/)
  assert.match(shell, /<span>Settings<\/span>/)

  // The menu is the repository's accessible Radix dropdown, not a hand-built element.
  assert.match(shell, /DropdownMenuTrigger/)
  assert.match(shell, /DropdownMenuContent/)
  assert.match(shell, /DropdownMenuItem/)
  assert.doesNotMatch(shell, /role="menu"/)
  assert.doesNotMatch(shell, /workspaceOpen|workspaceRef/)

  // Sign out is wired through the dropdown and only shown when the auth mode supports it.
  assert.match(shell, /shouldShowSignOut/)
  assert.match(shell, /Sign out/)
  assert.match(shell, /void signOut\("\/login"\)/)

  // No workspace switching or creation is offered.
  assert.doesNotMatch(shell, /Switch workspace|Create workspace|availableWorkspaces/)
})
