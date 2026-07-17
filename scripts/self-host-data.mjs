import { createHash, randomUUID } from "node:crypto"
import { constants as fsConstants, createReadStream } from "node:fs"
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { pathToFileURL } from "node:url"

const BUNDLE_FORMAT = "planglade-self-host-backup"
const BUNDLE_VERSION = 1
const MANIFEST_FILE = "manifest.json"
const DATABASE_FILE = "database.sqlite"
const ATTACHMENTS_PREFIX = "attachments/"
const MAX_MANIFEST_BYTES = 64 * 1024 * 1024
const MAX_MANIFEST_FILES = 100_000
const HASH_PATTERN = /^[a-f0-9]{64}$/
const RESTORE_ARTIFACT_PREFIXES = [".planglade-restore-", ".planglade-rollback-"]

function fail(message) {
  throw new Error(message)
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys(value, keys) {
  return isPlainObject(value) &&
    Object.keys(value).sort().join("\0") === [...keys].sort().join("\0")
}

function isInsideOrEqual(candidate, parent) {
  const relative = path.relative(parent, candidate)
  return relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

function pathsOverlap(left, right) {
  return isInsideOrEqual(left, right) || isInsideOrEqual(right, left)
}

function resolveDatabasePath(databaseUrl, cwd) {
  if (typeof databaseUrl !== "string" || !databaseUrl.startsWith("file:")) {
    fail("DATABASE_URL must be an explicit SQLite file URL.")
  }
  const encodedPath = databaseUrl.slice("file:".length)
  if (!encodedPath || encodedPath.includes("?") || encodedPath.includes("#")) {
    fail("DATABASE_URL must contain one unambiguous SQLite path.")
  }
  let rawPath
  try {
    rawPath = decodeURIComponent(encodedPath)
  } catch {
    fail("DATABASE_URL contains an invalid encoded path.")
  }
  if (!rawPath || rawPath.includes("\0")) fail("DATABASE_URL contains an invalid path.")
  rawPath = rawPath.replace(/^\/([A-Za-z]:[\\/])/, "$1")
  return path.resolve(cwd, "prisma", rawPath)
}

function resolveDataPaths(env = process.env, cwd = process.cwd()) {
  const provider = (env.PLANGLADE_STORAGE_PROVIDER ?? "local").trim().toLowerCase()
  if (provider !== "local") {
    fail("Backup and restore support the public local storage provider only.")
  }
  if (!env.PLANGLADE_LOCAL_STORAGE_DIR?.trim()) {
    fail("PLANGLADE_LOCAL_STORAGE_DIR must be set explicitly.")
  }
  const databasePath = resolveDatabasePath(env.DATABASE_URL, cwd)
  const configuredAttachments = env.PLANGLADE_LOCAL_STORAGE_DIR.trim()
  const attachmentsPath = path.isAbsolute(configuredAttachments)
    ? path.resolve(configuredAttachments)
    : path.resolve(cwd, configuredAttachments)
  if (pathsOverlap(databasePath, attachmentsPath)) {
    fail("Database and attachment destinations overlap.")
  }
  return { databasePath, attachmentsPath }
}

async function kind(target) {
  try {
    const info = await lstat(target)
    if (info.isSymbolicLink()) return "symlink"
    if (info.isFile()) return "file"
    if (info.isDirectory()) return "directory"
    return "other"
  } catch (error) {
    if (error?.code === "ENOENT") return "missing"
    throw error
  }
}

async function requireDirectory(target, label) {
  if (await kind(target) !== "directory") fail(`${label} must be an existing ordinary directory.`)
}

async function requireFile(target, label) {
  if (await kind(target) !== "file") fail(`${label} must be an existing ordinary file.`)
  return lstat(target)
}

async function rejectSqliteSidecars(databasePath) {
  for (const suffix of ["-journal", "-wal", "-shm"]) {
    if (await kind(`${databasePath}${suffix}`) !== "missing") {
      fail("SQLite has an active sidecar file. Stop PlanGlade and checkpoint the database before continuing.")
    }
  }
}

function validateRelativePath(value) {
  if (
    typeof value !== "string" ||
    !value ||
    value.includes("\\") ||
    value.includes("\0") ||
    path.posix.isAbsolute(value) ||
    path.posix.normalize(value) !== value ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    fail("Backup manifest contains an unsafe path.")
  }
  return value
}

async function walkFiles(root) {
  await requireDirectory(root, "Directory")
  const files = []

  async function walk(current, parts) {
    const entries = await readdir(current, { withFileTypes: true })
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
    for (const entry of entries) {
      if (entry.name.includes("\\") || entry.name.includes("\0")) {
        fail("Directory contains an unsupported filename.")
      }
      const nextParts = [...parts, entry.name]
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(absolute, nextParts)
        continue
      }
      if (!entry.isFile()) fail("Directories used by backup and restore cannot contain links or special files.")
      const info = await requireFile(absolute, "Data entry")
      files.push({
        absolute,
        relative: validateRelativePath(nextParts.join("/")),
        size: info.size,
        mtimeMs: info.mtimeMs,
      })
    }
  }

  await walk(root, [])
  files.sort((left, right) => left.relative < right.relative ? -1 : left.relative > right.relative ? 1 : 0)
  return files
}

async function sha256File(filePath) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest("hex")
}

async function copyPrivateFile(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
  await copyFile(source, destination, fsConstants.COPYFILE_EXCL)
  await chmod(destination, 0o600)
}

async function sqliteMetadata(databasePath) {
  const info = await requireFile(databasePath, "SQLite database")
  if (info.size < 100) fail("SQLite database is too small to contain a valid header.")

  const header = Buffer.alloc(100)
  const handle = await open(databasePath, "r")
  try {
    const result = await handle.read(header, 0, header.length, 0)
    if (result.bytesRead !== header.length) fail("SQLite database header is incomplete.")
  } finally {
    await handle.close()
  }

  if (!header.subarray(0, 16).equals(Buffer.from("SQLite format 3\0", "binary"))) {
    fail("SQLite database header is invalid.")
  }
  const encodedPageSize = header.readUInt16BE(16)
  const pageSize = encodedPageSize === 1 ? 65_536 : encodedPageSize
  if (pageSize < 512 || pageSize > 65_536 || (pageSize & (pageSize - 1)) !== 0) {
    fail("SQLite database page format is unsupported.")
  }
  const writeVersion = header[18]
  const readVersion = header[19]
  if (![1, 2].includes(writeVersion) || ![1, 2].includes(readVersion)) {
    fail("SQLite database file format version is unsupported.")
  }
  const schemaFormat = header.readUInt32BE(44)
  if (schemaFormat < 1 || schemaFormat > 4) fail("SQLite schema format version is unsupported.")

  let database
  try {
    database = new DatabaseSync(databasePath, { readOnly: true })
    const quickCheck = database.prepare("PRAGMA quick_check").all()
    if (quickCheck.length !== 1 || Object.values(quickCheck[0])[0] !== "ok") {
      fail("SQLite integrity check failed.")
    }
    const userVersionRow = database.prepare("PRAGMA user_version").get()
    const userVersion = Object.values(userVersionRow)[0]
    if (!Number.isSafeInteger(userVersion) || userVersion < 0) {
      fail("SQLite user version is invalid.")
    }
    return { pageSize, writeVersion, readVersion, schemaFormat, userVersion }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("SQLite ")) throw error
    fail("SQLite integrity check failed.")
  } finally {
    database?.close()
  }
}

function sameFileSnapshot(left, right) {
  return left.size === right.size && left.mtimeMs === right.mtimeMs
}

function sameDirectorySnapshot(left, right) {
  if (left.length !== right.length) return false
  return left.every((entry, index) =>
    entry.relative === right[index].relative && sameFileSnapshot(entry, right[index]))
}

function validateFileRecord(value, expectedPath) {
  if (
    !hasExactKeys(value, ["path", "size", "sha256"]) ||
    validateRelativePath(value.path) !== expectedPath ||
    !Number.isSafeInteger(value.size) ||
    value.size < 0 ||
    typeof value.sha256 !== "string" ||
    !HASH_PATTERN.test(value.sha256)
  ) {
    fail("Backup manifest contains an invalid file record.")
  }
}

function validateManifest(value) {
  if (!hasExactKeys(value, ["format", "version", "createdAt", "database", "attachments"])) {
    fail("Backup manifest shape is incompatible.")
  }
  if (value.format !== BUNDLE_FORMAT || value.version !== BUNDLE_VERSION) {
    fail("Backup manifest format or version is incompatible.")
  }
  if (
    typeof value.createdAt !== "string" ||
    Number.isNaN(Date.parse(value.createdAt)) ||
    new Date(value.createdAt).toISOString() !== value.createdAt
  ) {
    fail("Backup manifest timestamp is invalid.")
  }
  if (!hasExactKeys(value.database, ["path", "size", "sha256", "sqlite"])) {
    fail("Backup manifest database record is invalid.")
  }
  validateFileRecord(
    { path: value.database.path, size: value.database.size, sha256: value.database.sha256 },
    DATABASE_FILE,
  )
  if (value.database.size < 100) fail("Backup manifest database size is invalid.")
  const sqlite = value.database.sqlite
  if (
    !hasExactKeys(sqlite, ["pageSize", "writeVersion", "readVersion", "schemaFormat", "userVersion"]) ||
    !Number.isSafeInteger(sqlite.pageSize) ||
    ![1, 2].includes(sqlite.writeVersion) ||
    ![1, 2].includes(sqlite.readVersion) ||
    !Number.isSafeInteger(sqlite.schemaFormat) ||
    sqlite.schemaFormat < 1 ||
    sqlite.schemaFormat > 4 ||
    !Number.isSafeInteger(sqlite.userVersion) ||
    sqlite.userVersion < 0
  ) {
    fail("Backup manifest SQLite format is incompatible.")
  }
  if (!Array.isArray(value.attachments) || value.attachments.length > MAX_MANIFEST_FILES) {
    fail("Backup manifest attachment list is invalid.")
  }
  let previousPath = ""
  for (const entry of value.attachments) {
    if (!isPlainObject(entry) || typeof entry.path !== "string" || !entry.path.startsWith(ATTACHMENTS_PREFIX)) {
      fail("Backup manifest attachment record is invalid.")
    }
    validateFileRecord(entry, entry.path)
    if (entry.path <= previousPath) fail("Backup manifest attachment paths must be unique and sorted.")
    previousPath = entry.path
  }
  return value
}

async function readManifest(bundlePath) {
  const manifestPath = path.join(bundlePath, MANIFEST_FILE)
  const info = await requireFile(manifestPath, "Backup manifest")
  if (info.size > MAX_MANIFEST_BYTES) fail("Backup manifest is too large.")
  let value
  try {
    value = JSON.parse(await readFile(manifestPath, "utf8"))
  } catch {
    fail("Backup manifest is not valid JSON.")
  }
  return validateManifest(value)
}

async function validateBundle(bundlePath) {
  await requireDirectory(bundlePath, "Backup bundle")
  const manifest = await readManifest(bundlePath)
  const expectedPaths = [
    MANIFEST_FILE,
    manifest.database.path,
    ...manifest.attachments.map((entry) => entry.path),
  ].sort()
  const actualFiles = await walkFiles(bundlePath)
  const actualPaths = actualFiles.map((entry) => entry.relative).sort()
  if (actualPaths.join("\0") !== expectedPaths.join("\0")) {
    fail("Backup bundle contains missing or unlisted files.")
  }

  for (const entry of [manifest.database, ...manifest.attachments]) {
    const filePath = path.join(bundlePath, ...entry.path.split("/"))
    const info = await requireFile(filePath, "Backup file")
    if (info.size !== entry.size || await sha256File(filePath) !== entry.sha256) {
      fail("Backup checksum validation failed.")
    }
  }
  const actualSqlite = await sqliteMetadata(path.join(bundlePath, DATABASE_FILE))
  for (const key of ["pageSize", "writeVersion", "readVersion", "schemaFormat", "userVersion"]) {
    if (actualSqlite[key] !== manifest.database.sqlite[key]) {
      fail("Backup SQLite format does not match its manifest.")
    }
  }
  return manifest
}

function resolveBundlePath(input, cwd, dataPaths) {
  if (typeof input !== "string" || !input.trim()) fail("A backup bundle path is required.")
  const bundlePath = path.resolve(cwd, input)
  if (
    pathsOverlap(bundlePath, dataPaths.attachmentsPath) ||
    isInsideOrEqual(dataPaths.databasePath, bundlePath) ||
    bundlePath === dataPaths.databasePath
  ) {
    fail("Backup bundle and live data paths must not overlap.")
  }
  return bundlePath
}

export async function createBackupBundle(input, options = {}) {
  const cwd = options.cwd ?? process.cwd()
  const dataPaths = resolveDataPaths(options.env ?? process.env, cwd)
  const bundlePath = resolveBundlePath(input, cwd, dataPaths)
  if (await kind(bundlePath) !== "missing") fail("Backup destination already exists; choose a new empty path.")
  await requireDirectory(path.dirname(bundlePath), "Backup destination parent")
  await requireFile(dataPaths.databasePath, "Live SQLite database")
  await requireDirectory(dataPaths.attachmentsPath, "Live attachment directory")
  await rejectSqliteSidecars(dataPaths.databasePath)

  const sourceDatabaseBefore = await lstat(dataPaths.databasePath)
  const sourceAttachmentsBefore = await walkFiles(dataPaths.attachmentsPath)
  const sourceSqlite = await sqliteMetadata(dataPaths.databasePath)
  const stagePath = path.join(path.dirname(bundlePath), `.${path.basename(bundlePath)}.tmp-${randomUUID()}`)
  if (await kind(stagePath) !== "missing") fail("Backup staging destination is ambiguous.")

  try {
    await mkdir(stagePath, { mode: 0o700 })
    const stagedDatabase = path.join(stagePath, DATABASE_FILE)
    await copyPrivateFile(dataPaths.databasePath, stagedDatabase)
    const databaseInfo = await requireFile(stagedDatabase, "Staged SQLite database")
    const stagedSqlite = await sqliteMetadata(stagedDatabase)
    const stagedDatabaseHash = await sha256File(stagedDatabase)
    if (await sha256File(dataPaths.databasePath) !== stagedDatabaseHash) {
      fail("SQLite database changed while its backup copy was verified.")
    }
    if (JSON.stringify(stagedSqlite) !== JSON.stringify(sourceSqlite)) {
      fail("SQLite database changed while the backup was created.")
    }

    const attachments = []
    for (const source of sourceAttachmentsBefore) {
      const bundleRelative = `${ATTACHMENTS_PREFIX}${source.relative}`
      const destination = path.join(stagePath, ...bundleRelative.split("/"))
      await copyPrivateFile(source.absolute, destination)
      const copied = await requireFile(destination, "Staged attachment")
      const copiedHash = await sha256File(destination)
      if (await sha256File(source.absolute) !== copiedHash) {
        fail("An attachment changed while its backup copy was verified.")
      }
      attachments.push({ path: bundleRelative, size: copied.size, sha256: copiedHash })
    }

    const sourceDatabaseAfter = await lstat(dataPaths.databasePath)
    const sourceAttachmentsAfter = await walkFiles(dataPaths.attachmentsPath)
    await rejectSqliteSidecars(dataPaths.databasePath)
    if (
      !sameFileSnapshot(sourceDatabaseBefore, sourceDatabaseAfter) ||
      !sameDirectorySnapshot(sourceAttachmentsBefore, sourceAttachmentsAfter)
    ) {
      fail("PlanGlade data changed while the backup was created; stop the app and retry.")
    }

    const manifest = {
      format: BUNDLE_FORMAT,
      version: BUNDLE_VERSION,
      createdAt: new Date().toISOString(),
      database: {
        path: DATABASE_FILE,
        size: databaseInfo.size,
        sha256: stagedDatabaseHash,
        sqlite: stagedSqlite,
      },
      attachments,
    }
    await writeFile(
      path.join(stagePath, MANIFEST_FILE),
      `${JSON.stringify(manifest, null, 2)}\n`,
      { flag: "wx", mode: 0o600 },
    )
    await validateBundle(stagePath)
    if (await kind(bundlePath) !== "missing") fail("Backup destination became nonempty while writing.")
    await rename(stagePath, bundlePath)
    return manifest
  } catch (error) {
    await rm(stagePath, { recursive: true, force: true })
    throw error
  }
}

async function rejectRestoreArtifacts(...parents) {
  for (const parent of new Set(parents)) {
    await requireDirectory(parent, "Restore destination parent")
    const entries = await readdir(parent)
    if (entries.some((entry) => RESTORE_ARTIFACT_PREFIXES.some((prefix) => entry.startsWith(prefix)))) {
      fail("Restore destination contains an unresolved staging or rollback artifact.")
    }
  }
}

async function verifyStagedFile(filePath, record) {
  const info = await requireFile(filePath, "Staged restore file")
  if (info.size !== record.size || await sha256File(filePath) !== record.sha256) {
    fail("Staged restore checksum validation failed.")
  }
}

export async function restoreBackupBundle(input, options = {}) {
  if (options.confirmReplace !== true) {
    fail("Restore requires the explicit --confirm-replace flag.")
  }
  const cwd = options.cwd ?? process.cwd()
  const dataPaths = resolveDataPaths(options.env ?? process.env, cwd)
  const bundlePath = resolveBundlePath(input, cwd, dataPaths)
  const manifest = await validateBundle(bundlePath)
  await rejectSqliteSidecars(dataPaths.databasePath)

  const databaseKind = await kind(dataPaths.databasePath)
  if (!['missing', 'file'].includes(databaseKind)) fail("Restore database destination is ambiguous.")
  const attachmentsKind = await kind(dataPaths.attachmentsPath)
  if (!['missing', 'directory'].includes(attachmentsKind)) fail("Restore attachment destination is ambiguous.")
  const databaseParent = path.dirname(dataPaths.databasePath)
  const attachmentsParent = path.dirname(dataPaths.attachmentsPath)
  await rejectRestoreArtifacts(databaseParent, attachmentsParent)
  const destinationDatabaseBefore = databaseKind === "file" ? await lstat(dataPaths.databasePath) : null
  const destinationAttachmentsBefore = attachmentsKind === "directory"
    ? await walkFiles(dataPaths.attachmentsPath)
    : null

  const id = randomUUID()
  const databaseStage = path.join(databaseParent, `.planglade-restore-${id}.db`)
  const attachmentsStage = path.join(attachmentsParent, `.planglade-restore-${id}-attachments`)
  const databaseRollback = path.join(databaseParent, `.planglade-rollback-${id}.db`)
  const attachmentsRollback = path.join(attachmentsParent, `.planglade-rollback-${id}-attachments`)
  let databaseMoved = false
  let attachmentsMoved = false
  let databaseInstalled = false
  let attachmentsInstalled = false

  try {
    await copyPrivateFile(path.join(bundlePath, DATABASE_FILE), databaseStage)
    await mkdir(attachmentsStage, { mode: 0o700 })
    for (const entry of manifest.attachments) {
      const relative = entry.path.slice(ATTACHMENTS_PREFIX.length)
      const source = path.join(bundlePath, ...entry.path.split("/"))
      const destination = path.join(attachmentsStage, ...relative.split("/"))
      await copyPrivateFile(source, destination)
      await verifyStagedFile(destination, entry)
    }
    await verifyStagedFile(databaseStage, manifest.database)
    const stagedSqlite = await sqliteMetadata(databaseStage)
    if (JSON.stringify(stagedSqlite) !== JSON.stringify(manifest.database.sqlite)) {
      fail("Staged SQLite format does not match the backup manifest.")
    }
    await rejectSqliteSidecars(dataPaths.databasePath)
    if (
      destinationDatabaseBefore &&
      !sameFileSnapshot(destinationDatabaseBefore, await lstat(dataPaths.databasePath))
    ) {
      fail("Restore database destination changed while replacements were staged.")
    }
    if (
      destinationAttachmentsBefore &&
      !sameDirectorySnapshot(destinationAttachmentsBefore, await walkFiles(dataPaths.attachmentsPath))
    ) {
      fail("Restore attachment destination changed while replacements were staged.")
    }

    try {
      if (databaseKind === "file") {
        await rename(dataPaths.databasePath, databaseRollback)
        databaseMoved = true
      }
      if (attachmentsKind === "directory") {
        await rename(dataPaths.attachmentsPath, attachmentsRollback)
        attachmentsMoved = true
      }
      await rename(databaseStage, dataPaths.databasePath)
      databaseInstalled = true
      await rename(attachmentsStage, dataPaths.attachmentsPath)
      attachmentsInstalled = true
    } catch {
      try {
        if (attachmentsInstalled) await rm(dataPaths.attachmentsPath, { recursive: true, force: true })
        if (attachmentsMoved) await rename(attachmentsRollback, dataPaths.attachmentsPath)
        if (databaseInstalled) await rm(dataPaths.databasePath, { force: true })
        if (databaseMoved) await rename(databaseRollback, dataPaths.databasePath)
      } catch {
        fail("Restore failed and automatic rollback could not complete; inspect rollback artifacts before retrying.")
      }
      fail("Restore failed; original database and attachments were restored.")
    }

    await rm(databaseRollback, { force: true })
    await rm(attachmentsRollback, { recursive: true, force: true })
    return manifest
  } finally {
    await rm(databaseStage, { force: true })
    await rm(attachmentsStage, { recursive: true, force: true })
  }
}

async function main(args) {
  const [operation, bundlePath, ...flags] = args
  if (operation === "backup" && bundlePath && flags.length === 0) {
    await createBackupBundle(bundlePath)
    process.stdout.write("PlanGlade backup bundle created.\n")
    return
  }
  if (operation === "restore" && bundlePath && flags.length === 1 && flags[0] === "--confirm-replace") {
    await restoreBackupBundle(bundlePath, { confirmReplace: true })
    process.stdout.write("PlanGlade database and attachments restored.\n")
    return
  }
  fail([
    "Usage:",
    "  npm run backup:create -- <new-bundle-directory>",
    "  npm run backup:restore -- <bundle-directory> --confirm-replace",
  ].join("\n"))
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : ""
if (import.meta.url === invokedPath) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Backup operation failed."}\n`)
    process.exitCode = 1
  })
}
