import { mkdtempSync, readFileSync, readdirSync } from "node:fs"
import { rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { DatabaseSync } from "node:sqlite"
import path from "node:path"

function isInside(child: string, parent: string) {
  const relative = path.relative(parent, child)
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
}

export function assertIsolatedDatabaseUrl(databaseUrl: string | undefined, temporaryDirectory: string) {
  if (!databaseUrl) throw new Error("DATABASE_URL is required for database-backed auth tests")
  if (!databaseUrl.startsWith("file:")) throw new Error("DATABASE_URL must be a SQLite file URL")

  const rawPath = decodeURIComponent(databaseUrl.slice("file:".length)).replace(/^\/(\w:)/, "$1")
  const databasePath = path.resolve("prisma", rawPath)
  const repositoryDatabaseDirectory = path.resolve("db")
  if (path.basename(databasePath).toLowerCase() === "custom.db") {
    throw new Error("Auth tests refuse custom.db")
  }
  if (databasePath === repositoryDatabaseDirectory || isInside(databasePath, repositoryDatabaseDirectory)) {
    throw new Error("Auth tests refuse paths under the repository database directory")
  }
  if (!isInside(databasePath, path.resolve(temporaryDirectory))) {
    throw new Error("Auth test database must be inside its temporary directory")
  }
  return databasePath
}

export function createIsolatedTestDatabase() {
  const directory = mkdtempSync(path.join(tmpdir(), "planglade-auth-test-"))
  const databaseUrl = `file:${path.join(directory, "test.db").replaceAll("\\", "/")}`
  process.env.DATABASE_URL = databaseUrl
  const databasePath = assertIsolatedDatabaseUrl(process.env.DATABASE_URL, directory)
  console.log(`Auth test database: ${databasePath}`)

  const database = new DatabaseSync(databasePath)
  try {
    const migrationsDirectory = path.resolve("prisma", "migrations")
    const migrations = readdirSync(migrationsDirectory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    for (const migration of migrations) {
      database.exec(readFileSync(path.join(migrationsDirectory, migration, "migration.sql"), "utf8"))
    }
  } finally {
    database.close()
  }

  return {
    databasePath,
    async cleanup() {
      delete process.env.DATABASE_URL
      await rm(directory, { recursive: true, force: true })
    },
  }
}
