import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"

import { assertIsolatedDatabaseUrl } from "./helpers/isolated-test-database"

function databaseUrl(databasePath: string) {
  return `file:${databasePath.replaceAll("\\", "/")}`
}

test("auth database guard rejects missing and non-temporary database URLs", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "planglade-auth-guard-"))
  try {
    assert.throws(() => assertIsolatedDatabaseUrl(undefined, directory), /DATABASE_URL is required/)
    assert.throws(
      () => assertIsolatedDatabaseUrl("file:../db/custom.db", directory),
      /custom\.db|repository database directory|temporary directory/
    )
    assert.throws(
      () => assertIsolatedDatabaseUrl(databaseUrl(path.resolve("db", "custom.db")), directory),
      /custom\.db|repository database directory/
    )
    assert.throws(
      () => assertIsolatedDatabaseUrl(databaseUrl(path.join(directory, "custom.db")), directory),
      /custom\.db/
    )
    assert.throws(
      () => assertIsolatedDatabaseUrl(databaseUrl(path.join(tmpdir(), "outside.db")), directory),
      /temporary directory/
    )
    assert.throws(
      () => assertIsolatedDatabaseUrl("file:/app/db/planglade.db", directory),
      /temporary directory/
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
