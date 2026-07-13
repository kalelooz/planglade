import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (filePath: string) => readFile(path.join(root, filePath), "utf8")

test("workspace identity has one sidebar control for expanded, collapsed, and mobile navigation", async () => {
  const shell = await read("src/components/lovable/shell.tsx")

  assert.match(shell, /function WorkspaceControl/)
  assert.match(shell, /collapsed=\{false\}/)
  assert.match(shell, /collapsed=\{true\}/)
  assert.match(shell, /onNavigate=\{\(\) => setMobileNavOpen\(false\)\}/)
  assert.match(shell, /href=\{\`\$\{routePrefix\}\/settings\`\}/)
  assert.doesNotMatch(shell, /Workspace settings/)
  assert.doesNotMatch(shell, /Switch workspace|Create workspace/)
})

test("demo exposes a safe Settings route in navigation and command search", async () => {
  const [shell, palette, page, client] = await Promise.all([
    read("src/components/lovable/shell.tsx"),
    read("src/components/lovable/command-palette.tsx"),
    read("src/app/demo/settings/page.tsx"),
    read("src/app/demo/demo-client.tsx"),
  ])

  assert.match(shell, /\$\{routePrefix\}\/settings/)
  assert.match(palette, /Go to Settings/)
  assert.match(page, /Demo settings/)
  assert.match(page, /DEMO_MODE_MESSAGE/)
  assert.match(client, /\/demo\/settings/)
  assert.doesNotMatch(page, /redirect\(/)
  assert.doesNotMatch(page, /apiFetch|guidedImport|workspace.*change|delete workspace/i)
})
