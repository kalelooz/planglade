import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("shared API utilities do not eagerly import Firebase Admin", async () => {
  const apiUtils = await readFile(new URL("../src/lib/api-utils.ts", import.meta.url), "utf8")
  assert.doesNotMatch(apiUtils, /import\s+\{[^}]*verifyFirebaseIdToken[^}]*\}\s+from\s+["']@\/lib\/firebase-admin["']/)
  assert.match(apiUtils, /await import\(["']@\/lib\/firebase-admin["']\)/)
})

test("storage configuration does not eagerly import Firebase Admin", async () => {
  const storage = await readFile(new URL("../src/lib/storage.ts", import.meta.url), "utf8")
  assert.doesNotMatch(storage, /import\s+\{[^}]*getFirebaseStorageBucket[^}]*\}\s+from\s+["']@\/lib\/firebase-admin["']/)
  assert.match(storage, /await import\(["']@\/lib\/firebase-admin["']\)/)
})
