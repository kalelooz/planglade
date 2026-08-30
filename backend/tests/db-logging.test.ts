import assert from "node:assert/strict"
import test from "node:test"

import { getPrismaLogLevels } from "../src/lib/db"

test("production database logging excludes Prisma queries", () => {
  const levels: readonly string[] = getPrismaLogLevels("production")
  assert.deepEqual(levels, ["warn", "error"])
  assert.equal(levels.includes("query"), false)
})

test("development database logging retains query diagnostics", () => {
  assert.deepEqual(getPrismaLogLevels("development"), ["query", "warn", "error"])
})
