import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import test from "node:test"

const projectRoot = process.cwd()

test("API authorization uses the canonical principal boundary", () => {
  assert.equal(existsSync(join(projectRoot, "src/lib/permissions/session.ts")), false)
  assert.equal(existsSync(join(projectRoot, "src/lib/permissions/workspace.ts")), false)

  const apiUtils = readFileSync(join(projectRoot, "src/lib/api-utils.ts"), "utf8")
  assert.match(apiUtils, /@\/lib\/permissions\/principal/)
  assert.doesNotMatch(apiUtils, /permissions\/session|permissions\/workspace/)
})

test("direct workspace membership creation cannot create users", () => {
  const route = readFileSync(
    join(projectRoot, "src/app/api/workspace/members/route.ts"),
    "utf8"
  )

  assert.doesNotMatch(route, /db\.user\.(?:create|upsert)/)
  assert.match(route, /invitation/i)
})
