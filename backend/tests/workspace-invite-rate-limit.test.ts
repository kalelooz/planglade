import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { writeFile } from "node:fs/promises"
import test, { after, before } from "node:test"
import path from "node:path"

import { createIsolatedTestDatabase } from "./helpers/isolated-test-database"

const isolatedDatabase = createIsolatedTestDatabase()
let db: typeof import("../src/lib/db").db
let consumeWorkspaceInviteDeliveryRateLimit: typeof import("../src/lib/workspace-invite-rate-limit").consumeWorkspaceInviteDeliveryRateLimit

before(async () => {
  ;({ db } = await import("../src/lib/db"))
  ;({ consumeWorkspaceInviteDeliveryRateLimit } =
    await import("../src/lib/workspace-invite-rate-limit"))
})

after(async () => {
  await db.$disconnect()
  await isolatedDatabase.cleanup()
})

test("test invitation delivery returns a durable limit after three account attempts", async () => {
  const input = {
    action: "test" as const,
    actorUserId: "rate-limit-account",
    workspaceId: "rate-limit-workspace",
    recipientEmail: "recipient@example.com",
  }
  const now = new Date("2026-09-02T08:00:00.000Z")

  const results: Array<{ allowed: boolean; retryAfterSeconds: number }> = []
  for (let attempt = 0; attempt < 4; attempt += 1) {
    results.push(await consumeWorkspaceInviteDeliveryRateLimit(input, now))
  }

  assert.deepEqual(results.map((result) => result.allowed), [true, true, true, false])
  assert.ok(results[3]?.retryAfterSeconds && results[3].retryAfterSeconds > 0)
  const buckets = await db.authThrottle.findMany({ where: { scope: "INVITATION" } })
  assert.ok(buckets.length >= 1)
  assert.equal(buckets.some((bucket) => bucket.subjectKey.includes("recipient@example.com")), false)
})

test("two application processes share the same invitation quota", async () => {
  const startFile = path.join(path.dirname(isolatedDatabase.databasePath), "start-rate-limit")
  const workerPath = path.resolve("tests/helpers/workspace-invite-rate-limit-worker.ts")
  const runWorker = () =>
    new Promise<boolean[]>((resolve, reject) => {
      const child = spawn(process.execPath, ["--import", "tsx", workerPath], {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "production",
          PLANGLADE_RATE_LIMIT_START_FILE: startFile,
        },
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      })
      let stdout = ""
      let stderr = ""
      child.stdout.on("data", (chunk) => { stdout += String(chunk) })
      child.stderr.on("data", (chunk) => { stderr += String(chunk) })
      child.once("error", reject)
      child.once("exit", (code) => {
        if (code !== 0) {
          reject(new Error(`Rate-limit worker exited ${code}: ${stderr}`))
          return
        }
        resolve(JSON.parse(stdout.trim()) as boolean[])
      })
    })

  const workers = [runWorker(), runWorker()]
  await writeFile(startFile, "start\n", "utf8")
  const results = (await Promise.all(workers)).flat()

  assert.equal(results.filter(Boolean).length, 3)
  assert.equal(results.filter((allowed) => !allowed).length, 1)
})

test("create and resend attempts share the same recipient quota", async () => {
  const results: Array<{ allowed: boolean; retryAfterSeconds: number }> = []
  for (let attempt = 0; attempt < 6; attempt += 1) {
    results.push(
      await consumeWorkspaceInviteDeliveryRateLimit({
        action: attempt % 2 === 0 ? "create" : "resend",
        actorUserId: `shared-recipient-actor-${attempt}`,
        workspaceId: `shared-recipient-workspace-${attempt}`,
        recipientEmail: "shared-recipient@example.com",
      }, new Date("2026-09-02T08:45:00.000Z"))
    )
  }

  assert.deepEqual(results.map((result) => result.allowed), [true, true, true, true, true, false])
})
