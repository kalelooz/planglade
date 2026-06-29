import assert from "node:assert/strict"
import test from "node:test"

import { normalizeProjectFeatureFlags } from "../src/lib/project-flags"

test("enables core task structure features by default", () => {
  const flags = normalizeProjectFeatureFlags(null)

  assert.equal(flags.subtasks, true)
  assert.equal(flags.relations, true)
})

test("keeps explicit subtasks disabled flag", () => {
  const flags = normalizeProjectFeatureFlags({ subtasks: false })

  assert.equal(flags.subtasks, false)
})

test("keeps future modules hidden by default", () => {
  const flags = normalizeProjectFeatureFlags(null)

  assert.equal(flags.docs, false)
  assert.equal(flags.customFields, false)
  assert.equal(flags.sla, false)
})

test("blocks SLA for standard projects even when requested", () => {
  const flags = normalizeProjectFeatureFlags(
    { sla: true, docs: true, customFields: true },
    { mode: "STANDARD" }
  )

  assert.equal(flags.docs, true)
  assert.equal(flags.customFields, true)
  assert.equal(flags.sla, false)
})

test("allows SLA only for service desk projects", () => {
  const flags = normalizeProjectFeatureFlags({ sla: true }, { mode: "SERVICE_DESK" })

  assert.equal(flags.sla, true)
})
