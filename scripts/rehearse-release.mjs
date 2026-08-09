import assert from 'node:assert/strict'
import { cp, copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
await mkdir(path.join(root, '.runtime'), { recursive: true })
const rehearsalRoot = await mkdtemp(path.join(root, '.runtime', 'release-rehearsal-'))
const databasePath = path.join(rehearsalRoot, 'planglade.db')
const attachmentRoot = path.join(rehearsalRoot, 'attachments')
const backupRoot = path.join(rehearsalRoot, 'backup')
let database

try {
  database = new DatabaseSync(databasePath)
  database.exec('PRAGMA foreign_keys = ON')

  const migrationRoot = path.join(root, 'backend/prisma/migrations')
  const migrations = (await readdir(migrationRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  assert.ok(migrations.length > 0, 'Release rehearsal requires at least one migration')
  for (const migration of migrations) {
    database.exec(await readFile(path.join(migrationRoot, migration, 'migration.sql'), 'utf8'))
  }

  const now = new Date().toISOString()
  database.prepare('INSERT INTO User (id, email, name, updatedAt) VALUES (?, ?, ?, ?)')
    .run('release-owner', 'release-rehearsal@example.invalid', 'Release Rehearsal', now)
  database.prepare('INSERT INTO Workspace (id, slug, name, ownerId, updatedAt) VALUES (?, ?, ?, ?, ?)')
    .run('release-workspace', 'release-rehearsal', 'Release rehearsal', 'release-owner', now)
  database.prepare('INSERT INTO WorkspaceMember (id, workspaceId, userId, role) VALUES (?, ?, ?, ?)')
    .run('release-membership', 'release-workspace', 'release-owner', 'OWNER')
  database.prepare('INSERT INTO Project (id, workspaceId, name, slug, createdById, updatedAt) VALUES (?, ?, ?, ?, ?, ?)')
    .run('restore-sentinel', 'release-workspace', 'Restore sentinel', 'restore-sentinel', 'release-owner', now)
  database.close()
  database = undefined

  await mkdir(attachmentRoot, { recursive: true })
  await writeFile(path.join(attachmentRoot, 'sentinel.txt'), 'PlanGlade restore rehearsal\n')
  await mkdir(backupRoot)
  await copyFile(databasePath, path.join(backupRoot, 'planglade.db'))
  await cp(attachmentRoot, path.join(backupRoot, 'attachments'), { recursive: true })

  database = new DatabaseSync(databasePath)
  database.exec('PRAGMA foreign_keys = ON; DELETE FROM Project;')
  database.close()
  database = undefined
  await rm(attachmentRoot, { recursive: true, force: true })

  await copyFile(path.join(backupRoot, 'planglade.db'), databasePath)
  await cp(path.join(backupRoot, 'attachments'), attachmentRoot, { recursive: true })

  database = new DatabaseSync(databasePath, { readOnly: true })
  const integrity = database.prepare('PRAGMA integrity_check').get()
  assert.equal(Object.values(integrity)[0], 'ok')
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM Project WHERE slug = 'restore-sentinel'").get().count, 1)
  assert.equal(await readFile(path.join(attachmentRoot, 'sentinel.txt'), 'utf8'), 'PlanGlade restore rehearsal\n')
  console.log(`Release rehearsal passed: ${migrations.length} migration(s), consistent backup, destructive mutation, database restore, attachment restore, and integrity check.`)
} finally {
  database?.close()
  await rm(rehearsalRoot, { recursive: true, force: true })
}
