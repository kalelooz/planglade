import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return collectSourceFiles(fullPath)
    if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) return [fullPath]
    return []
  }))
  return files.flat()
}

test("header project selector is widened and truncates inside the selected label", async () => {
  const shell = await readProjectFile("src/components/lovable/shell.tsx")
  const selector = shell.match(/<div ref=\{projectScopeRef\}[\s\S]*?\{projectScopeOpen &&/)?.[0] ?? ""

  assert.match(selector, /min-w-\[260px\]/)
  assert.match(selector, /max-w-\[420px\]/)
  assert.match(selector, /xl:w-\[clamp\(260px,28vw,420px\)\]/)
  assert.match(selector, /<span className="min-w-0 flex-1 truncate text-left font-semibold">/)
  assert.doesNotMatch(selector, /w-52/)
})

test("command palette uses cmdk list items so keyboard navigation scrolls correctly", async () => {
  const source = await readProjectFile("src/components/lovable/command-palette.tsx")

  assert.match(source, /Command,/)
  assert.match(source, /CommandInput,/)
  assert.match(source, /CommandList,/)
  assert.match(source, /CommandGroup,/)
  assert.match(source, /CommandItem,/)
  assert.match(source, /<Command loop/)
  assert.match(source, /<CommandList/)
  assert.match(source, /<CommandItem[\s\S]*value=\{command\.value\}/)
  assert.match(source, /onSelect=\{\(\) => runCommand\(command\)\}/)
  assert.doesNotMatch(source, /window\.addEventListener\("keydown"/)
  assert.doesNotMatch(source, /useState\(0\)/)
  assert.doesNotMatch(source, /max-h-80 overflow-y-auto/)
  assert.match(source, /Go to Connections/)
})

test("production source has no visible smoke or debug data strings", async () => {
  const files = await collectSourceFiles(path.join(root, "src"))
  const blocked = [
    /INBOX-CONTROL-/,
    /Project Detail Smoke/,
    /screenshot-only project/i,
    /\brow [01]\b/,
  ]

  for (const file of files) {
    const source = await readFile(file, "utf8")
    for (const pattern of blocked) {
      assert.doesNotMatch(source, pattern, `${path.relative(root, file)} leaks ${pattern}`)
    }
  }
})

test("Home task rows always render a title fallback before metadata", async () => {
  const source = await readProjectFile("src/app/app/page.tsx")
  const row = source.match(/function TaskRow[\s\S]*?function TaskList/)?.[0] ?? ""

  assert.match(source, /function homeTaskTitle\(item: WorkItem\)/)
  assert.match(source, /return description \|\| "New task"/)
  assert.match(row, /const displayTitle = homeTaskTitle\(item\)/)
  assert.match(row, /data-home-task-preview-row/)
  assert.match(row, /onClick=\{onOpen\}/)
  assert.doesNotMatch(row, /TaskCompletionToggle/)
  assert.match(row, /title=\{displayTitle\}/)
  assert.match(row, />\s*\{displayTitle\}\s*<\/span>/)
})
