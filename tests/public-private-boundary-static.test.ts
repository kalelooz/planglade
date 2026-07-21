import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")

function activeEnvironment() {
  return new Map(
    read(".env.example")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=")
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, "")]
      })
  )
}

function validate(overrides: Record<string, string | undefined>) {
  const env = { ...process.env, CI: "false", ...overrides }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete env[key]
  }
  return spawnSync(process.execPath, ["scripts/validate-auth-config.mjs"], {
    cwd: root,
    encoding: "utf8",
    env: env as NodeJS.ProcessEnv,
  })
}

test("PUBLIC-PRIVATE-BOUNDARY-015 keeps hosted operations out of the public tree", () => {
  assert.equal(existsSync(join(root, "apphosting.yaml")), false)
  assert.equal(existsSync(join(root, "docs/DEPLOYMENT_FIREBASE_APP_HOSTING.md")), false)

  const maintainedDocs = ["README.md", "docs/ACTIVE_PLAN.md", "docs/FULLSTACK_ROADMAP.md"]
    .map(read)
    .join("\n")

  for (const hostedArtifact of [
    "apphosting.yaml",
    "DEPLOYMENT_FIREBASE_APP_HOSTING.md",
    "projectmanagement-e613c",
    "hosted.app",
  ]) {
    assert.equal(maintainedDocs.includes(hostedArtifact), false, hostedArtifact)
  }
})

test("PUBLIC-PRIVATE-BOUNDARY-015 makes the public environment self-host first", () => {
  const env = activeEnvironment()

  assert.equal(env.get("DATABASE_URL"), "file:../db/custom.db")
  assert.equal(env.get("FLOWBOARD_AUTH_MODE"), "nextauth")
  assert.equal(env.get("NEXT_PUBLIC_FLOWBOARD_AUTH_MODE"), "nextauth")
  assert.equal(env.get("FLOWBOARD_STORAGE_PROVIDER"), "local")
  assert.equal(env.get("NEXTAUTH_URL"), "http://localhost:3000")
  assert.ok(env.get("NEXTAUTH_SECRET"))

  for (const key of env.keys()) {
    assert.equal(key.includes("FIREBASE"), false, `${key} must remain optional`)
  }
})

test("PUBLIC-PRIVATE-BOUNDARY-015 retains explicit Firebase compatibility adapters", () => {
  assert.equal(existsSync(join(root, "src/lib/firebase-admin.ts")), true)
  assert.equal(existsSync(join(root, "src/lib/firebase-client.ts")), true)
  const storage = read("src/lib/storage.ts")
  assert.match(storage, /VALID_STORAGE_PROVIDERS = \["firebase", "local"\]/)
  assert.match(storage, /function getDefaultStorageProvider\(\) \{\s+return "local"/)
  assert.doesNotMatch(storage, /local is not allowed in production/)
  assert.match(read("src/lib/auth-config.ts"), /VALID_AUTH_MODES = \["dev", "firebase", "nextauth"\]/)

  const packageJson = JSON.parse(read("package.json")) as { dependencies: Record<string, string> }
  assert.ok(packageJson.dependencies.firebase)
  assert.ok(packageJson.dependencies["firebase-admin"])
})

test("AUTH-PROVIDER-CONTAIN-017 selects Firebase only for explicit Firebase builds", () => {
  const nextConfig = read("next.config.ts")
  const defaultClient = read("src/lib/auth-provider-client.ts")
  const firebaseClient = read("src/lib/auth-provider-client.firebase.ts")

  assert.match(nextConfig, /FLOWBOARD_AUTH_MODE\?\.toLowerCase\(\) === "firebase"/)
  assert.match(nextConfig, /NEXT_PUBLIC_FLOWBOARD_AUTH_MODE\?\.toLowerCase\(\) === "firebase"/)
  assert.match(nextConfig, /resolveAlias/)
  assert.doesNotMatch(defaultClient, /from ["']firebase(?:\/|["'])/)
  assert.match(firebaseClient, /from "firebase\/auth"/)
  assert.match(firebaseClient, /from "@\/lib\/firebase-client"/)

  for (const browserEntry of [
    "src/components/flowboard/auth-context.tsx",
    "src/lib/server-session-client.ts",
  ]) {
    const source = read(browserEntry)
    assert.match(source, /from "@\/lib\/auth-provider-client"/)
    assert.doesNotMatch(source, /from ["'](?:firebase|@\/lib\/firebase-client)/)
  }
})

test("PUBLIC-PRIVATE-BOUNDARY-015 accepts self-host and explicit Firebase validation without a database", () => {
  const disposableDatabase = join(tmpdir(), `planglade-boundary-${process.pid}.db`)
  assert.equal(existsSync(disposableDatabase), false)

  const selfHost = validate({
    DATABASE_URL: `file:${disposableDatabase}`,
    FLOWBOARD_AUTH_MODE: "nextauth",
    FLOWBOARD_STORAGE_PROVIDER: undefined,
    NEXTAUTH_SECRET: "boundary-test-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_FLOWBOARD_AUTH_MODE: "nextauth",
    NODE_ENV: "production",
  })
  assert.equal(selfHost.status, 0, selfHost.stderr)

  const mismatchedSelfHost = validate({
    FLOWBOARD_AUTH_MODE: "nextauth",
    NEXTAUTH_SECRET: "boundary-test-secret",
    NEXTAUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_FLOWBOARD_AUTH_MODE: "firebase",
    NODE_ENV: "production",
  })
  assert.notEqual(mismatchedSelfHost.status, 0)
  assert.match(mismatchedSelfHost.stderr, /FLOWBOARD_AUTH_MODE and NEXT_PUBLIC_FLOWBOARD_AUTH_MODE must match/)

  const firebase = validate({
    FIREBASE_PROJECT_ID: "test-project",
    FIREBASE_STORAGE_BUCKET: "test-bucket",
    FLOWBOARD_AUTH_MODE: "firebase",
    FLOWBOARD_STORAGE_PROVIDER: "firebase",
    NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
    NEXT_PUBLIC_FIREBASE_APP_ID: "test-app-id",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
    NEXT_PUBLIC_FLOWBOARD_AUTH_MODE: "firebase",
    NODE_ENV: "production",
  })
  assert.equal(firebase.status, 0, firebase.stderr)
  assert.equal(existsSync(disposableDatabase), false)
})
