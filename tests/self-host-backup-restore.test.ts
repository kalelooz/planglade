import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { execFile } from "node:child_process"
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import test from "node:test"
import { promisify } from "node:util"

const runFile = promisify(execFile)

function databaseUrl(databasePath: string) {
  return `file:${databasePath.replaceAll("\\", "/")}`
}

async function sha256(filePath: string) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex")
}

function createDatabase(databasePath: string, value: string) {
  const database = new DatabaseSync(databasePath)
  try {
    database.exec("CREATE TABLE Example (value TEXT NOT NULL)")
    database.prepare("INSERT INTO Example (value) VALUES (?)").run(value)
    database.exec("PRAGMA user_version = 7")
  } finally {
    database.close()
  }
}

function readDatabaseValue(databasePath: string) {
  const database = new DatabaseSync(databasePath, { readOnly: true })
  try {
    return (database.prepare("SELECT value FROM Example").get() as { value: string }).value
  } finally {
    database.close()
  }
}

function selfHostEnv(databasePath: string, attachmentsPath: string) {
  return {
    ...process.env,
    DATABASE_URL: databaseUrl(databasePath),
    PLANGLADE_STORAGE_PROVIDER: "local",
    PLANGLADE_LOCAL_STORAGE_DIR: attachmentsPath,
    NODE_NO_WARNINGS: "1",
  }
}

async function runCli(
  script: "backup:create" | "backup:restore",
  args: string[],
  env: NodeJS.ProcessEnv,
) {
  const operation = script === "backup:create" ? "backup" : "restore"
  return runFile(process.execPath, ["scripts/self-host-data.mjs", operation, ...args], {
    cwd: process.cwd(),
    env,
    windowsHide: true,
  })
}

async function expectFailure(promise: Promise<unknown>, pattern: RegExp) {
  await assert.rejects(promise, (error: unknown) => {
    const output = error && typeof error === "object" && "stderr" in error
      ? String((error as { stderr?: unknown }).stderr)
      : String(error)
    assert.match(output, pattern)
    return true
  })
}

async function cloneBundle(source: string, parent: string, name: string) {
  const destination = path.join(parent, name)
  await cp(source, destination, { recursive: true, errorOnExist: true, force: false })
  return destination
}

test("SELF-HOST-UPGRADE-RESTORE-001: CLI creates and restores one checked bundle", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "planglade-backup-roundtrip-"))
  const sourceDatabase = path.join(root, "source.db")
  const sourceAttachments = path.join(root, "source-attachments")
  const bundle = path.join(root, "bundle-v1")
  const targetDatabase = path.join(root, "target.db")
  const targetAttachments = path.join(root, "target-attachments")

  try {
    createDatabase(sourceDatabase, "source-value")
    await mkdir(path.join(sourceAttachments, "workspace-1"), { recursive: true })
    await writeFile(path.join(sourceAttachments, "workspace-1", "attachment.bin"), Buffer.from([0, 1, 2, 255]))
    await writeFile(
      path.join(sourceAttachments, "workspace-1", "attachment.bin.meta.json"),
      JSON.stringify({ mimeType: "application/octet-stream", sizeBytes: 4 }),
    )

    const created = await runCli("backup:create", [bundle], selfHostEnv(sourceDatabase, sourceAttachments))
    assert.match(created.stdout, /backup bundle created/i)
    const manifest = JSON.parse(await readFile(path.join(bundle, "manifest.json"), "utf8"))
    assert.equal(manifest.format, "planglade-self-host-backup")
    assert.equal(manifest.version, 1)
    assert.equal(manifest.database.sha256, await sha256(path.join(bundle, "database.sqlite")))
    assert.equal(manifest.attachments.length, 2)

    await expectFailure(
      runCli("backup:create", [bundle], selfHostEnv(sourceDatabase, sourceAttachments)),
      /destination already exists/i,
    )

    createDatabase(targetDatabase, "target-value")
    await mkdir(targetAttachments)
    await writeFile(path.join(targetAttachments, "keep.txt"), "keep")
    await expectFailure(
      runCli("backup:restore", [bundle], selfHostEnv(targetDatabase, targetAttachments)),
      /confirm-replace/i,
    )
    assert.equal(readDatabaseValue(targetDatabase), "target-value")
    assert.equal(await readFile(path.join(targetAttachments, "keep.txt"), "utf8"), "keep")

    const restored = await runCli(
      "backup:restore",
      [bundle, "--confirm-replace"],
      selfHostEnv(targetDatabase, targetAttachments),
    )
    assert.match(restored.stdout, /database and attachments restored/i)
    assert.equal(readDatabaseValue(targetDatabase), "source-value")
    assert.deepEqual(
      await readFile(path.join(targetAttachments, "workspace-1", "attachment.bin")),
      Buffer.from([0, 1, 2, 255]),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("SELF-HOST-UPGRADE-RESTORE-001: corruption, incompatible versions, and traversal never mutate destinations", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "planglade-backup-reject-"))
  const sourceDatabase = path.join(root, "source.db")
  const sourceAttachments = path.join(root, "source-attachments")
  const originalBundle = path.join(root, "bundle-v1")
  const targetDatabase = path.join(root, "target.db")
  const targetAttachments = path.join(root, "target-attachments")

  try {
    createDatabase(sourceDatabase, "source-value")
    await mkdir(sourceAttachments)
    await writeFile(path.join(sourceAttachments, "attachment.txt"), "source attachment")
    await runCli("backup:create", [originalBundle], selfHostEnv(sourceDatabase, sourceAttachments))

    createDatabase(targetDatabase, "original-target")
    await mkdir(targetAttachments)
    await writeFile(path.join(targetAttachments, "keep.txt"), "original-attachment")
    const targetDatabaseHash = await sha256(targetDatabase)

    const corrupted = await cloneBundle(originalBundle, root, "corrupted")
    await writeFile(path.join(corrupted, "database.sqlite"), "corrupt", { flag: "a" })
    await expectFailure(
      runCli(
        "backup:restore",
        [corrupted, "--confirm-replace"],
        selfHostEnv(targetDatabase, targetAttachments),
      ),
      /checksum/i,
    )

    const incompatible = await cloneBundle(originalBundle, root, "incompatible")
    const incompatibleManifestPath = path.join(incompatible, "manifest.json")
    const incompatibleManifest = JSON.parse(await readFile(incompatibleManifestPath, "utf8"))
    incompatibleManifest.version = 2
    await writeFile(incompatibleManifestPath, JSON.stringify(incompatibleManifest))
    await expectFailure(
      runCli(
        "backup:restore",
        [incompatible, "--confirm-replace"],
        selfHostEnv(targetDatabase, targetAttachments),
      ),
      /version is incompatible/i,
    )

    const traversal = await cloneBundle(originalBundle, root, "traversal")
    const traversalManifestPath = path.join(traversal, "manifest.json")
    const traversalManifest = JSON.parse(await readFile(traversalManifestPath, "utf8"))
    traversalManifest.attachments[0].path = "attachments/../../outside.txt"
    await writeFile(traversalManifestPath, JSON.stringify(traversalManifest))
    await expectFailure(
      runCli(
        "backup:restore",
        [traversal, "--confirm-replace"],
        selfHostEnv(targetDatabase, targetAttachments),
      ),
      /unsafe path/i,
    )

    const sqliteVersion = await cloneBundle(originalBundle, root, "sqlite-version")
    const sqliteVersionDatabasePath = path.join(sqliteVersion, "database.sqlite")
    const sqliteVersionBytes = await readFile(sqliteVersionDatabasePath)
    sqliteVersionBytes[18] = 3
    await writeFile(sqliteVersionDatabasePath, sqliteVersionBytes)
    const sqliteVersionManifestPath = path.join(sqliteVersion, "manifest.json")
    const sqliteVersionManifest = JSON.parse(await readFile(sqliteVersionManifestPath, "utf8"))
    sqliteVersionManifest.database.sha256 = await sha256(sqliteVersionDatabasePath)
    await writeFile(sqliteVersionManifestPath, JSON.stringify(sqliteVersionManifest))
    await expectFailure(
      runCli(
        "backup:restore",
        [sqliteVersion, "--confirm-replace"],
        selfHostEnv(targetDatabase, targetAttachments),
      ),
      /file format version is unsupported/i,
    )

    assert.equal(await sha256(targetDatabase), targetDatabaseHash)
    assert.equal(readDatabaseValue(targetDatabase), "original-target")
    assert.equal(await readFile(path.join(targetAttachments, "keep.txt"), "utf8"), "original-attachment")
    await assert.rejects(readFile(path.join(root, "outside.txt")), /ENOENT/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("SELF-HOST-UPGRADE-RESTORE-001: standard Compose runner contains every operator command", async () => {
  const [dockerfile, compose, packageJson] = await Promise.all([
    readFile("Dockerfile", "utf8"),
    readFile("docker-compose.yml", "utf8"),
    readFile("package.json", "utf8"),
  ])
  const packageData = JSON.parse(packageJson)

  assert.equal(packageData.engines.node, ">=22.5.0")
  assert.equal(packageData.scripts["backup:create"], "node scripts/self-host-data.mjs backup")
  assert.equal(packageData.scripts["backup:restore"], "node scripts/self-host-data.mjs restore")
  assert.equal(packageData.scripts["auth:create-recovery-link"], "node scripts/create-local-recovery-link.mjs")
  assert.match(dockerfile, /COPY --from=builder[^\n]+\/app\/package\.json \.\/package\.json/)
  assert.match(dockerfile, /scripts\/self-host-data\.mjs/)
  assert.match(dockerfile, /scripts\/create-local-recovery-link\.mjs/)
  assert.match(compose, /planglade_data:\/app\/db/)
  assert.match(compose, /planglade_attachments:\/app\/storage\/local-attachments/)
})
