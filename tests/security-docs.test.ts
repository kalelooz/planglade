import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { glob } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("SECURITY-002: SECURITY.md does not publish an unmanaged security email", async () => {
  const security = await readProjectFile("SECURITY.md")

  // No dedicated email address is published until the maintainer actually
  // controls the mailbox. The policy should rely on GitHub reporting only.
  assert.doesNotMatch(security, /security@planglade\.com/)
  assert.doesNotMatch(security, /[a-z]+@planglade\.com/i)
})

test("SECURITY-002: SECURITY.md keeps private vulnerability reporting as primary path", async () => {
  const security = await readProjectFile("SECURITY.md")

  assert.match(security, /GitHub Private Vulnerability Reporting/i)
})

test("SECURITY-002: SECURITY.md warns against public exploit details", async () => {
  const security = await readProjectFile("SECURITY.md")

  assert.match(security, /Do not open a public issue with/i)
  assert.match(security, /exploit details/i)
  assert.match(security, /I need a private channel to report a security issue/i)
  assert.match(security, /last resort|not visible/i)
  // Must list the sensitive data types that must not appear in a public issue.
  assert.match(security, /credentials/i)
  assert.match(security, /tokens/i)
  assert.match(security, /private keys/i)
  assert.match(security, /database URLs/i)
})

test("SECURITY-002: SECURITY.md documents supported versions and scope", async () => {
  const security = await readProjectFile("SECURITY.md")

  assert.match(security, /current `main` branch/i)
  assert.match(security, /Not supported/i)
  assert.match(security, /private forks|modified deployments/i)
})

test("SECURITY-002: SECURITY.md documents expected report contents", async () => {
  const security = await readProjectFile("SECURITY.md")

  for (const required of [
    /short summary/i,
    /Affected feature/i,
    /Safe reproduction steps/i,
    /Expected impact/i,
    /Environment and version/i,
    /public credit/i,
  ]) {
    assert.match(security, required)
  }
})

test("SECURITY-002: SECURITY.md keeps maintainer response honest (best-effort, no SLA)", async () => {
  const security = await readProjectFile("SECURITY.md")

  assert.match(security, /best-effort/i)
  assert.match(security, /no guaranteed response time or SLA/i)
  assert.match(security, /authentication/i)
  assert.match(security, /workspace isolation/i)
  assert.match(security, /import\/export/i)
})

test("SECURITY-002: SECURITY.md includes coordinated disclosure wording", async () => {
  const security = await readProjectFile("SECURITY.md")

  assert.match(security, /avoid public disclosure/i)
  assert.match(security, /GitHub Security Advisories/i)
})

test("SECURITY-002: SECURITY.md notes a dedicated email may come later", async () => {
  const security = await readProjectFile("SECURITY.md")

  assert.match(security, /dedicated security email may be added later/i)
})

test("SECURITY-002: SECURITY.md makes no false security maturity claims", async () => {
  const security = await readProjectFile("SECURITY.md")

  // Maturity terms may only appear inside an honest negation. Check the whole
  // line containing each mention for a negation word.
  const maturityPatterns = [
    { name: "bug bounty", pattern: /bug bounty/i },
    { name: "SLA", pattern: /\bSLA\b/i },
    { name: "SOC 2", pattern: /SOC ?2/i },
    { name: "formal audit", pattern: /formal audit/i },
    { name: "round-the-clock", pattern: /round-the-clock/i },
  ]
  const lines = security.split(/\n/)
  for (const { name, pattern } of maturityPatterns) {
    for (const line of lines) {
      if (pattern.test(line)) {
        assert.match(
          line.toLowerCase(),
          /\bno\b|\bnot\b|\bwithout\b|\bnone\b/,
          `maturity term "${name}" must appear only in a negation line`
        )
      }
    }
  }

  // "production-ready"/"production-hardened" may only appear in an honest
  // negation. Check the whole line for a negation word.
  for (const line of lines) {
    if (/production[- ]?(ready|hardened)/i.test(line)) {
      assert.match(
        line.toLowerCase(),
        /\bno\b|\bnot\b|\bwithout\b|\bnone\b/,
        "production-ready/hardened must appear only in a negation line"
      )
    }
  }
})

test("SECURITY-002: public issue templates do not request vulnerability reproduction details", async () => {
  const templateFiles: string[] = []
  for await (const entry of glob(".github/ISSUE_TEMPLATE/**/*", { cwd: root })) {
    templateFiles.push(entry.replaceAll("\\", "/"))
  }

  for (const file of templateFiles) {
    const content = await readProjectFile(file)
    assert.doesNotMatch(
      content,
      /proof.of.concept|exploit (steps|details)|reproduce (the |this )?vulnerability/i,
      `${file} should not request vulnerability reproduction details`
    )
  }
})
