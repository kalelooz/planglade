import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("CONTRIB-001: CONTRIBUTING.md documents required setup prerequisites", async () => {
  const contributing = await readProjectFile("CONTRIBUTING.md")

  assert.match(contributing, /Node\.js 20\.9/)
  assert.match(contributing, /npm 10/)
  assert.match(contributing, /\.env\.example/)
  assert.match(contributing, /npm install/)
  assert.match(contributing, /npm run db:generate/)
  assert.match(contributing, /npm run db:push/)
  assert.match(contributing, /npm run dev/)
  assert.match(contributing, /http:\/\/localhost:3000/)
})

test("CONTRIB-001: CONTRIBUTING.md documents the full validation set", async () => {
  const contributing = await readProjectFile("CONTRIBUTING.md")

  for (const command of [
    /npm run lint/,
    /npm run typecheck/,
    /npm test/,
    /npx prisma validate/,
    /npm run build/,
    /git diff --check/,
  ]) {
    assert.match(contributing, command)
  }
})

test("CONTRIB-001: CONTRIBUTING.md enforces one issue per PR and issue-first flow", async () => {
  const contributing = await readProjectFile("CONTRIBUTING.md")

  assert.match(contributing, /One issue per pull request/i)
  assert.match(contributing, /Closes #X/i)
})

test("CONTRIB-001: CONTRIBUTING.md links security reporting to SECURITY.md", async () => {
  const contributing = await readProjectFile("CONTRIBUTING.md")

  assert.match(contributing, /SECURITY\.md/)
  assert.match(contributing, /Do not report security vulnerabilities in public issues/i)
})

test("CONTRIB-001: CONTRIBUTING.md keeps honesty guards", async () => {
  const contributing = await readProjectFile("CONTRIBUTING.md")

  // Must keep the established honesty wording and warn against fake features.
  assert.match(contributing, /fake features/i)
  assert.match(contributing, /not production-hardened/i)
  // Must not overclaim cloud/hosted maturity.
  assert.doesNotMatch(contributing, /hosted cloud (is )?(available|included|ready)/i)
})

test("CONTRIB-001: CONTRIBUTING.md states the CLA/DCO position", async () => {
  const contributing = await readProjectFile("CONTRIBUTING.md")

  // The project does not require a CLA/DCO today; the doc must say so rather
  // than introducing one silently.
  assert.match(contributing, /No CLA or DCO/i)
})

test("CONTRIB-001: CONTRIBUTING.md covers code quality and docs standards", async () => {
  const contributing = await readProjectFile("CONTRIBUTING.md")

  assert.match(contributing, /TypeScript/i)
  assert.match(contributing, /workspace-scoped|workspace membership/i)
  assert.match(contributing, /Never trust client-provided/i)
  assert.match(contributing, /sanitization/i)
  assert.match(contributing, /No new dependencies|No new dependency/i)
})

test("CONTRIB-001: CONTRIBUTING.md uses plain ASCII with no hidden Unicode", async () => {
  const contributing = await readProjectFile("CONTRIBUTING.md")

  // Reject bidi controls, zero-width characters, and any non-ASCII bytes that
  // can trigger GitHub hidden-Unicode warnings.
  assert.doesNotMatch(contributing, /[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/)
  // Every character must be ASCII.
  assert.doesNotMatch(contributing, /[^\x00-\x7F]/)
})

test("CONTRIB-001: CONTRIBUTING.md does not read like an internal AI prompt", async () => {
  const contributing = await readProjectFile("CONTRIBUTING.md")

  // Public contributor docs must not contain internal agent/workflow wording.
  assert.doesNotMatch(contributing, /system prompt|TODO list for the agent|AGENTS\.md|MCP|beacon/i)
})
