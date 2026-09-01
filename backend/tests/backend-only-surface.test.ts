import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"

import { NextRequest } from "next/server"
import { proxy } from "../src/proxy"

test("the transitional Next application exposes API routes only", () => {
  assert.deepEqual(readdirSync("src/app").sort(), ["api", "layout.tsx"])
  assert.equal(existsSync("src/components"), false)
  assert.equal(existsSync("src/hooks"), false)
  assert.equal(existsSync("public"), false)
  assert.equal(existsSync("Caddyfile"), false)

  for (const pathname of ["/", "/apiary", "/auth/login", "/setup", "/tasks", "/_next/static/example.js"]) {
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

test("the API gateway blocks cross-site requests for every unsafe route", () => {
  const apiRoot = path.resolve("src", "app", "api")
  const routeFiles: string[] = []
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name)
      if (entry.isDirectory()) visit(target)
      else if (entry.name === "route.ts") routeFiles.push(target)
    }
  }
  visit(apiRoot)

  let unsafeRoutes = 0
  for (const routeFile of routeFiles) {
    const source = readFileSync(routeFile, "utf8")
    const methods = ["POST", "PUT", "PATCH", "DELETE"].filter((method) =>
      new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`).test(source)
    )
    if (methods.length === 0) continue
    const relative = path.relative(apiRoot, path.dirname(routeFile)).replaceAll("\\", "/")
    const pathname = `/api/${relative}`.replace(/\[[^/]+\]/g, "test-id").replace(/\/$/, "")
    for (const method of methods) {
      unsafeRoutes += 1
      const response = proxy(new NextRequest(`http://127.0.0.1:3000${pathname}`, {
        method,
        headers: { "sec-fetch-site": "cross-site" },
      }))
      assert.equal(response?.status, 403, `${method} ${pathname}`)
    }
  }
  assert.ok(unsafeRoutes > 20)
})

test("the API gateway accepts the canonical origin and rejects a hostile origin", () => {
  const originalUrl = process.env.NEXTAUTH_URL
  process.env.NEXTAUTH_URL = "http://localhost:8080/"
  try {
    assert.equal(proxy(new NextRequest("http://localhost:8080/api/work-items", {
      method: "POST",
      headers: { origin: "http://localhost:8080", "sec-fetch-site": "same-origin" },
    })), undefined)
    assert.equal(proxy(new NextRequest("http://localhost:8080/api/work-items", {
      method: "POST",
      headers: { origin: "https://attacker.example", "sec-fetch-site": "same-site" },
    }))?.status, 403)
    assert.equal(proxy(new NextRequest("http://localhost:8080/api/work-items", {
      method: "POST",
    })), undefined)
  } finally {
    if (originalUrl === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = originalUrl
  }
})

test("the API gateway uses the request origin only for local development", () => {
  const originalNodeEnv = process.env.NODE_ENV
  const originalUrl = process.env.NEXTAUTH_URL
  delete process.env.NEXTAUTH_URL
  Reflect.set(process.env, "NODE_ENV", "development")
  try {
    assert.equal(proxy(new NextRequest("http://localhost:8080/api/work-items", {
      method: "POST",
      headers: { origin: "http://localhost:8080", "sec-fetch-site": "same-origin" },
    })), undefined)
    assert.equal(proxy(new NextRequest("http://localhost:8080/api/work-items", {
      method: "POST",
      headers: { origin: "https://attacker.example", "sec-fetch-site": "same-site" },
    }))?.status, 403)
  } finally {
    if (originalNodeEnv === undefined) Reflect.deleteProperty(process.env, "NODE_ENV")
    else Reflect.set(process.env, "NODE_ENV", originalNodeEnv)
    if (originalUrl === undefined) delete process.env.NEXTAUTH_URL
    else process.env.NEXTAUTH_URL = originalUrl
  }
})
