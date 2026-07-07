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

  assert.match(source, /title: "Notes"/)
  assert.match(source, /project context/)
  assert.match(source, /Open-source workspace for tasks, projects, notes, calendar/)
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

test("WEBSITE-LIVE-001: landing owns honest status and pricing copy", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")
  const statusSection = source.match(/<section[\s\S]*?id="status"[\s\S]*?<\/section>/)?.[0] ?? ""

  assert.match(statusSection, /Self-host now\. Cloud soon\. Try demo\./)
  for (const text of [
    "Available now",
    "Self-host",
    "Coming soon",
    "Cloud",
    "Demo mode",
    "Self-hosted",
    "Free",
    "Paid plan coming soon",
    "No checkout",
    "No paid signup",
    "No cloud account today",
  ]) {
    assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.match(statusSection, /motion-reduce:animate-none/)
})

test("WEBSITE-POST-LIVE-AUDIT-001: landing metadata has social image and canonical URL", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")
  const metadata = source.match(/export const metadata: Metadata = \{[\s\S]*?\n\};/)?.[0] ?? ""

  assert.match(metadata, /alternates:\s*\{[\s\S]*canonical:\s*"\/"/)
  assert.match(metadata, /openGraph:\s*\{[\s\S]*url:\s*"\/"/)
  assert.match(metadata, /images:\s*\[[\s\S]*url:\s*"\/brand\/og-image\.png"/)
  assert.match(metadata, /width:\s*1280/)
  assert.match(metadata, /height:\s*640/)
  assert.match(metadata, /alt:\s*"PlanGlade product preview"/)
  assert.match(metadata, /twitter:\s*\{[\s\S]*card:\s*"summary_large_image"/)
  assert.match(metadata, /twitter:\s*\{[\s\S]*images:\s*\["\/brand\/og-image\.png"\]/)
})

test("WEBSITE-POST-LIVE-AUDIT-001: landing copy stays solo-first and adds early audience context", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")
  const heroSection = source.match(/\{\/\* Hero[^]*?<\/section>/)?.[0] ?? ""

  assert.match(heroSection, /For solo builders, freelancers, students, writers, and maintainers\./)
  assert.doesNotMatch(source, /small teams/i)
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
  assert.doesNotMatch(source, /upgrade CTA|upgrade now|start trial|buy now/i)
  assert.doesNotMatch(source, /href=["'][^"']*checkout|checkout[\s\S]{0,80}(now|button|link)/i)
  assert.doesNotMatch(source, /Cloud[\s\S]{0,100}(available today|available now|get started|start trial|buy now)/i)
  assert.match(source, /Cloud soon/)
})

test("WEBSITE-LIVE-001: public CTAs point demo interest to honest status", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  assert.match(source, /View on GitHub/)
  assert.match(source, /Self-host PlanGlade/)
  assert.match(source, /Try demo/)
  assert.match(source, /A calm clearing for your projects\./)
  assert.match(source, /Free to self-host\. Paid cloud coming\./)
  assert.match(source, /const demoUrl = "\/demo"/)
  assert.doesNotMatch(source, /answer: "Soon\."/)
  assert.doesNotMatch(source, /Join the waitlist|mailto:hello@planglade\.com/)
  assert.doesNotMatch(source, /href="\/login"[\s\S]*?Open PlanGlade/)
  assert.doesNotMatch(source, /public demo|get started/i)
})

test("WEBSITE-LIVE-002: canonical home link and self-host copy stay launch-ready", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  const logo = source.match(/function Logo\(\)[\s\S]*?\n}\n/)?.[0] ?? ""
  const selfHostSection = source.match(/<div id="self-host"[\s\S]*?<\/div>\n\s*<\/div>/)?.[0] ?? ""

  assert.match(logo, /href="\/"/)
  assert.doesNotMatch(logo, /href="\/landing"/)
  assert.match(selfHostSection, /git clone https:\/\/github\.com\/kalelooz\/planglade/)
  assert.match(selfHostSection, /See README for Docker and local setup/)
  assert.match(selfHostSection, /early self-host baseline/)
  assert.match(selfHostSection, /technical setup/)
  assert.doesNotMatch(selfHostSection, /npm run dev/)
})

test("WEBSITE-LIVE-002: sitemap uses the canonical public home URL", async () => {
  const source = await readProjectFile("src/app/sitemap.ts")

  assert.match(source, /new URL\("\/", process\.env\.NEXT_PUBLIC_APP_URL \?\? "https:\/\/planglade\.com"\)/)
})

test("LANDING-REWRITE-1: does not market deferred features as available today", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  const statusItems = source.match(/const statusItems = \[[\s\S]*?\]/)?.[0] ?? ""
  assert.doesNotMatch(statusItems, /Timeline/i)
  assert.doesNotMatch(source, /Calendar and Timeline/i)
  assert.doesNotMatch(source, /Timeline.*backed by durable server-side storage/i)

  // No Team / Activity / Connections / Reports / Work Map as current features
  assert.doesNotMatch(source, /Team management|Activity feed|Work Map|Connections graph/i)
  assert.doesNotMatch(source, /Reports dashboard/i)
})

test("WEBSITE-LIVE-001: keeps launch badges and honest status separation", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  // Trust badges present
  assert.match(source, /Self-host now/)
  assert.match(source, /Cloud soon/)
  assert.match(source, /Try demo/)

  const statusItems = source.match(/const statusItems = \[[\s\S]*?\]/)?.[0] ?? ""
  assert.match(statusItems, /Available now[\s\S]*Self-host/)
  assert.match(statusItems, /Coming soon[\s\S]*Cloud/)
  assert.match(statusItems, /Available now[\s\S]*Demo mode/)
})

test("LANDING-REWRITE-1: header nav anchors match the honest MVP set", async () => {
  const source = await readProjectFile("src/app/landing/page.tsx")

  const navMatch = source.match(/const navLinks = \[[\s\S]*?\]/)?.[0] ?? ""
  assert.match(navMatch, /Features/)
  assert.match(navMatch, /Status/)
  assert.match(navMatch, /Self-host/)
  assert.match(navMatch, /FAQ/)
  // Pricing / Cost / Team / Activity must not be nav anchors
  assert.doesNotMatch(navMatch, /Pricing|Cost|Roadmap|Team|Activity|Connections|Reports/)
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
    "Demo workspace",
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

test("LANDING-SHOWCASE-REPLICA-5: generic mock data fills the Home replica", async () => {
  const { showcase } = await readLandingSources()

  for (const text of [
    "Static mock - not real data",
    "Small bakery launch",
    "Student thesis plan",
    "Home renovation",
    "Freelance client website",
    "Order packaging samples",
    "Review thesis outline",
    "Confirm weekend paint plan",
    "Book community hall walkthrough",
    "Send client homepage notes",
    "Compare cabinet measurements",
    "Draft event volunteer list",
    "Update release checklist",
    "Bakery launch checklist",
    "Thesis source notes",
    "Renovation measurements",
    "Client website feedback",
  ]) {
    assert.match(showcase, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }

  assert.doesNotMatch(showcase, /Alex|PlanGlade Public Launch|Self-hosting Docs|Landing Page Polish|Security baseline reminders/)
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
  for (const anchor of ["#features", "#status", "#open-source", "#self-host", "#faq"]) {
    assert.match(page, new RegExp(`href="${anchor}"|id="${anchor.slice(1)}"`))
  }
})

// LANDING-GET-STARTED-6 guards: the accepted Home replica stays, distracting
// square ornaments are removed, and the public Get Started page explains the
// first-run path before sign-in.
test("WEBSITE-LIVE-001: landing CTAs target GitHub, self-host, and demo route", async () => {
  const { page } = await readLandingSources()

  assert.match(page, /const githubUrl = "https:\/\/github\.com\/kalelooz\/planglade"/)
  assert.match(page, /const selfHostUrl = `\$\{githubUrl\}#self-hosting-status`/)
  assert.match(page, /const demoUrl = "\/demo"/)
  assert.doesNotMatch(page, /const waitlistUrl =|mailto:hello@planglade\.com/)
  assert.doesNotMatch(page, /<PrimaryButton href="#start"[\s\S]*?Get started/)
  assert.doesNotMatch(page, /href="\/getting-started"/)
  assert.match(page, /<LandingProductShowcase/)
})

test("WEBSITE-POST-LIVE-AUDIT-001: landing footer exposes trust and self-host links", async () => {
  const { page } = await readLandingSources()
  const footer = page.match(/<footer[\s\S]*?<\/footer>/)?.[0] ?? ""

  for (const text of ["GitHub", "License", "Security", "Self-host docs"]) {
    assert.match(footer, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
  }
  assert.match(footer, /href=\{githubUrl\}/)
  assert.match(footer, /href="\/terms"/)
  assert.match(footer, /href="\/security"/)
  assert.match(footer, /href=\{selfHostUrl\}/)
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

test("WEBSITE-LIVE-001: getting-started redirects to the landing status section", async () => {
  const source = await readGettingStartedSource()

  assert.match(source, /redirect\("\/#status"\)/)
  assert.doesNotMatch(source, /Free\. Enjoy\.|Choose how to start\.|Open PlanGlade/)
})
