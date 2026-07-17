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

test("SELF-HOST-AUTH-UI-SETUP-001: login keeps setup discovery separate from server-gated local credentials", async () => {
  const [loginPage, loginRoute, authContext] = await Promise.all([
    readProjectFile("src/components/lovable/login-page.tsx"),
    readProjectFile("src/app/login/page.tsx"),
    readProjectFile("src/components/lovable/auth-context.tsx"),
  ])

  assert.match(loginPage, /Set up this self-hosted installation/)
  assert.match(loginPage, /status === "available"/)
  assert.match(loginPage, /Object\.keys\(payload\)\.length === 1/)
  assert.doesNotMatch(loginPage, /Continue with email|signInWithCredentials/)
  assert.match(loginPage, /nextAuthSignIn\("credentials"/)
  assert.match(loginRoute, /getProviderCapabilities\(\)\.localCredentials/)
  assert.doesNotMatch(authContext, /signInWithCredentials/)
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

test("SELF-HOST-AUTH-UI-SETUP-001: a retryable completion failure stays on the owner form without retrying", async () => {
  const source = await readProjectFile("src/app/setup/page.tsx")
  const completion = source.match(/async function completeSetup[\s\S]*?(?=\n  async function copyCodes)/)?.[0]

  assert.ok(completion)
  assert.match(completion, /Setup could not be completed\. Check the details and try again\./)
  assert.doesNotMatch(completion, /retry|setTimeout|setInterval/i)
})

test("SELF-HOST-AUTH-UI-SETUP-001: requests use the approved paths, CSRF header, and no persistence", async () => {
  const source = await readProjectFile("src/app/setup/page.tsx")

  assert.match(source, /x-planglade-csrf/)
  assert.match(source, /credentials: "same-origin"/)
  assert.match(source, /cache: "no-store"/)
  assert.match(source, /JSON\.stringify\(\{ name: name\.trim\(\), email: email\.trim\(\), password, workspaceName: workspaceName\.trim\(\) \}\)/)
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|caches\.|serviceWorker/i)
  assert.doesNotMatch(source, /nextAuth|JSON\.stringify\(\{[^}]*confirmation/i)
})

test("SELF-HOST-AUTH-UI-SETUP-001: approved state copy and cleanup hooks are present", async () => {
  const source = await readProjectFile("src/app/setup/page.tsx")

  for (const text of [
    "Checking setup availability",
    "Authorize setup",
    "Create the owner",
    "Recovery codes",
    "Setup is not available",
    "Setup is temporarily unavailable",
    "Your setup session expired. Enter the setup token again to continue.",
    "Setup may already be complete. Try signing in with the owner email and password you entered.",
  ]) assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))

  assert.match(source, /pagehide/)
  assert.match(source, /replaceChildren/)
  assert.match(source, /router\.replace\("\/login"\)/)
  assert.match(source, /activeRequestRef\.current\?\.abort\(\)/)
  assert.match(source, /mountedRef\.current = true/)
  assert.match(source, /mountedRef\.current = false/)
})

test("SELF-HOST-AUTH-UI-SETUP-001: email validation shares the server rule and print failures are contained", async () => {
  const source = await readProjectFile("src/app/setup/page.tsx")

  assert.match(source, /import \{ normalizeEmail \} from "@\/lib\/local-auth-email"/)
  assert.match(source, /values\.email\.length > 320 \|\| !normalizeEmail\(values\.email\)/)
  assert.match(source, /try \{[\s\S]*printWindow\.print\(\)[\s\S]*\} catch \{[\s\S]*Print failed\. Select and copy the codes manually\./)
  assert.match(source, /finally \{[\s\S]*printWindow\?\.close\(\)/)
})

test("PR-48-SETUP-RETRY-BROWSER-001: CI enforces the isolated setup browser test", async () => {
  const workflow = await readProjectFile(".github/workflows/ci.yml")

  assert.match(workflow, /npx playwright test --config=playwright\.setup\.config\.ts/)
})

test("PR-48-FINAL-E2E-FIX: setup browser config uses an absolute disposable database path", async () => {
  const config = await readProjectFile("playwright.setup.config.ts")

  assert.match(config, /path\.resolve\("test-results", "browser-setup\.db"\)/)
  assert.match(config, /DATABASE_URL: databaseUrl/)
})
