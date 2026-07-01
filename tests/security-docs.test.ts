import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { glob } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("SECURITY-002: SECURITY.md documents the dedicated security contact", async () => {
  const security = await readProjectFile("SECURITY.md")

  assert.match(security, /security@planglade\.com/)
})

test("SECURITY-002: SECURITY.md keeps private vulnerability reporting as primary path", async () => {
  const security = await readProjectFile("SECURITY.md")

  assert.match(security, /GitHub Private Vulnerability Reporting/i)
})

test("SECURITY-002: SECURITY.md warns against public exploit details", async () => {
  const security = await readProjectFile("SECURITY.md")

  // Must tell reporters not to put exploit details / secrets in public issues.
  assert.match(security, /Do not open a public issue with/i)
  assert.match(security, /exploit details/i)
  // Public-issue last-resort wording must be present and minimal.
  assert.match(security, /I need a private channel to report a security issue/i)
  assert.match(security, /last resort/i)
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
  // Must prioritize the high-impact areas listed in the ticket.
  assert.match(security, /authentication/i)
  assert.match(security, /workspace isolation/i)
  assert.match(security, /import\/export/i)
})

test("SECURITY-002: SECURITY.md includes coordinated disclosure wording", async () => {
  const security = await readProjectFile("SECURITY.md")

  assert.match(security, /avoid public disclosure/i)
  assert.match(security, /GitHub Security Advisories/i)
})

test("SECURITY-002: SECURITY.md makes no false security maturity claims", async () => {
  const security = await readProjectFile("SECURITY.md")

  // Maturity terms may only appear inside an honest negation. Check the whole
  // sentence (line) containing each mention for a negation word.
  const maturityTerms = [
    /bug bounty/gi,
    /\bSLA\b/gi,
    /SOC ?2/gi,
    /\bformal audit(ed|s)?\b/gi,
    /24\/7/gi,
  ]
  const lines = security.split(/\n/)
  for (const term of maturityTerms) {
    for (const line of lines) {
      if (term.test(line)) {
        assert.match(
          line.toLowerCase(),
          /\bno\b|\bnot\b|\bwithout\b|\bnone\b/,
          `maturity term "${term.source}" must appear only in a negation line`
        )
      }
    }
  }

  // No active claim of being production-ready/hardened.
  assert.doesNotMatch(security, /\b(is|are|now|already)\s+production[- ]?(ready|hardened)\b/i)
})

test("SECURITY-002: public issue templates do not request vulnerability reproduction details", async () => {
  const templateFiles: string[] = []
  for await (const entry of glob(".github/ISSUE_TEMPLATE/**/*", { cwd: root })) {
    templateFiles.push(entry.replaceAll("\\", "/"))
  }

  for (const file of templateFiles) {
    const content = await readProjectFile(file)
    // No public template should explicitly solicit exploit/POC details.
    assert.doesNotMatch(
      content,
      /proof.of.concept|exploit (steps|details)|reproduce (the |this )?vulnerability/i,
      `${file} should not request vulnerability reproduction details`
    )
  }
})
