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

test("CONTRIB-001: changed files are plain ASCII with no hidden Unicode", async () => {
  // Use numeric codepoint checks (not regex with Unicode escape ranges) so the
  // guard itself does not trip GitHub's hidden/bidirectional Unicode warning.
  const ASCII_MAX = 0x7f
  const ZERO_WIDTH_SPACE = 0x200b
  const ZERO_WIDTH_NON_JOINER = 0x200c
  const ZERO_WIDTH_JOINER = 0x200d
  const LEFT_TO_RIGHT_MARK = 0x200e
  const RIGHT_TO_LEFT_MARK = 0x200f
  const BYTE_ORDER_MARK = 0xfeff
  const BIDI_OVERRIDE_RANGE = [0x202a, 0x202e] as const
  const INVISIBLE_RANGE = [0x2060, 0x206f] as const

  function findHiddenUnicode(text: string): string | null {
    for (let i = 0; i < text.length; i += 1) {
      const code = text.charCodeAt(i)
      if (code <= ASCII_MAX) continue
      if (code === ZERO_WIDTH_SPACE) return `U+200B at index ${i}`
      if (code === ZERO_WIDTH_NON_JOINER) return `U+200C at index ${i}`
      if (code === ZERO_WIDTH_JOINER) return `U+200D at index ${i}`
      if (code === LEFT_TO_RIGHT_MARK) return `U+200E at index ${i}`
      if (code === RIGHT_TO_LEFT_MARK) return `U+200F at index ${i}`
      if (code === BYTE_ORDER_MARK) return `U+FEFF at index ${i}`
      if (code >= BIDI_OVERRIDE_RANGE[0] && code <= BIDI_OVERRIDE_RANGE[1]) {
        return `U+${code.toString(16).toUpperCase()} at index ${i}`
      }
      if (code >= INVISIBLE_RANGE[0] && code <= INVISIBLE_RANGE[1]) {
        return `U+${code.toString(16).toUpperCase()} at index ${i}`
      }
      return `non-ASCII U+${code.toString(16).toUpperCase()} at index ${i}`
    }
    return null
  }

  for (const target of ["CONTRIBUTING.md", "tests/contributing-docs.test.ts"]) {
    const content = await readProjectFile(target)
    const hit = findHiddenUnicode(content)
    assert.equal(hit, null, `${target} must be ASCII-only with no hidden Unicode`)
  }
})

test("CONTRIB-001: CONTRIBUTING.md does not read like an internal AI prompt", async () => {
  const contributing = await readProjectFile("CONTRIBUTING.md")

  // Public contributor docs must not contain internal agent/workflow wording.
  assert.doesNotMatch(contributing, /system prompt|TODO list for the agent|AGENTS\.md|MCP|beacon/i)
})
