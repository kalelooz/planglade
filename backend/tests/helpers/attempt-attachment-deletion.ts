import { db } from "../../src/lib/db"
import { attemptAttachmentDeletion } from "../../src/lib/attachment-deletion"

async function main() {
  const jobId = process.argv[2]
  const now = new Date(process.argv[3] ?? "")
  if (!jobId || Number.isNaN(now.getTime())) {
    throw new Error("A deletion job and valid attempt time are required")
  }

  try {
    const result = await attemptAttachmentDeletion(jobId, { clock: () => now })
    process.stdout.write(`\nATTACHMENT_DELETION_ATTEMPT=${result}\n`)
  } finally {
    await db.$disconnect()
  }
}

void main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
