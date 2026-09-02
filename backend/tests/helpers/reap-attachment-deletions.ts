import { db } from "../../src/lib/db"
import { reapPendingAttachmentDeletions } from "../../src/lib/attachment-deletion"

async function main() {
  const now = new Date(process.argv[2] ?? "")
  if (Number.isNaN(now.getTime())) throw new Error("A valid retry time is required")

  try {
    const result = await reapPendingAttachmentDeletions(now, { clock: () => now })
    process.stdout.write(`\nATTACHMENT_DELETION_RESULT=${JSON.stringify(result)}\n`)
  } finally {
    await db.$disconnect()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
