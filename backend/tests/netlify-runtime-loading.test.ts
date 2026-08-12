import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("the canonical principal boundary does not eagerly import Firebase Admin", async () => {
  const principal = await readFile(
    new URL("../src/lib/permissions/principal.ts", import.meta.url),
    "utf8"
  )
  assert.doesNotMatch(principal, /import\s+\{[^}]*verifyFirebaseIdToken[^}]*\}\s+from\s+["']@\/lib\/firebase-admin["']/)
  assert.match(principal, /await import\(["']@\/lib\/firebase-admin["']\)/)
})

test("storage configuration does not eagerly import Firebase Admin", async () => {
  const storage = await readFile(new URL("../src/lib/storage.ts", import.meta.url), "utf8")
  assert.doesNotMatch(storage, /import\s+\{[^}]*getFirebaseStorageBucket[^}]*\}\s+from\s+["']@\/lib\/firebase-admin["']/)
  assert.match(storage, /await import\(["']@\/lib\/firebase-admin["']\)/)
})
