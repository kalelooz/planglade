import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("core tokens use the calm green-neutral application identity", async () => {
  const globals = await readProjectFile("src/app/globals.css")

  assert.match(globals, /--background:\s*oklch\(0\.978 0\.008 112\)/)
  assert.match(globals, /--primary:\s*oklch\(0\.34 0\.075 145\)/)
  assert.match(globals, /--accent:\s*oklch\(0\.925 0\.027 124\)/)
  assert.match(globals, /--sidebar:\s*oklch\(0\.955 0\.014 112\)/)
  assert.match(globals, /\.dark\s*\{[\s\S]*?--primary:\s*oklch\(0\.78 0\.095 135\)/)
})

test("priority and completed icons stay zinc-only", async () => {
  const icons = await readProjectFile("src/components/lovable/icons.tsx")
  const priorityColorBlock = icons.match(/const PRIORITY_COLOR[\s\S]*?};/)?.[0] ?? ""
  const labelStyleBlock = icons.match(/const LABEL_STYLE[\s\S]*?};\r?\n\r?\nconst LABEL_TEXT/)?.[0] ?? ""

  assert.doesNotMatch(priorityColorBlock, /red|amber|emerald|green|#dc2626|#ca8a04/i)
  assert.doesNotMatch(labelStyleBlock, /red|amber|emerald|green|#dc2626|#ca8a04/i)
  assert.doesNotMatch(icons, /CircleCheck[\s\S]*emerald/i)
  assert.match(icons, /CircleCheck className=\{\`\$\{base\} text-muted-foreground`\}/)
})
