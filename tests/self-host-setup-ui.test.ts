import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import nextConfig from "../next.config"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("SELF-HOST-AUTH-UI-SETUP-001: setup route and one-time recovery screen exist", async () => {
  await access(path.join(root, "src/app/setup/page.tsx"))
  const source = await readProjectFile("src/app/setup/page.tsx")

  assert.match(source, /\/api\/auth\/setup/)
  assert.match(source, /\/api\/auth\/setup\/claim/)
  assert.match(source, /\/api\/auth\/setup\/complete/)
  assert.match(source, /type="password"/)
  assert.match(source, /autoComplete="off"/)
  assert.match(source, /I saved these recovery codes\. PlanGlade cannot show them again\./)
  assert.match(source, /router\.replace\("\/login"\)/)
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB/i)
})

test("SELF-HOST-AUTH-UI-SETUP-001: login supports local credentials and conditional setup discovery", async () => {
  const [loginPage, loginRoute, authContext] = await Promise.all([
    readProjectFile("src/components/lovable/login-page.tsx"),
    readProjectFile("src/app/login/page.tsx"),
    readProjectFile("src/components/lovable/auth-context.tsx"),
  ])

  assert.match(loginPage, /Continue with email/)
  assert.match(loginPage, /Set up this self-hosted installation/)
  assert.match(loginPage, /status === "available"/)
  assert.match(loginRoute, /localCredentials/)
  assert.match(authContext, /signInWithCredentials/)
  assert.match(authContext, /nextAuthSignIn\("credentials"/)
})

test("SELF-HOST-AUTH-UI-SETUP-001: setup page headers override the general policy", async () => {
  assert.ok(nextConfig.headers)
  const headers = await nextConfig.headers()
  const generalRule = headers.findIndex((rule) => rule.source === "/:path*")
  const setupRule = headers.findIndex((rule) => rule.source === "/setup")
  const setupHeaders = headers[setupRule]?.headers ?? []

  assert.ok(setupRule > generalRule)
  assert.ok(setupHeaders.some((header) => header.key === "Cache-Control" && header.value === "no-store, max-age=0"))
  assert.ok(setupHeaders.some((header) => header.key === "Referrer-Policy" && header.value === "no-referrer"))
})

test("PR-48-SETUP-RETRY-BROWSER-001: a temporary completion failure stays on the owner form", async () => {
  const source = await readProjectFile("src/app/setup/page.tsx")
  const completion = source.match(/async function completeSetup[\s\S]*?(?=\n  async function copyCodes)/)?.[0]

  assert.ok(completion)
  assert.match(completion, /if \(response\.status === 503\) \{\s*setFormError\("Setup is temporarily unavailable\. Try again\."\)\s*return/)
  assert.doesNotMatch(completion, /if \(response\.status === 503\) \{\s*setScreen\("temporary"\)/)
})

test("PR-48-SETUP-RETRY-BROWSER-001: CI enforces the isolated setup browser test", async () => {
  const workflow = await readProjectFile(".github/workflows/ci.yml")

  assert.match(workflow, /npx playwright test --config=playwright\.setup\.config\.ts/)
})
