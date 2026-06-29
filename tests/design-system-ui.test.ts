import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("core tokens do not use retired green nature identity", async () => {
  const globals = await readProjectFile("src/app/globals.css")
  const retiredPatterns = [
    /\bmoss\b/i,
    /\bsage\b/i,
    /\bforest\b/i,
    /0\.120 155/,
    /0\.095 155/,
    /#17613f/i,
    /#5f744d/i,
  ]

  for (const pattern of retiredPatterns) {
    assert.doesNotMatch(globals, pattern, `globals.css contains retired identity pattern ${pattern}`)
  }

  assert.match(globals, /--primary:\s*oklch\(0\.21 0\.006 286\)/)
  assert.match(globals, /--accent:\s*oklch\(0\.967 0\.001 286\)/)
  assert.match(globals, /--priority-high:\s*oklch\(0\.21 0\.006 286\)/)
  assert.match(globals, /--priority-med:\s*oklch\(0\.442 0\.017 286\)/)
  assert.match(globals, /--priority-low:\s*oklch\(0\.705 0\.015 286\)/)
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
