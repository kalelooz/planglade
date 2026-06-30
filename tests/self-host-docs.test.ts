import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

async function exists(filePath: string) {
  try {
    await access(path.join(root, filePath))
    return true
  } catch {
    return false
  }
}

test("SELFHOST-DOCS-001: self-host docs keep maturity claims honest", async () => {
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const readme = await readProjectFile("README.md")
  const combined = `${selfHosting}\n${readme}`

  assert.match(selfHosting, /early self-hosting status/i)
  assert.match(selfHosting, /not production-ready/i)
  assert.match(selfHosting, /local\/developer self-host path/i)
  assert.doesNotMatch(combined, /\b(is|are|fully|now|already)\s+production-ready\b/i)
  assert.doesNotMatch(combined, /\bproduction-ready\s+(deployment|self-hosting|setup|guide)\b/i)
  assert.doesNotMatch(combined, /one-click deploy|backups automated|automated backups are included|monitoring included/i)
  assert.doesNotMatch(combined, /hosted cloud (is )?(available|included|ready)/i)
})

test("SELFHOST-DOCS-001: required environment variables are documented", async () => {
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const envExample = await readProjectFile(".env.example")

  for (const key of [
    "DATABASE_URL",
    "PLANGLADE_AUTH_MODE",
    "NEXT_PUBLIC_PLANGLADE_AUTH_MODE",
    "PLANGLADE_STORAGE_PROVIDER",
    "PLANGLADE_LOCAL_STORAGE_DIR",
    "PLANGLADE_STORAGE_SIGNING_SECRET",
    "NEXTAUTH_URL",
    "NEXTAUTH_SECRET",
  ]) {
    assert.match(selfHosting, new RegExp(key))
    assert.match(envExample, new RegExp(key))
  }
})

test("SELFHOST-DOCS-001: Docker status matches committed files", async () => {
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const hasDockerfile = await exists("Dockerfile")
  const hasCompose = await exists("docker-compose.yml")

  if (!hasDockerfile || !hasCompose) {
    assert.match(selfHosting, /Docker is not finalized/i)
    assert.match(selfHosting, /no committed `Dockerfile` or `docker-compose\.yml`/i)
  }
})

test("SELFHOST-001: Docker baseline files are committed", async () => {
  assert.equal(await exists("Dockerfile"), true)
  assert.equal(await exists("docker-compose.yml"), true)
})

test("SELFHOST-001: Docker uses a minimal non-root standalone runtime", async () => {
  const dockerfile = await readProjectFile("Dockerfile")

  assert.match(dockerfile, /FROM base AS builder/)
  assert.match(dockerfile, /npm ci/)
  assert.match(dockerfile, /npm run build/)
  assert.match(dockerfile, /\.next\/standalone/)
  assert.match(dockerfile, /USER nextjs/)
  assert.match(dockerfile, /CMD \["node",\s*"server\.js"\]/)
})

test("SELFHOST-001: Compose persists SQLite and waits for migrations", async () => {
  const compose = await readProjectFile("docker-compose.yml")

  assert.match(compose, /migrate:/)
  assert.match(compose, /app:/)
  assert.match(compose, /service_completed_successfully/)
  assert.match(compose, /file:\/app\/db\/planglade\.db/)
  assert.match(compose, /planglade_data:\/app\/db/)
  assert.match(compose, /api\/health/)
  assert.doesNotMatch(compose, /postgres:/i)
})

test("SELFHOST-001: Docker docs cover safe setup and honest limits", async () => {
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const backup = await readProjectFile("docs/BACKUP_RESTORE.md")
  const readme = await readProjectFile("README.md")
  const combined = `${selfHosting}\n${backup}\n${readme}`

  for (const required of [
    /early Docker self-host baseline/i,
    /docker compose build/i,
    /docker compose up -d/i,
    /prisma migrate deploy/i,
    /NEXTAUTH_SECRET/,
    /HTTPS/i,
    /backup/i,
    /test.*restore/i,
  ]) {
    assert.match(combined, required)
  }

  assert.doesNotMatch(readme, /Docker is not supported by this repo today/i)
  assert.doesNotMatch(combined, /\b(is|are|fully|now|already)\s+production-ready\b/i)
})

test("SELFHOST-DOCS-001: backup docs exist and are linked honestly", async () => {
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const readme = await readProjectFile("README.md")
  const backup = await readProjectFile("docs/BACKUP_RESTORE.md")

  assert.match(selfHosting, /docs\/BACKUP_RESTORE\.md/)
  assert.match(readme, /docs\/BACKUP_RESTORE\.md/)
  assert.match(backup, /manual/i)
  assert.match(backup, /not.*complete production backup/i)
  assert.match(backup, /Automated scheduled backups/i)
})
