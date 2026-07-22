import assert from "node:assert/strict"
import { execFile, spawn } from "node:child_process"
import { createServer, request as httpRequest } from "node:http"
import { createServer as createHttpsServer } from "node:https"
import { randomBytes } from "node:crypto"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { promisify } from "node:util"
import { chromium } from "@playwright/test"

const execFileAsync = promisify(execFile)
const repoRoot = path.resolve(import.meta.dirname, "..")
const composeFile = path.join(repoRoot, "docker-compose.fresh-install.yml")
const host = "127.0.0.1"
const projectName = `planglade-proof-${Date.now()}-${randomBytes(3).toString("hex")}`
const runtimeDir = await mkdtemp(path.join(tmpdir(), "planglade-fresh-install-"))
const envPath = path.join(runtimeDir, "proof.env")
const certificateDir = path.join(runtimeDir, "certificate")
const setupToken = randomBytes(32).toString("hex")
const nextAuthSecret = randomBytes(32).toString("hex")
const throttleSecret = randomBytes(32).toString("hex")
const storageSecret = randomBytes(32).toString("hex")
const ownerEmail = `proof-owner-${randomBytes(4).toString("hex")}@example.test`
const ownerPassword = `Proof password ${randomBytes(12).toString("hex")}`
const ownerName = "Fresh Install Owner"
const workspaceName = "Fresh Install Workspace"
const taskTitle = "Fresh install task proof"
const captureTitle = "Fresh install inbox capture"
const projectTitle = "Fresh install project"
const noteTitle = "Fresh install note"

let appPort
let proxyPort
let browser
let proxy
let composeStarted = false

function record(results, name, value = true) {
  results.push({ name, passed: value })
  assert.equal(value, true, name)
}

async function freePort() {
  const server = createServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, host, resolve)
  })
  const port = server.address().port
  await new Promise((resolve) => server.close(resolve))
  return port
}

async function run(command, args, options = {}) {
  const result = await execFileAsync(command, args, {
    cwd: repoRoot,
    maxBuffer: 16 * 1024 * 1024,
    ...options,
  })
  return result.stdout
}

async function compose(args, options = {}) {
  return run("docker", ["compose", "--project-name", projectName, "--env-file", envPath, "-f", composeFile, ...args], options)
}

async function writeEnvironment(includeSetupToken) {
  const lines = [
    `PLANGLADE_PROOF_ENV_FILE=${envPath.replaceAll("\\", "/")}`,
    `COMPOSE_PROJECT_NAME=${projectName}`,
    `PLANGLADE_PROOF_APP_PORT=${appPort}`,
    `NEXTAUTH_URL=https://${host}:${proxyPort}`,
    `NEXTAUTH_SECRET=${nextAuthSecret}`,
    `PLANGLADE_THROTTLE_SECRET=${throttleSecret}`,
    `PLANGLADE_STORAGE_SIGNING_SECRET=${storageSecret}`,
    "PLANGLADE_AUTH_MODE=nextauth",
    "NEXT_PUBLIC_PLANGLADE_AUTH_MODE=nextauth",
    "PLANGLADE_LOCAL_AUTH_ENABLED=true",
    "PLANGLADE_STORAGE_PROVIDER=local",
    "PLANGLADE_EMAIL_PROVIDER=disabled",
  ]
  if (includeSetupToken) lines.push(`PLANGLADE_SETUP_TOKEN=${setupToken}`)
  await writeFile(envPath, `${lines.join("\n")}\n`, { mode: 0o600 })
}

async function createCertificate() {
  await run("node", ["-e", `require("node:fs").mkdirSync(${JSON.stringify(certificateDir)}, { recursive: true })`])
  const keyPath = path.join(certificateDir, "proof-key.pem")
  const certPath = path.join(certificateDir, "proof-cert.pem")
  const args = [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=127.0.0.1",
  ]
  const commands = process.platform === "win32"
    ? ["openssl.exe", "C:\\Program Files\\Git\\usr\\bin\\openssl.exe"]
    : ["openssl"]
  let lastError
  for (const command of commands) {
    try {
      await execFileAsync(command, args, { cwd: repoRoot, maxBuffer: 1024 * 1024 })
      return { keyPath, certPath }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error("OpenSSL is required for the HTTPS proof.")
}

async function startProxy() {
  const { keyPath, certPath } = await createCertificate()
  const [key, cert] = await Promise.all([readFile(keyPath), readFile(certPath)])
  proxy = createHttpsServer({ key, cert }, (request, response) => {
    const upstream = request.pipe(
      httpRequest({
        hostname: host,
        port: appPort,
        method: request.method,
        path: request.url,
        headers: {
          ...request.headers,
          host: `${host}:${proxyPort}`,
          "x-forwarded-proto": "https",
          "x-forwarded-host": `${host}:${proxyPort}`,
        },
      }, (upstreamResponse) => {
        response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers)
        upstreamResponse.pipe(response)
      }),
    )
    upstream.on("error", () => {
      if (!response.headersSent) response.writeHead(502)
      response.end()
    })
  })
  await new Promise((resolve, reject) => {
    proxy.once("error", reject)
    proxy.listen(proxyPort, host, resolve)
  })
}

async function stopProxy() {
  if (!proxy) return
  await new Promise((resolve) => proxy.close(resolve))
  proxy = undefined
}

async function waitForHealth(baseUrl) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/health`)
      if (response.ok && (await response.json()).status === "ok") return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  throw new Error("Disposable PlanGlade app did not become healthy.")
}

async function databaseSummary() {
  const code = `import { DatabaseSync } from "node:sqlite"; const db = new DatabaseSync("/app/db/planglade.db"); const tables = ["User", "LocalCredential", "Workspace", "WorkspaceMember", "SelfHostSetup", "LocalRecoveryCode", "AuthThrottle"]; const result = Object.fromEntries(tables.map((table) => [table, db.prepare("SELECT COUNT(*) AS count FROM \\\"" + table + "\\\"").get().count])); result.setup = db.prepare("SELECT status FROM \\\"SelfHostSetup\\\" WHERE id = 'singleton'").get()?.status ?? null; console.log(JSON.stringify(result)); db.close();`
  const output = await compose(["exec", "-T", "app", "node", "--input-type=module", "-e", code])
  const jsonLine = output.trim().split(/\r?\n/).findLast((line) => line.trim().startsWith("{"))
  assert.ok(jsonLine, "database summary was not returned")
  return JSON.parse(jsonLine)
}

async function assertPage(page, pathname, text) {
  const response = await page.goto(pathname, { waitUntil: "domcontentloaded" })
  assert.ok(response && response.status() < 400, `${pathname} returned an HTTP error`)
  if (text) await page.getByText(text, { exact: true }).first().waitFor()
}

const results = []
try {
  appPort = await freePort()
  proxyPort = await freePort()
  await writeEnvironment(false)
  await startProxy()

  composeStarted = true
  await compose(["up", "-d", "--build"])
  await waitForHealth(`http://${host}:${appPort}`)

  browser = await chromium.launch({ headless: true })
  const missingContext = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: `https://${host}:${proxyPort}` })
  const missingPage = await missingContext.newPage()
  const missingDiscovery = await missingContext.request.get("/api/auth/setup")
  const missingBody = await missingDiscovery.text()
  record(results, "missing setup token is unavailable", missingDiscovery.ok() && JSON.parse(missingBody).status === "unavailable")
  const missingClaim = await missingContext.request.post("/api/auth/setup/claim", {
    data: { setupToken: randomBytes(32).toString("hex") },
    headers: { origin: `https://${host}:${proxyPort}` },
  })
  const missingClaimBody = await missingClaim.text()
  record(results, "missing setup token claim fails closed", missingClaim.status() >= 400 && !missingClaimBody.includes("database") && !missingClaimBody.includes("stack"))
  await missingPage.goto("/app", { waitUntil: "domcontentloaded" })
  await missingPage.waitForURL((url) => url.pathname !== "/app", { timeout: 10_000 }).catch(() => {})
  record(results, "missing setup token does not expose /app", new URL(missingPage.url()).pathname !== "/app")
  const missingSummary = await databaseSummary()
  record(results, "missing setup token creates no owner", missingSummary.User === 0 && missingSummary.Workspace === 0)
  await missingContext.close()

  await compose(["down"])
  await writeEnvironment(true)
  await compose(["up", "-d", "--force-recreate"])
  await waitForHealth(`http://${host}:${appPort}`)

  const context = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: `https://${host}:${proxyPort}` })
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: `https://${host}:${proxyPort}` })
  const page = await context.newPage()
  await page.addInitScript(() => { window.print = () => {} })
  await assertPage(page, "/login", "Welcome back")
  await page.getByLabel("Email").waitFor()
  record(results, "local credentials are visible without OAuth", await page.getByLabel("Password").isVisible() && await page.getByRole("button", { name: "Continue with Google" }).count() === 0)
  record(results, "Firebase and OAuth controls are absent", !(await page.locator("body").innerText()).match(/Firebase|GitHub OAuth|Google sign-in failed/i))

  const secondContext = await browser.newContext({ ignoreHTTPSErrors: true, baseURL: `https://${host}:${proxyPort}` })
  const secondPage = await secondContext.newPage()
  await secondPage.goto("/login", { waitUntil: "domcontentloaded" })
  await secondContext.request.get("/api/auth/setup")
  await page.getByRole("link", { name: "Set up this self-hosted installation" }).click()
  await page.getByLabel("Setup token").fill(randomBytes(32).toString("hex"))
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await page.getByText("Setup authorization failed. Check the setup token and try again.", { exact: true }).waitFor()
  const invalidTokenValue = await page.locator("#setup-token").evaluate((element) => element instanceof HTMLInputElement ? element.value : "").catch(() => "")
  record(results, "invalid setup token input clears", invalidTokenValue === "")
  await page.reload()
  const refreshTokenValue = await page.locator("#setup-token").evaluate((element) => element instanceof HTMLInputElement ? element.value : "").catch(() => "")
  record(results, "refresh does not restore setup token", refreshTokenValue === "")
  await page.goBack()
  await page.goForward()
  const historyTokenValue = await page.locator("#setup-token").evaluate((element) => element instanceof HTMLInputElement ? element.value : "").catch(() => "")
  record(results, "back/forward does not restore setup token", historyTokenValue === "")
  await page.getByLabel("Setup token").fill(setupToken)
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await page.getByRole("heading", { name: "Create the owner" }).waitFor()
  const secondCsrf = (await secondContext.cookies()).find((cookie) => cookie.name === "planglade-setup-csrf")
  assert.ok(secondCsrf, "second claimant did not receive setup CSRF state")
  const secondClaim = await secondContext.request.post("/api/auth/setup/claim", {
    data: { setupToken },
    headers: {
      origin: `https://${host}:${proxyPort}`,
      "x-planglade-csrf": secondCsrf.value,
    },
  })
  const secondClaimBody = await secondClaim.text()
  record(results, "second claimant is rejected generically", secondClaim.status() >= 400 && !secondClaimBody.includes("claimant") && !secondClaimBody.includes("owner"))

  await page.getByLabel("Owner name").fill(ownerName)
  await page.getByLabel("Email").fill(ownerEmail)
  await page.getByLabel("Password", { exact: true }).fill(ownerPassword)
  await page.getByLabel("Confirm password").fill(ownerPassword)
  await page.getByLabel("Workspace name").fill(workspaceName)
  await page.getByRole("button", { name: "Create owner and workspace" }).click()
  await page.getByRole("heading", { name: "Recovery codes" }).waitFor()
  const recoveryCodes = (await page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem").allTextContents())
    .map((value) => value.replace(/^\s*\d+\.\s*/, "").trim())
  record(results, "exactly ten one-time recovery codes are shown", recoveryCodes.length === 10 && recoveryCodes.every((code) => /^[0-9a-f]{4}(?:-[0-9a-f]{4}){7}$/.test(code)))
  record(results, "recovery acknowledgement is required", await page.getByRole("button", { name: "Continue to login" }).isDisabled())
  record(results, "recovery handoff has no download control", await page.getByRole("link", { name: /download/i }).count() === 0)
  await page.getByRole("button", { name: "Copy all codes" }).click()
  const copied = await page.evaluate(() => navigator.clipboard.readText())
  record(results, "recovery copy works", copied.includes("PlanGlade recovery codes") && recoveryCodes.every((code) => copied.includes(code)))
  const popupPromise = context.waitForEvent("page", { timeout: 2_000 }).catch(() => null)
  await page.getByRole("button", { name: "Print codes" }).click()
  const printPage = await popupPromise
  const printText = printPage ? await printPage.locator("body").innerText().catch(() => "") : ""
  record(results, "print output excludes owner and setup secrets", printPage === null || (!printText.includes(ownerEmail) && !printText.includes(setupToken) && !printText.includes("cookie") && !printText.includes("workspace")))
  record(results, "print leaves recovery codes visible", await page.getByRole("list", { name: "Recovery codes" }).getByRole("listitem").count() === 10)
  await page.getByRole("checkbox", { name: /I saved these recovery codes/ }).check()
  await page.getByRole("button", { name: "Continue to login" }).click()
  await page.waitForURL(/\/login$/)
  record(results, "setup completion creates no authenticated session", !(await context.cookies()).some((cookie) => /(?:next-auth|authjs)\.session-token/.test(cookie.name)))
  record(results, "recovery codes are not persisted in browser storage", await page.evaluate(() => localStorage.length === 0 && sessionStorage.length === 0))
  const afterSetup = await databaseSummary()
  record(results, "repeated setup cannot create a second owner", afterSetup.User === 1 && afterSetup.Workspace === 1 && afterSetup.WorkspaceMember === 1)
  record(results, "one owner/workspace/membership is created", afterSetup.User === 1 && afterSetup.LocalCredential === 1 && afterSetup.Workspace === 1 && afterSetup.WorkspaceMember === 1 && afterSetup.setup === "COMPLETE")
  await secondContext.close()

  await page.getByLabel("Email").fill(ownerEmail)
  await page.getByLabel("Password").fill("wrong password that is long enough")
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.getByText("Email or password is incorrect.", { exact: true }).waitFor()
  const afterFailedLogin = await databaseSummary()
  record(results, "failed login remains generic and records throttle state", afterFailedLogin.AuthThrottle > 0)
  await page.getByLabel("Email").fill(ownerEmail)
  await page.getByLabel("Password").fill(ownerPassword)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/app/)
  const sessionResponse = await context.request.get("/api/auth/session")
  const session = await sessionResponse.json()
  record(results, "local login resolves server-derived session", session.authMode === "nextauth" && session.user.email === ownerEmail && session.workspace.name === workspaceName && session.members?.some((member) => member.role === "OWNER"))

  await assertPage(page, "/app", "Home")
  await assertPage(page, "/app/inbox", "Inbox")
  await page.getByLabel("Quick Capture").fill(captureTitle)
  await page.getByLabel("Quick Capture").press("Enter")
  await page.getByText(captureTitle, { exact: true }).waitFor()
  await assertPage(page, "/app/projects", "Projects")
  await page.getByRole("button", { name: "New project", exact: true }).first().click()
  await page.getByPlaceholder("e.g. Mobile App v3").fill(projectTitle)
  await page.getByRole("button", { name: "Create project", exact: true }).click()
  await page.getByText(projectTitle, { exact: true }).first().waitFor()
  await assertPage(page, "/app/tasks", "Tasks")
  await page.getByRole("button", { name: "New task", exact: true }).first().click()
  await page.getByPlaceholder("Task title").fill(taskTitle)
  await page.getByPlaceholder("Task title").press("Tab")
  await page.getByText(taskTitle, { exact: true }).waitFor()
  await assertPage(page, "/app/notes", "Notes")
  await page.getByPlaceholder("Quick capture a note.").fill(noteTitle)
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await page.getByText(noteTitle, { exact: true }).first().waitFor()
  for (const [pathname, label] of [["/app/calendar", "Calendar"], ["/app/connections", "Connections"], ["/app/settings", "Settings"]]) await assertPage(page, pathname, label)
  record(results, "authenticated core workspace smoke passes", true)

  await compose(["down"])
  await writeEnvironment(false)
  await compose(["up", "-d", "--force-recreate", "app"])
  await waitForHealth(`http://${host}:${appPort}`)
  await assertPage(page, "/setup", "Setup is not available")
  const setupAfterRemoval = await context.request.get("/api/auth/setup")
  record(results, "setup token removal keeps setup closed", setupAfterRemoval.ok() && (await setupAfterRemoval.json()).status === "unavailable")
  await page.goto("/login", { waitUntil: "domcontentloaded" })
  await page.getByLabel("Email").fill(ownerEmail)
  await page.getByLabel("Password").fill(ownerPassword)
  await page.getByRole("button", { name: "Sign in", exact: true }).click()
  await page.waitForURL(/\/app/)
  await assertPage(page, "/app/inbox", "Inbox")
  await page.getByText(captureTitle, { exact: true }).waitFor()
  await assertPage(page, "/app/tasks", "Tasks")
  await page.getByText(taskTitle, { exact: true }).waitFor()
  await assertPage(page, "/app/projects", "Projects")
  await page.getByText(projectTitle, { exact: true }).first().waitFor()
  await assertPage(page, "/app/notes", "Notes")
  await page.getByText(noteTitle, { exact: true }).first().waitFor()
  const afterRestart = await databaseSummary()
  record(results, "restart preserves auth and core data", afterRestart.User === 1 && afterRestart.Workspace === 1 && afterRestart.WorkspaceMember === 1 && afterRestart.setup === "COMPLETE")
  await context.close()

  console.log(JSON.stringify({ status: "passed", project: projectName, checks: results.map(({ name }) => name) }, null, 2))
} finally {
  if (browser) await browser.close().catch(() => {})
  await stopProxy().catch(() => {})
  if (composeStarted) await compose(["down", "--volumes", "--remove-orphans"]).catch(() => {})
  await rm(runtimeDir, { recursive: true, force: true }).catch(() => {})
}
