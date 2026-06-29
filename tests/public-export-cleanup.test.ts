import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("PUBLIC-EXPORT-CLEANUP-002: gitignore protects private and generated files", async () => {
  const gitignore = await readProjectFile(".gitignore")

  for (const pattern of [
    ".env*",
    "!.env.example",
    "/db/",
    "*.db",
    "*.sqlite",
    "*.sqlite3",
    "/artifacts/",
    "/output/",
    "/logs/",
    "/.logs/",
    "/docs/ACTIVE_PLAN.md",
    "/docs/archive/",
    "/docs/audits/",
    "/docs/slices/",
    "/docs/sources/",
    "/.agents/",
    "/.codex/",
    "/.opencode/",
    "/.zscripts/",
    "/Reddit/",
    "/external/",
  ]) {
    assert.match(gitignore, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("PUBLIC-EXPORT-CLEANUP-002: dockerignore excludes private and generated files", async () => {
  const dockerignore = await readProjectFile(".dockerignore")

  for (const pattern of [
    ".env",
    ".env.*",
    "node_modules",
    ".next",
    "db",
    "*.db",
    "artifacts",
    "output",
    "logs",
    "docs/ACTIVE_PLAN.md",
    "docs/archive",
    "docs/audits",
    "docs/slices",
    "docs/sources",
    ".agents",
    ".codex",
    ".opencode",
    ".zscripts",
    "Reddit",
    "external",
  ]) {
    assert.match(dockerignore, new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("PUBLIC-EXPORT-CLEANUP-002: public release checklist has include exclude and fresh repo steps", async () => {
  const checklist = await readProjectFile("docs/PUBLIC_RELEASE_CHECKLIST.md")

  assert.match(checklist, /## Include/)
  assert.match(checklist, /## Exclude/)
  assert.match(checklist, /## Fresh Public Repo Steps/)
  assert.match(checklist, /Do not push from the current private working branch/)
  assert.match(checklist, /docs\/ACTIVE_PLAN\.md/)
  assert.match(checklist, /private agent workflow notes/)
  assert.doesNotMatch(checklist, /sponsorship granted|support granted|pricing page/i)
})

test("PUBLIC-EXPORT-CLEANUP-002: public docs do not link excluded internal docs", async () => {
  const publicDocs = [
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "ROADMAP.md",
    "docs/SELF_HOSTING.md",
    "docs/BACKUP_RESTORE.md",
    "docs/PUBLIC_RELEASE_CHECKLIST.md",
  ]
  const combined = (await Promise.all(publicDocs.map((file) => readProjectFile(file)))).join("\n")

  assert.doesNotMatch(combined, /\]\([^)]*docs\/ACTIVE_PLAN\.md/i)
  assert.doesNotMatch(combined, /\]\([^)]*docs\/archive\//i)
  assert.doesNotMatch(combined, /\]\([^)]*docs\/audits\//i)
  assert.doesNotMatch(combined, /\]\([^)]*docs\/slices\//i)
  assert.doesNotMatch(combined, /\]\([^)]*docs\/sources\//i)
})

test("PUBLIC-EXPORT-CLEANUP-002: public docs avoid fake claims and private local paths", async () => {
  const publicDocs = [
    "README.md",
    "CONTRIBUTING.md",
    "SECURITY.md",
    "CODE_OF_CONDUCT.md",
    "ROADMAP.md",
    "docs/SELF_HOSTING.md",
    "docs/BACKUP_RESTORE.md",
    "docs/PUBLIC_RELEASE_CHECKLIST.md",
  ]
  const combined = (await Promise.all(publicDocs.map((file) => readProjectFile(file)))).join("\n")

  assert.doesNotMatch(combined, /OpenAI sponsorship granted|support granted|grant awarded/i)
  assert.doesNotMatch(combined, /hosted cloud (is )?(available|included|ready)/i)
  assert.doesNotMatch(combined, /pricing page|paid tier|per-seat/i)
  assert.doesNotMatch(combined, /AI-powered|AI assistant/i)
  assert.doesNotMatch(combined, /time tracking is available|mobile app is available/i)
  assert.doesNotMatch(combined, /[A-Z]:[\\/](?:Users|Projects)[\\/]/i)
})

test("PUBLIC-EXPORT-CLEANUP-002: env example uses placeholders only", async () => {
  const envExample = await readProjectFile(".env.example")

  assert.match(envExample, /replace-with-a-random-local-secret/)
  assert.match(envExample, /replace-with-a-random-nextauth-secret/)
  assert.match(envExample, /replace-with-google-client-secret/)
  assert.match(envExample, /replace-with-random-maintenance-token/)
  assert.doesNotMatch(envExample, /=["']?sk-[A-Za-z0-9_-]{12,}/)
  assert.doesNotMatch(envExample, /-----BEGIN [A-Z ]+PRIVATE KEY-----/)
  assert.doesNotMatch(envExample, /AIza[0-9A-Za-z_-]{20,}/)
})

test("PUBLIC-EXPORT-CLEANUP-002: CI is read-only and does not publish", async () => {
  const ci = await readProjectFile(".github/workflows/ci.yml")

  assert.match(ci, /permissions:\s*\n\s+contents: read/)
  assert.match(ci, /npm ci/)
  assert.match(ci, /npm run test/)
  assert.match(ci, /npm audit --omit=dev --audit-level=critical/)
  assert.doesNotMatch(ci, /npm publish|docker push|gh release|firebase deploy|vercel deploy/i)
})
