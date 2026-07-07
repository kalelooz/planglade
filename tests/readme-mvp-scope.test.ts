import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

// README-TRIM-1 guards: the public README must match the current MVP scope and
// not market gated, deferred, or confusing features as available today. These
// checks are scoped (line/section based) to avoid false positives from
// substrings like "con-tent" or honest roadmap mentions.

test("README-TRIM-1: keeps honest maturity language", async () => {
  const readme = await readProjectFile("README.md")

  assert.match(readme, /not production-ready yet/i)
  assert.match(readme, /AGPL-3\.0/)
})

test("WEBSITE-POST-LIVE-AUDIT-001: README matches public solo-first launch wording", async () => {
  const readme = await readProjectFile("README.md")

  assert.match(readme, /Self-host now\. Cloud soon\. Try demo\./)
  assert.match(readme, /early Docker self-host baseline/i)
  assert.doesNotMatch(readme, /small teams/i)
})

test("README-TRIM-1: includes the MVP feature set and roadmap separation", async () => {
  const readme = await readProjectFile("README.md")

  // Core MVP surfaces named explicitly.
  assert.match(readme, /\bInbox\b/)
  assert.match(readme, /\bTasks\b/)
  assert.match(readme, /\bProjects\b/)
  assert.match(readme, /Notes and project context/)
  assert.match(readme, /\bCalendar\b/)
  assert.match(readme, /\bSettings\b/)

  // Roadmap section exists with the three honest tiers.
  assert.match(readme, /## Roadmap/)
  assert.match(readme, /\*\*Available Today\*\*/)
  assert.match(readme, /\*\*Next\*\*/)
  assert.match(readme, /\*\*Later\*\*/)
})

test("README-TRIM-1: does not list Timeline as available today", async () => {
  const readme = await readProjectFile("README.md")
  const availableSection =
    readme.match(/\*\*Available Today\*\*[\s\S]*?(?=\*\*Next\*\*)/)?.[0] ?? ""
  const featuresSection =
    readme.match(/## Features Available Today[\s\S]*?(?=\n## )/)?.[0] ?? ""

  // Timeline may appear, but only under Next, never under Available/Features.
  assert.doesNotMatch(availableSection, /Timeline/i)
  assert.doesNotMatch(featuresSection, /Timeline/i)
  // Sanity: Timeline IS mentioned under Next.
  const nextSection =
    readme.match(/\*\*Next\*\*[\s\S]*?(?=\*\*Later\*\*)/)?.[0] ?? ""
  assert.match(nextSection, /Timeline planning view/)
})

test("README-TRIM-1: does not market admin/team/invite surfaces as available today", async () => {
  const readme = await readProjectFile("README.md")
  const featuresSection =
    readme.match(/## Features Available Today[\s\S]*?(?=\n## )/)?.[0] ?? ""

  assert.doesNotMatch(featuresSection, /Team management/i)
  assert.doesNotMatch(featuresSection, /member and invitation/i)
  assert.doesNotMatch(featuresSection, /admin/i)
  assert.doesNotMatch(featuresSection, /Activity feed/i)
  assert.doesNotMatch(featuresSection, /Work Map|Connections graph/i)
  assert.doesNotMatch(featuresSection, /Reports/i)
})

test("README-TRIM-1: does not market Project Docs as a visible current feature", async () => {
  const readme = await readProjectFile("README.md")
  const featuresSection =
    readme.match(/## Features Available Today[\s\S]*?(?=\n## )/)?.[0] ?? ""

  // No "Project-scoped docs" / "Project Docs" line as an available feature.
  assert.doesNotMatch(featuresSection, /Project-scoped docs/i)
  assert.doesNotMatch(featuresSection, /Project Docs/i)
  // Project notes/context stays the visible surface.
  assert.match(featuresSection, /Project notes and context/)
})

test("README-TRIM-1: does not promise pricing or hosted cloud as available", async () => {
  const readme = await readProjectFile("README.md")
  const featuresSection =
    readme.match(/## Features Available Today[\s\S]*?(?=\n## )/)?.[0] ?? ""
  const availableSection =
    readme.match(/\*\*Available Today\*\*[\s\S]*?(?=\*\*Next\*\*)/)?.[0] ?? ""

  // No pricing/tier/seat promises inside the MVP feature lists. Honest
  // negations elsewhere (e.g. "No pricing page") are allowed and expected.
  for (const section of [featuresSection, availableSection]) {
    assert.doesNotMatch(section, /pricing/i)
    assert.doesNotMatch(section, /paid (tier|plan|feature)s?/i)
    assert.doesNotMatch(section, /per-seat|seat pricing/i)
    assert.doesNotMatch(section, /hosted cloud/i)
  }

  // Hosted cloud may only appear under Later (or in honest negations).
  const laterSection =
    readme.match(/\*\*Later\*\*[\s\S]*?(?=\n## |\nRoutes )/)?.[0] ?? ""
  assert.match(laterSection, /Hosted cloud option/)
})

test("README-TRIM-1: no fake AI claims", async () => {
  const readme = await readProjectFile("README.md")

  assert.doesNotMatch(readme, /AI-powered|AI assistant|artificial intelligence/i)
  assert.doesNotMatch(readme, /AI assistance (is )?(available|included|ready)/i)
})
