import { access } from "node:fs/promises"

import { db } from "../../src/lib/db"
import { consumeWorkspaceInviteDeliveryRateLimit } from "../../src/lib/workspace-invite-rate-limit"

async function main() {
  const startFile = process.env.PLANGLADE_RATE_LIMIT_START_FILE
  if (!startFile) throw new Error("PLANGLADE_RATE_LIMIT_START_FILE is required")

  while (true) {
    try {
      await access(startFile)
      break
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 10))
    }
  }

  const results: Array<{ allowed: boolean; retryAfterSeconds: number }> = []
  for (let attempt = 0; attempt < 2; attempt += 1) {
    results.push(
      await consumeWorkspaceInviteDeliveryRateLimit({
        action: "test",
        actorUserId: "two-process-account",
        workspaceId: "two-process-workspace",
        recipientEmail: "two-process@example.com",
      }, new Date("2026-09-02T08:30:00.000Z"))
    )
  }

  process.stdout.write(`${JSON.stringify(results.map((result) => result.allowed))}\n`)
  await db.$disconnect()
}

void main().catch(async (error) => {
  console.error(error)
  await db.$disconnect()
  process.exitCode = 1
})
