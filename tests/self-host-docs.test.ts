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
    "PLANGLADE_LOCAL_AUTH_ENABLED",
    "PLANGLADE_SETUP_TOKEN",
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

test("SELF-HOST-DOCS-001: standalone setup supports local credentials without OAuth", async () => {
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const readme = await readProjectFile("README.md")
  const envExample = await readProjectFile(".env.example")
  const activeEnv = envExample
    .split("\n")
    .filter((line) => line.trim() && !line.trimStart().startsWith("#"))
    .join("\n")

  assert.match(selfHosting, /do not need an OAuth application/i)
  assert.match(selfHosting, /supported no-OAuth path/i)
  assert.match(selfHosting, /\/setup/)
  assert.match(selfHosting, /exactly one initial OWNER and workspace/i)
  assert.match(selfHosting, /ten permanent recovery codes/i)
  assert.match(readme, /no OAuth or Firebase project required/i)
  assert.match(envExample, /PLANGLADE_LOCAL_AUTH_ENABLED="true"/)
  assert.match(envExample, /PLANGLADE_SETUP_TOKEN=/)
  assert.doesNotMatch(activeEnv, /^(GITHUB_ID|GITHUB_SECRET|GOOGLE_CLIENT_ID|GOOGLE_CLIENT_SECRET)=/m)
})

test("SELF-HOST-DOCS-001: recovery guidance keeps the one-time grant out of request URLs", async () => {
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const dockerfile = await readProjectFile("Dockerfile")
  const packageJson = JSON.parse(await readProjectFile("package.json")) as {
    scripts: Record<string, string>
  }

  assert.equal(
    packageJson.scripts["auth:create-recovery-link"],
    "node scripts/create-local-recovery-link.mjs"
  )
  assert.match(dockerfile, /scripts\/create-local-recovery-link\.mjs/)
  assert.match(selfHosting, /15-minute one-time link/i)
  assert.match(
    selfHosting,
    /docker compose run --rm --no-deps app npm run auth:create-recovery-link -- owner@example\.com/
  )
  assert.match(selfHosting, /secret appears only in the URL fragment \(`\/recover#/i)
  assert.doesNotMatch(selfHosting, /\/recover\?(token|code|secret|grant)=/i)
  assert.match(selfHosting, /do not redirect or paste the printed link into shared logs/i)
})

test("SELF-HOST-UPGRADE-RESTORE-001: documented Docker data commands exist in the standard runner", async () => {
  const backup = await readProjectFile("docs/BACKUP_RESTORE.md")
  const migrations = await readProjectFile("docs/PRODUCTION_MIGRATIONS.md")
  const dockerfile = await readProjectFile("Dockerfile")
  const compose = await readProjectFile("docker-compose.yml")
  const packageJson = JSON.parse(await readProjectFile("package.json")) as {
    scripts: Record<string, string>
  }

  assert.equal(packageJson.scripts["backup:create"], "node scripts/self-host-data.mjs backup")
  assert.equal(packageJson.scripts["backup:restore"], "node scripts/self-host-data.mjs restore")
  assert.match(dockerfile, /COPY .*\/app\/package\.json \.\/package\.json/)
  assert.match(dockerfile, /scripts\/self-host-data\.mjs/)
  assert.match(compose, /planglade_data:\/app\/db/)
  assert.match(compose, /planglade_attachments:\/app\/storage\/local-attachments/)

  for (const guide of [backup, migrations]) {
    assert.match(guide, /docker compose stop app/)
    assert.match(
      guide,
      /docker compose run --rm --no-deps --user root -v "\$PWD\/backups:\/backups" app npm run backup:create -- \/backups\/planglade-/
    )
  }

  assert.match(backup, /docker compose down/)
  assert.match(
    backup,
    /docker compose run --rm --no-deps --user root -v "\$PWD\/backups:\/backups:ro" app npm run backup:restore -- \/backups\/planglade-[^\n]* --confirm-replace/
  )
  assert.ok(
    backup.includes(
      'docker compose run --rm --no-deps --user root -v "${PWD}\\backups:/backups" app npm run backup:create -- /backups/planglade-'
    )
  )
  assert.ok(
    backup.includes(
      'docker compose run --rm --no-deps --user root -v "${PWD}\\backups:/backups:ro" app npm run backup:restore -- /backups/planglade-'
    )
  )
  assert.match(migrations, /--confirm-replace/)
})

test("SELF-HOST-UPGRADE-RESTORE-001: backup and restore guarantees are documented", async () => {
  const backup = await readProjectFile("docs/BACKUP_RESTORE.md")
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const readme = await readProjectFile("README.md")

  assert.match(backup, /versioned directory bundle/i)
  assert.match(backup, /manifest\.json/)
  assert.match(backup, /SHA-256/i)
  assert.match(backup, /path[- ]traversal/i)
  assert.match(backup, /rolls both destinations back/i)
  assert.match(backup, /--confirm-replace/)
  assert.match(selfHosting, /Node\.js 22\.5 or newer/)
  assert.match(readme, /Node 22\.5\+/)
  assert.doesNotMatch(`${selfHosting}\n${readme}`, /Node(?:\.js)? 20(?:\+|\b)/i)
})

test("SELF-HOST-AUTH-UPGRADE-RESTORE-001: auth restore and rollback guarantees are documented", async () => {
  const backup = await readProjectFile("docs/BACKUP_RESTORE.md")
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const migrations = await readProjectFile("docs/PRODUCTION_MIGRATIONS.md")
  const combined = `${backup}\n${selfHosting}\n${migrations}`

  for (const required of [
    /normalized identity/i,
    /authVersion/,
    /local password hashes/i,
    /recovery-code hashes/i,
    /workspace ownership/i,
    /membership roles/i,
    /NEXTAUTH_SECRET[\s\S]*invalidates[\s\S]*sessions/i,
    /disposable copies|isolated Docker volumes/i,
    /no supported in-place authentication-schema downgrade/i,
  ]) {
    assert.match(combined, required)
  }
  assert.match(backup, /\.env[\s\S]*does not contain|does not contain `\.env`/i)
  assert.match(backup, /Workspace JSON export\/import[\s\S]*not a full backup/i)
  assert.match(migrations, /npm run db:check:local-auth-emails/)
})

test("SELF-HOST-DOCS-001: health guidance describes the status-only contract", async () => {
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const backup = await readProjectFile("docs/BACKUP_RESTORE.md")
  const healthRoute = await readProjectFile("src/app/api/health/route.ts")

  for (const status of ["ok", "degraded", "error"]) {
    assert.match(selfHosting, new RegExp(`\\{\"status\":\"${status}\"\\}`))
    assert.match(healthRoute, new RegExp(`\"${status}\"`))
  }
  assert.match(selfHosting, /endpoint deliberately returns status only/i)
  assert.match(backup, /health endpoint is status-only/i)
})

test("SELF-HOST-DOCS-001: public README keeps the broad Connections view without Map", async () => {
  const readme = await readProjectFile("README.md")

  assert.match(readme, /Connections relationship view/)
  assert.doesNotMatch(readme, /\/map\b/i)
})

// ---------------------------------------------------------------------------
// FIREBASE-SAAS-BOUNDARY-001 guards.
// Firebase is SaaS-only and must not be documented as a public self-host option.
// ---------------------------------------------------------------------------

test("FIREBASE-SAAS-BOUNDARY-001: docker-compose defaults to local storage without Firebase setup", async () => {
  const compose = await readProjectFile("docker-compose.yml")

  assert.doesNotMatch(compose, /PLANGLADE_STORAGE_PROVIDER:\s*firebase\b/)
  assert.match(compose, /PLANGLADE_STORAGE_PROVIDER:\s*\$\{PLANGLADE_STORAGE_PROVIDER:-local\}/)
  assert.doesNotMatch(compose, /FIREBASE_/)
  assert.doesNotMatch(compose, /NEXT_PUBLIC_FIREBASE_/)
})

test("FIREBASE-SAAS-BOUNDARY-001: Dockerfile default build needs no Firebase values", async () => {
  const dockerfile = await readProjectFile("Dockerfile")

  assert.doesNotMatch(dockerfile, /NEXT_PUBLIC_FIREBASE_/)
  assert.doesNotMatch(dockerfile, /FIREBASE_/)
})

test("FIREBASE-SAAS-BOUNDARY-001: self-host docs do not include Firebase setup", async () => {
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const backup = await readProjectFile("docs/BACKUP_RESTORE.md")
  const combined = `${selfHosting}\n${backup}`

  const beforeYouStart = selfHosting.slice(
    selfHosting.indexOf("## Before You Start"),
    selfHosting.indexOf("## First Run")
  )
  // No "You need" bullet/line may contain Firebase.
  for (const line of beforeYouStart.split("\n")) {
    if (/^\s*-\s/.test(line) && /firebase/i.test(line)) {
      assert.fail(`Required-items bullet mentions Firebase: ${line.trim()}`)
    }
  }
  assert.match(beforeYouStart, /not[^.\n]*need[^.\n]*Firebase/i)

  const firstRun = selfHosting.slice(
    selfHosting.indexOf("## First Run With Docker Compose"),
    selfHosting.indexOf("## Data, Migrations, And Storage")
  )
  assert.match(firstRun, /No Firebase values are required/i)

  assert.doesNotMatch(combined, /Optional Firebase/i)
  assert.doesNotMatch(combined, /PLANGLADE_STORAGE_PROVIDER="firebase"/)
  assert.doesNotMatch(combined, /FIREBASE_[A-Z_]+/)
  assert.doesNotMatch(combined, /NEXT_PUBLIC_FIREBASE_[A-Z_]+/)
  assert.doesNotMatch(combined, /Firebase\/Google Cloud tools|Firebase security rules|Firebase bucket/i)
})

test("FIREBASE-SAAS-BOUNDARY-001: README does not advertise Firebase as public auth or storage", async () => {
  const readme = await readProjectFile("README.md")

  assert.doesNotMatch(readme, /Firebase mode|Firebase auth|Firebase Storage|Firebase App Hosting/i)
  assert.doesNotMatch(readme, /FIREBASE_[A-Z_]+/)
  assert.doesNotMatch(readme, /NEXT_PUBLIC_FIREBASE_[A-Z_]+/)
})

test("FIREBASE-SAAS-BOUNDARY-001: Docker default documents local attachment volume", async () => {
  const selfHosting = await readProjectFile("docs/SELF_HOSTING.md")
  const backup = await readProjectFile("docs/BACKUP_RESTORE.md")
  const compose = await readProjectFile("docker-compose.yml")

  assert.match(compose, /planglade_attachments:\/app\/storage\/local-attachments/)
  assert.match(selfHosting, /planglade_attachments/i)
  assert.match(backup, /planglade_planglade_attachments/i)
})

test("FIREBASE-SAAS-BOUNDARY-001: env example contains no Firebase self-host variables", async () => {
  const envExample = await readProjectFile(".env.example")

  assert.match(envExample, /without Firebase|NOT required for Docker|not.*required.*Docker/i)
  assert.doesNotMatch(envExample, /PLANGLADE_STORAGE_PROVIDER="firebase"/)
  assert.doesNotMatch(envExample, /PLANGLADE_AUTH_MODE="firebase"/)
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_PLANGLADE_AUTH_MODE="firebase"/)
  assert.doesNotMatch(envExample, /FIREBASE_[A-Z_]+/)
  assert.doesNotMatch(envExample, /NEXT_PUBLIC_FIREBASE_[A-Z_]+/)
})
