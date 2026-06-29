import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("PUBLIC-MAINTAINER-PACK-001: public maintainer files exist and link together", async () => {
  const readme = await readProjectFile("README.md")
  const license = await readProjectFile("LICENSE")
  const contributing = await readProjectFile("CONTRIBUTING.md")
  const security = await readProjectFile("SECURITY.md")
  const codeOfConduct = await readProjectFile("CODE_OF_CONDUCT.md")

  assert.match(readme, /Maintained by kalelooz\./)
  assert.match(readme, /\[CONTRIBUTING\.md\]\(\.\/CONTRIBUTING\.md\)/)
  assert.match(readme, /\[SECURITY\.md\]\(\.\/SECURITY\.md\)/)
  assert.match(readme, /docs\/SELF_HOSTING\.md/)
  assert.match(license, /GNU AFFERO GENERAL PUBLIC LICENSE/)
  assert.match(contributing, /fake features/i)
  assert.match(security, /GitHub private vulnerability reporting/i)
  assert.match(codeOfConduct, /Expected Behavior/)
})

test("PUBLIC-MAINTAINER-PACK-001: package license is AGPL-3.0-only", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json")) as {
    license?: string
  }

  assert.equal(packageJson.license, "AGPL-3.0-only")
})

test("PUBLIC-MAINTAINER-PACK-001: roadmap separates available, next, and later work", async () => {
  const roadmap = await readProjectFile("ROADMAP.md")

  const available = roadmap.match(/## Available Today[\s\S]*?(?=\n## Next)/)?.[0] ?? ""
  const next = roadmap.match(/## Next[\s\S]*?(?=\n## Later)/)?.[0] ?? ""
  const later = roadmap.match(/## Later[\s\S]*?(?=\n## Rules)/)?.[0] ?? ""

  assert.match(available, /\bHome\b/)
  assert.match(available, /\bInbox\b/)
  assert.match(available, /\bTasks\b/)
  assert.match(available, /\bProjects\b/)
  assert.match(available, /\bNotes\b/)
  assert.match(available, /\bCalendar\b/)
  assert.match(available, /\bSettings\b/)

  assert.match(next, /Timeline polish/)
  assert.match(next, /Task dependencies/)
  assert.match(next, /Recurring tasks/)
  assert.match(next, /Stronger self-host path/)

  assert.match(later, /Collaboration/)
  assert.match(later, /Hosted cloud/)
  assert.match(later, /Billing/)
  assert.match(later, /Admin\/team/)

  assert.doesNotMatch(available, /Hosted cloud|Billing|Admin\/team|AI assistance/i)
})

test("PUBLIC-MAINTAINER-PACK-001: public docs avoid private or internal workflow claims", async () => {
  const files = [
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "ROADMAP.md",
  ]
  const combined = (
    await Promise.all(files.map((file) => readProjectFile(file)))
  ).join("\n")

  assert.doesNotMatch(combined, /private SaaS/i)
  assert.doesNotMatch(combined, /Codex|GLM|MiniMax|AI workflow|prompt file/i)
  assert.doesNotMatch(combined, /pricing page|pricing nav|paid tier|per-seat/i)
  assert.doesNotMatch(combined, /hosted cloud (is )?(available|included|ready)/i)
  assert.doesNotMatch(combined, /AI-powered|AI assistant/i)
})
