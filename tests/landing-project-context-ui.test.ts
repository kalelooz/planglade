import assert from "node:assert/strict"
import { readFile, stat } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

async function readLandingSources() {
  const [page, showcase] = await Promise.all([
    readProjectFile("src/app/landing/page.tsx"),
    readProjectFile("src/app/landing/product-showcase.tsx"),
  ])

  return { page, showcase, combined: `${page}\n${showcase}` }
}

async function readGettingStartedSource() {
  return readProjectFile("src/app/getting-started/page.tsx")
}

test("landing does not advertise Project Docs as a primary visible feature", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  assert.doesNotMatch(source, /Project Docs/)
  assert.doesNotMatch(source, /Project docs/)
  assert.doesNotMatch(source, /project docs/)
  assert.doesNotMatch(source, /notes\/docs/i)
  assert.doesNotMatch(source, /write docs/i)
  assert.doesNotMatch(source, /structured documentation/i)
})

test("landing does not link to hidden project Docs UI", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  assert.doesNotMatch(source, /section=docs/)
  assert.doesNotMatch(source, /section: "docs"/)
})

test("landing keeps project notes and context clear", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  assert.match(source, /Project notes and context live alongside your work/)
  assert.match(source, /project notes/)
  assert.match(source, /notes, and context stay portable/)
})

// LANDING-REWRITE-1 regression guards: the landing must match the app's
// restrained zinc/minimalist system, drop the forest/camping brand, and stay
// honest about MVP scope.
test("LANDING-REWRITE-1: no forest/camping brand or green palette", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  // Forbidden icons / branding
  assert.doesNotMatch(source, /TreePine/)
  assert.doesNotMatch(source, /Sprout/)

  // Forbidden marketing typeface
  assert.doesNotMatch(source, /Fraunces/)

  // Forbidden hardcoded forest green palette
  assert.doesNotMatch(source, /#17613f/)

  // Forbidden topographic / backdrop decorative language
  assert.doesNotMatch(source, /TopographicBackdrop|topographic/i)
  assert.doesNotMatch(source, /motion-cta-drift|motion-float-soft|hero-wash/)

  // Forbidden nature / camping / explorer copy (word-boundary scoped so common
  // substrings like "con-tent" or "ex-port" do not trigger false positives).
  assert.doesNotMatch(source, /calm clearing/i)
  assert.doesNotMatch(source, /clear the path/i)
  assert.doesNotMatch(source, /\bcampfire\b/i)
  assert.doesNotMatch(source, /\bcamping\b/i)
  assert.doesNotMatch(source, /\btent(s)?\b/i)
  assert.doesNotMatch(source, /\bmountain(s)?\b/i)
  assert.doesNotMatch(source, /\bexplorer\b/i)
  assert.doesNotMatch(source, /\btrail\b/i)
})

test("LANDING-REWRITE-1: no Pricing nav and no fake AI / metrics", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  // No Pricing nav anchor
  assert.doesNotMatch(source, /href: "#cost"/)
  assert.doesNotMatch(source, /\{ label: "Pricing"/)
  assert.doesNotMatch(source, /\{ label: "Cost"/)

  // No fake AI claim
  assert.doesNotMatch(source, /AI-powered|AI assistant|artificial intelligence/i)

  // No fake metrics / vanity numbers presented as real
  assert.doesNotMatch(source, /trusted by \d|active users|stars on github|join \d+ teams/i)
})

test("LANDING-MERGE-START-001: landing owns one honest free start card", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")
  const cardMatches = source.match(/Free\. Enjoy\./g) ?? []
  const startSection = source.match(/<section[\s\S]*?id="start"[\s\S]*?<\/section>/)?.[0] ?? ""

  assert.equal(cardMatches.length, 1)
  assert.match(startSection, /Choose how to start\./)
  assert.match(startSection, /PlanGlade is free and open source today\./)
  assert.match(startSection, /Free\. Enjoy\./)
  assert.match(startSection, /\$0/)
  assert.match(startSection, /href="\/login"[\s\S]*?Open PlanGlade/)
  assert.match(startSection, /href="#self-host"[\s\S]*?Learn about self-hosting/)
  for (const text of [
    "Inbox capture and triage",
    "Tasks list and board toggle",
    "Projects and Project Home",
    "Notes and project context",
    "Calendar over task due dates",
    "Export your workspace data",
    "No billing",
    "No upgrade wall",
    "No fake limits",
  ]) {
    assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.match(startSection, /motion-reduce:animate-none/)
  assert.match(startSection, /motion-reduce:transform-none/)
})

test("LANDING-FREE-CARD-001: no pricing page, nav, links, tiers, or badges", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")
  const navMatch = source.match(/const navLinks = \[[\s\S]*?\]/)?.[0] ?? ""

  await assert.rejects(() => stat(path.join(root, "src/app/pricing")))
  assert.doesNotMatch(source, /href=["']\/pricing["']|href:\s*["']\/pricing["']/)
  assert.doesNotMatch(navMatch, /Pricing|Cost|Billing/)
  assert.doesNotMatch(source, /pricing table|price table|plan table/i)
  assert.doesNotMatch(source, /\btier(s|ed)?\b/i)
  assert.doesNotMatch(source, /Recommended/)
})

test("LANDING-FREE-CARD-001: no fake paid or cloud plans are available", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  assert.doesNotMatch(source, /Pro plan|Team plan|Cloud plan|Starter plan|Enterprise plan/i)
  assert.doesNotMatch(source, /upgrade CTA|upgrade now|start trial|buy now|checkout/i)
  assert.doesNotMatch(source, /Hosted cloud[\s\S]{0,100}(available today|available now|get started|start trial|buy now)/i)
  assert.match(source, /hosted option is a possible later step/)
})

test("LOGIN-POLISH-001: Free card actions are centered and equal width", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")
  const startSection = source.match(/<section[\s\S]*?id="start"[\s\S]*?<\/section>/)?.[0] ?? ""

  assert.match(startSection, /mx-auto grid max-w-md gap-3 sm:grid-cols-2/)
  assert.match(startSection, /<PrimaryButton href="\/login" className="w-full sm:h-11">/)
  assert.match(startSection, /<SecondaryButton href="#self-host" className="w-full sm:h-11">/)
  assert.doesNotMatch(startSection, /sm:grid-cols-\[minmax\(0,1fr\)_auto\]/)
})

test("LANDING-REWRITE-1: does not market deferred features as available today", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  // No claim that Timeline is available today. Scope the check to the
  // roadmapAvailable array so that Timeline legitimately appearing under the
  // "Next" roadmap column does not trigger a false positive.
  const availableSection = source.match(/const roadmapAvailable = \[[\s\S]*?\]/)?.[0] ?? ""
  assert.doesNotMatch(availableSection, /Timeline/i)
  assert.doesNotMatch(source, /Calendar and Timeline/i)
  assert.doesNotMatch(source, /Timeline.*backed by durable server-side storage/i)

  // No Team / Activity / Connections / Reports / Work Map as current features
  assert.doesNotMatch(source, /Team management|Activity feed|Work Map|Connections graph/i)
  assert.doesNotMatch(source, /Reports dashboard/i)
})

test("LANDING-REWRITE-1: keeps trust badges and honest roadmap separation", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  // Trust badges present
  assert.match(source, /Open source/)
  assert.match(source, /Self-hostable/)
  assert.match(source, /Solo-first/)

  // Roadmap honesty: Timeline appears only under Next, not Available today.
  assert.match(source, /Available today/)
  assert.match(source, /roadmapNext/)
  const nextSection = source.match(/const roadmapNext = \[[\s\S]*?\]/)?.[0] ?? ""
  assert.match(nextSection, /Timeline planning view/)
  const availableSection = source.match(/const roadmapAvailable = \[[\s\S]*?\]/)?.[0] ?? ""
  assert.doesNotMatch(availableSection, /Timeline/i)

  // Hosted cloud is Later, not current
  const laterSection = source.match(/const roadmapLater = \[[\s\S]*?\]/)?.[0] ?? ""
  assert.match(laterSection, /Hosted cloud option/)
})

test("LANDING-REWRITE-1: header nav anchors match the honest MVP set", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  const navMatch = source.match(/const navLinks = \[[\s\S]*?\]/)?.[0] ?? ""
  assert.match(navMatch, /Features/)
  assert.match(navMatch, /Open source/)
  assert.match(navMatch, /Self-host/)
  assert.match(navMatch, /Roadmap/)
  assert.match(navMatch, /FAQ/)
  // Pricing / Cost / Team / Activity must not be nav anchors
  assert.doesNotMatch(navMatch, /Pricing|Cost|Team|Activity|Connections|Reports/)
})

// LANDING-SHOWCASE-REPLICA-5 guards: the product preview is one static Home
// replica. No horizontal showcase menu, no tabs, no client state.
test("LANDING-SHOWCASE-REPLICA-5: hero is copy-only and showcase is static", async () => {
  const { page, showcase } = await readLandingSources()

  assert.doesNotMatch(page, /function ProductPreviewMock\(\)/)
  assert.doesNotMatch(page, /<ProductPreviewMock/)
  const heroSection =
    page.match(/\{\/\* Hero[^]*?<\/section>/)?.[0] ?? ""
  assert.doesNotMatch(heroSection, /ProductPreviewMock|ProductShowcase/)
  assert.match(heroSection, /text-center/)
  assert.match(page, /<LandingProductShowcase/)
  assert.doesNotMatch(showcase, /"use client"/)
  assert.doesNotMatch(page, /"use client"/)
})

test("LANDING-SHOWCASE-REPLICA-5: no showcase tab menu or client interactivity remains", async () => {
  const { showcase } = await readLandingSources()

  assert.match(showcase, /id="product-showcase"/)
  assert.match(showcase, /max-w-\[1180px\]/)
  assert.doesNotMatch(showcase, /SHOWCASE_TABS|ShowcaseTabId|activeTab|setActiveTab|useState|useId|useMemo|useRef/)
  assert.doesNotMatch(showcase, /role="tablist"/)
  assert.doesNotMatch(showcase, /role="tab"/)
  assert.doesNotMatch(showcase, /role="tabpanel"/)
  assert.doesNotMatch(showcase, /aria-selected|aria-controls|aria-labelledby/)
  assert.doesNotMatch(showcase, /type="radio"/)
  assert.doesNotMatch(showcase, /onClick|onKeyDown|tabRefs|focusTab/)
})

test("LANDING-SHOWCASE-REPLICA-5: Home replica includes real app shell and Home sections", async () => {
  const { showcase } = await readLandingSources()

  for (const text of [
    "PlanGlade",
    "All projects",
    "Search or jump",
    "Quick capture",
    "Notifications",
    "Overview Dashboard",
    "Good morning, Alex",
    "Today's Focus",
    "Attention Required",
    "Recently Captured",
    "Project Focus",
    "Next Up",
    "Recent Context",
  ]) {
    assert.match(showcase, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("LANDING-SHOWCASE-REPLICA-5: sidebar shows the real MVP nav items only", async () => {
  const { showcase } = await readLandingSources()

  const navSlice =
    showcase.match(/const SHOWCASE_NAV = \[[\s\S]*?\]/)?.[0] ?? ""
  for (const item of ["Home", "Inbox", "Tasks", "Projects", "Notes", "Calendar", "Settings"]) {
    assert.match(navSlice, new RegExp(`"${item}"`))
  }
  assert.doesNotMatch(navSlice, /Team|Activity|Timeline|Connections|Reports|Work Map/)
})

test("LANDING-SHOWCASE-REPLICA-5: mock launch data fills the Home replica", async () => {
  const { showcase } = await readLandingSources()

  for (const text of [
    "Static mock - not real data",
    "PlanGlade Public Launch",
    "General",
    "Self-hosting Docs",
    "Landing Page Polish",
    "Capture clean app screenshots",
    "Review README setup flow",
    "Confirm no fake hosted-cloud claims",
    "Validate public repo hygiene files",
    "Write screenshot review notes",
    "Review self-host setup",
    "Draft launch notes",
    "Triage beta feedback",
    "Public launch checklist",
    "Self-hosting gaps",
    "Screenshot review notes",
    "Security baseline reminders",
  ]) {
    assert.match(showcase, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
})

test("LANDING-SHOWCASE-REPLICA-5: showcase does not surface deferred or forbidden features", async () => {
  const { showcase } = await readLandingSources()

  assert.doesNotMatch(showcase, /\bTeam\b|\bActivity\b|\bTimeline\b|\bConnections\b|\bReports\b|\bWork Map\b|\bPricing\b|\bAI\b/)
  assert.doesNotMatch(showcase, /TreePine|Sprout|Fraunces|#17613f|#fbfaf6/)
})

test("LANDING-SHOWCASE-REPLICA-5: geometric backdrop is neutral and lower sections remain intact", async () => {
  const { page, showcase, combined } = await readLandingSources()

  assert.match(page, /data-hero-geometric-backdrop="true"/)
  assert.match(page, /<GeometricBackdrop/)
  assert.match(showcase, /data-showcase-geometric-background="visible-neutral-layers"/)
  const backdropSlice =
    `${page.match(/function GeometricBackdrop\(\)[\s\S]*?(?=\nfunction )/)?.[0] ?? ""}\n${showcase.match(/function ShowcaseBackdrop\(\)[\s\S]*?(?=\nfunction )/)?.[0] ?? ""}`
  assert.match(backdropSlice, /aria-hidden="true"/)
  assert.match(backdropSlice, /pointer-events-none/)
  // Visible neutral layers: dot grid, diagonal line mesh, glow.
  assert.match(backdropSlice, /rgb\(228 228 231/)
  assert.match(backdropSlice, /rgb\(212 212 216\)/)
  assert.match(backdropSlice, /radial-gradient/)
  assert.match(backdropSlice, /mesh-a/)
  assert.doesNotMatch(combined, /#17613f|#fbfaf6|0\.120 155|moss|sage/i)
  assert.doesNotMatch(combined, /TopographicBackdrop|topographic|camping|forest/i)
  for (const anchor of ["#features", "#open-source", "#self-host", "#roadmap", "#faq"]) {
    assert.match(page, new RegExp(`href="${anchor}"|id="${anchor.slice(1)}"`))
  }
})

// LANDING-GET-STARTED-6 guards: the accepted Home replica stays, distracting
// square ornaments are removed, and the public Get Started page explains the
// first-run path before sign-in.
test("LANDING-MERGE-START-001: landing Get started CTAs target the start section", async () => {
  const { page } = await readLandingSources()

  const getStartedLinks = page.match(/<PrimaryButton href="#start"[\s\S]*?Get started/g) ?? []

  assert.equal(getStartedLinks.length, 4)
  assert.doesNotMatch(page, /href="\/getting-started"/)
  assert.match(page, /<LandingProductShowcase/)
})

test("LANDING-GET-STARTED-6: hero and showcase backgrounds have no floating square ornaments", async () => {
  const { page, showcase, combined } = await readLandingSources()
  const backdropSlice =
    `${page.match(/function GeometricBackdrop\(\)[\s\S]*?(?=\nfunction )/)?.[0] ?? ""}\n${showcase.match(/function ShowcaseBackdrop\(\)[\s\S]*?(?=\nfunction )/)?.[0] ?? ""}`

  assert.match(backdropSlice, /radial-gradient/)
  assert.match(backdropSlice, /mesh-a|d1-/)
  assert.doesNotMatch(backdropSlice, /pg-float-sq/)
  assert.doesNotMatch(backdropSlice, /floating|float|concentric|ornament/i)
  assert.doesNotMatch(backdropSlice, /<span[^>]+absolute[^>]+h-\d+[^>]+w-\d+/)
  assert.doesNotMatch(backdropSlice, /<rect[\s\S]*stroke=/)
  assert.doesNotMatch(combined, /TreePine|Sprout|Fraunces|#17613f|#fbfaf6/)
})

test("LANDING-MERGE-START-001: getting-started redirects to the landing start section", async () => {
  const source = await readGettingStartedSource()

  assert.match(source, /redirect\("\/#start"\)/)
  assert.doesNotMatch(source, /Free\. Enjoy\.|Choose how to start\.|Open PlanGlade/)
})
