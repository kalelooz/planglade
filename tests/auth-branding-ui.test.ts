import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("LOGIN-POLISH-001: login is a split auth and onboarding surface", async () => {
  const loginSource = await readProjectFile("src/components/lovable/login-page.tsx")

  assert.match(loginSource, /PlanGlade/)
  assert.match(loginSource, /Welcome back/)
  assert.match(loginSource, /Capture work, organize projects, and keep notes close\./)
  assert.match(loginSource, /lg:grid-cols-/)
  assert.match(loginSource, /aria-labelledby="onboarding-title"/)
  assert.match(loginSource, /Capture first/)
  assert.match(loginSource, /Drop ideas into Inbox before they disappear\./)
  assert.match(loginSource, /One task, many views/)
  assert.match(loginSource, /Tasks can appear in list, board, and calendar without duplicate records\./)
  assert.match(loginSource, /Own your workspace/)
  assert.match(loginSource, /Open source, self-hostable, and built to stay honest\./)
})

test("LOGIN-POLISH-001: login keeps configured auth controls and avoids unsupported claims", async () => {
  const [loginSource, loginRoute] = await Promise.all([
    readProjectFile("src/components/lovable/login-page.tsx"),
    readProjectFile("src/app/login/page.tsx"),
  ])

  assert.match(loginSource, /Continue with Google/)
  assert.match(loginSource, /Continue to workspace/)
  assert.match(loginSource, /googleSignInAvailable \? \(/)
  assert.match(loginSource, /handleGoogleSignIn/)
  assert.match(loginSource, /signInWithGoogle/)
  assert.match(loginSource, /nextAuthSignIn\("credentials"/)
  assert.match(loginSource, /Email or password is incorrect\./)
  assert.match(loginSource, /Use a recovery code/)
  assert.match(loginSource, /safeInternalPath\(searchParams\.get\("next"\)\)/)
  assert.match(loginRoute, /getProviderCapabilities\(\)\.localCredentials/)
  assert.doesNotMatch(loginSource, /FlowBoard/)
  assert.doesNotMatch(loginSource, /A calm clearing for your projects\./)
  assert.doesNotMatch(loginSource, /send password-reset email/i)
  assert.doesNotMatch(loginSource, /coming soon/i)
  assert.doesNotMatch(loginSource, /production auth/i)
  assert.doesNotMatch(loginSource, /Terms/)
  assert.doesNotMatch(loginSource, /Privacy/)
  assert.doesNotMatch(loginSource, /pricing|\bAI\b|\bTimeline\b|\bTeam\b/i)
})

test("onboarding surface is PlanGlade-branded and solo-first", async () => {
  const onboardingSource = await readProjectFile("src/app/onboarding/page.tsx")

  assert.match(onboardingSource, /PlanGlade/)
  assert.match(onboardingSource, /A focused workspace for projects\./)
  assert.match(onboardingSource, /Set up your workspace/)
  assert.match(onboardingSource, /Create a calm place for your projects, tasks, notes, and planning\./)
  assert.match(
    onboardingSource,
    /export default function OnboardingPage\(\)[\s\S]*<Suspense[\s\S]*<OnboardingPageContent \/>[\s\S]*<\/Suspense>/
  )
  assert.match(onboardingSource, /function OnboardingPageContent\(\)[\s\S]*useSearchParams\(\)/)
  assert.doesNotMatch(onboardingSource, /one private workspace/)
  assert.doesNotMatch(onboardingSource, /FlowBoard/)
  assert.doesNotMatch(onboardingSource, /A calm clearing for your projects\./)
  assert.doesNotMatch(onboardingSource, /production auth/i)
  assert.doesNotMatch(onboardingSource, /team-heavy/i)
})
