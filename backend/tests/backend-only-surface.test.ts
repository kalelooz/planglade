import assert from "node:assert/strict"
import { existsSync, readdirSync } from "node:fs"
import test from "node:test"

import { NextRequest } from "next/server"
import { proxy } from "../src/proxy"

test("the transitional Next application exposes API routes only", () => {
  assert.deepEqual(readdirSync("src/app").sort(), ["api", "layout.tsx"])
  assert.equal(existsSync("src/components"), false)
  assert.equal(existsSync("src/hooks"), false)
  assert.equal(existsSync("public"), false)
  assert.equal(existsSync("Caddyfile"), false)

  for (const pathname of ["/", "/auth/login", "/setup", "/tasks", "/_next/static/example.js"]) {
    const response = proxy(new NextRequest(`http://127.0.0.1:3000${pathname}`))
    assert.equal(response?.status, 404, pathname)
  }
})

test("the API gateway still passes normal requests and blocks demo mutations", async () => {
  assert.equal(proxy(new NextRequest("http://127.0.0.1:3000/api/auth/session")), undefined)

  const response = proxy(new NextRequest("http://127.0.0.1:3000/api/work-items", {
    method: "POST",
    headers: { "x-planglade-demo-mode": "true" },
  }))
  assert.equal(response?.status, 403)
  assert.deepEqual(await response?.json(), { error: "Demo mode - changes are disabled." })
})
