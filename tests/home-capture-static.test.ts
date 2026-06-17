import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

test("Home capture does not use the local inbox pre-write path", () => {
  const source = readFileSync("src/components/flowboard-home.tsx", "utf8")

  assert.equal(source.includes("addInboxItem"), false)
  assert.equal(source.includes("state.inboxItems"), false)
})
