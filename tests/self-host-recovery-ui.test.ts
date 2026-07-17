import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("SELF-HOST-AUTH-RECOVERY-001: recovery UI keeps the grant out of request URLs", async () => {
  const recovery = await readFile("src/app/recover/page.tsx", "utf8")

  assert.match(recovery, /window\.location\.hash\.slice\(1\)/)
  assert.match(recovery, /window\.history\.replaceState/)
  assert.match(recovery, /fetch\("\/api\/auth\/recovery"/)
  assert.match(recovery, /JSON\.stringify\(\{ secret, password \}\)/)
  assert.doesNotMatch(recovery, /searchParams\.get\(["'`](?:token|secret|email|userId|workspaceId)/)
  assert.doesNotMatch(recovery, /type="email"/)
  assert.match(recovery, /does not send password-reset email/)
  assert.match(recovery, /npm run auth:create-recovery-link -- owner@example\.com/)
})

test("SELF-HOST-AUTH-RECOVERY-001: only OWNER settings expose enrollment and require code acknowledgement", async () => {
  const [settings, enrollment, codes] = await Promise.all([
    readFile("src/app/app/settings/page.tsx", "utf8"),
    readFile("src/components/lovable/local-credential-settings.tsx", "utf8"),
    readFile("src/components/lovable/recovery-codes-panel.tsx", "utf8"),
  ])

  assert.match(settings, /currentWorkspaceRole === "OWNER"[\s\S]*<LocalCredentialSettings/)
  assert.match(enrollment, /apiFetch\("\/api\/auth\/local-credential"/)
  assert.match(enrollment, /JSON\.stringify\(\{ password \}\)/)
  assert.match(enrollment, /await signOut\("\/login"\)/)
  assert.match(codes, /I saved these recovery codes/)
  assert.match(codes, /disabled=\{!saved\}/)
  assert.match(codes, /aria-label="Recovery codes"/)
})
