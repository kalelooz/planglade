import { mkdir, readFile, readdir, rm } from "node:fs/promises"
import { DatabaseSync } from "node:sqlite"
import path from "node:path"

const databasePath = path.resolve("test-results", "browser-map.db")
const migrationsPath = path.resolve("prisma", "migrations")

await mkdir(path.dirname(databasePath), { recursive: true })
await rm(databasePath, { force: true })

const database = new DatabaseSync(databasePath)
try {
  const migrations = (await readdir(migrationsPath, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  for (const migration of migrations) {
    database.exec(await readFile(path.join(migrationsPath, migration, "migration.sql"), "utf8"))
  }
} finally {
  database.close()
}
