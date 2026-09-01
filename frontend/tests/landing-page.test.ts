import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const source = (file: string) => readFile(new URL(`../${file}`, import.meta.url), 'utf8')
const landingFiles = [
  'src/pages/Landing.tsx',
  'src/components/landing/content.ts',
  'src/components/landing/edition.ts',
  'src/components/landing/LandingHeader.tsx',
  'src/components/landing/FilmDialog.tsx',
  'src/components/landing/ProductStory.tsx',
  'src/components/landing/WorkspacePreviews.tsx',
  'src/components/landing/LandingFAQ.tsx',
  'src/components/landing/LandingFooter.tsx',
]

async function landingSource() {
  return (await Promise.all(landingFiles.map(source))).join('\n')
}

describe('marketing landing page', () => {
  it('keeps the approved hero copy and provider-neutral destination exact', async () => {
    const landing = await landingSource()

    expect(landing).toContain('A WORKSPACE FOR CLARITY')
    expect(landing).toContain('Your work, without the work of managing it.')
    expect(landing).toContain('Capture loose thoughts, turn them into clear tasks, and see the same work as a list, board, timeline, calendar, or connection map—without duplicating anything.')
    expect(landing).toContain("primaryCtaLabel: 'Open PlanGlade'")
    expect(landing).toContain('Watch the 30-second tour')
    expect(landing).toContain('A personal workspace. Start with the work already in front of you.')
    expect(landing).toContain("primaryHref: '/auth/login?next=/app'")
  })

  it('reproduces the real workspace hierarchy inside every product preview', async () => {
    const previews = await source('src/components/landing/WorkspacePreviews.tsx')
    const landing = await source('src/pages/Landing.tsx')
    const productStory = await source('src/components/landing/ProductStory.tsx')

    expect(landing).toContain('<HomeWorkspacePreview />')
    expect(productStory).toContain('<InboxWorkspacePreview />')
    expect(productStory).toContain('<TasksWorkspacePreview />')
    expect(productStory).toContain('<HomeOverviewPreview />')
    for (const label of ['Quick capture', 'Search', 'Home', 'Inbox', 'Tasks', 'Projects', 'Notes', 'Calendar', 'Connections', 'Settings', 'Plans', 'Help &amp; support']) {
      expect(previews).toContain(label)
    }
    expect(previews).toContain('data-sidebar')
    expect(previews).toContain('What needs your attention')
    expect(previews).toContain('Coming up this week')
    expect(previews).toContain('2 items to organize')
    expect(previews).toContain('Plan, review, and present work from one place.')
    expect(previews).toContain('Show completed')
    expect(previews).not.toContain('browser chrome')
  })

  it('uses semantic landmarks, Radix primitives, and truthful workspace previews', async () => {
    const landing = await landingSource()
    const productStory = await source('src/components/landing/ProductStory.tsx')

    expect(landing).toContain('href="#main-content"')
    expect(landing).toContain('<main id="main-content">')
    expect(landing).toContain('<h1 id="landing-hero-title"')
    expect(landing).toContain('aria-labelledby="landing-hero-title"')
    expect(landing).toContain('aria-label="Primary navigation"')
    expect(landing).toContain('<Sheet>')
    expect(landing).toContain('<Dialog open={open}')
    expect(landing).toContain('PlanGlade Home workspace preview')
    expect(landing).toContain('PlanGlade Inbox preview')
    expect(landing).toContain('PlanGlade Tasks preview')
    expect(productStory).not.toContain('<button')
  })

  it('keeps the product film out of the document until the dialog opens', async () => {
    const film = await source('src/components/landing/FilmDialog.tsx')

    const edition = await source('src/components/landing/edition.ts')
    expect(film).toContain('open && productFilm && !mediaUnavailable')
    expect(film).toContain('<source src={productFilm.src}')
    expect(film).toContain('Text tour and transcript')
    expect(film).toContain('preload="metadata"')
    expect(edition).toContain('productFilm: null')
  })

  it('states current product boundaries without advertising unavailable capabilities', async () => {
    const landing = await landingSource()

    expect(landing).toContain('The current hosted release provides personal workspaces. Shared workspaces and invitations are not enabled yet.')
    expect(landing).toContain('No. The current product focuses on direct, predictable planning tools.')
    expect(landing).not.toMatch(/AI[- ]powered|AI assistant/i)
    expect(landing).not.toMatch(/\bpricing\b/i)
    expect(landing).not.toMatch(/\benterprise\b/i)
    expect(landing).not.toMatch(/\bencrypted\b/i)
    expect(landing).not.toMatch(/\bguarantee(?:d)?\b/i)
    expect(landing).not.toMatch(/firebaseapp\.com|VITE_FIREBASE|projectId/i)
  })

  it('includes all required FAQ topics and gates absent legal destinations through edition config', async () => {
    const content = await source('src/components/landing/content.ts')
    const edition = await source('src/components/landing/edition.ts')
    const footer = await source('src/components/landing/LandingFooter.tsx')

    for (const question of [
      'What is PlanGlade?',
      'How is it different from a normal task manager?',
      'What does Quick Capture do?',
      'Do I need to organize everything immediately?',
      'Can I self-host PlanGlade?',
      'Does PlanGlade currently support teams?',
      'Is PlanGlade an AI product?',
      'Where do I sign in?',
    ]) expect(content).toContain(question)
    expect(edition).toContain('legalLinks: []')
    expect(footer).toContain('landingEdition.legalLinks.length > 0')
    expect(footer).toContain('>{landingEdition.signInLabel}</a>')
  })

  it('keeps the exact final call to action and open-source route', async () => {
    const landing = await source('src/pages/Landing.tsx')

    expect(landing).toContain('Start with the work already in front of you.')
    expect(landing).toContain('Explore the open-source edition')
    expect(landing).toContain('https://github.com/kalelooz/planglade')
  })

  it('keeps deployment-specific URLs out of the public core and declares crawl boundaries', async () => {
    const [html, robots, sitemap, social, routeMetadata] = await Promise.all([
      source('index.html'),
      source('public/robots.txt'),
      source('public/sitemap.xml'),
      source('public/planglade-social-preview.svg'),
      source('src/components/RouteMetadata.tsx'),
    ])

    expect(html).not.toContain('planglade.com')
    expect(html).toContain('content="/planglade-social-preview.svg"')
    for (const path of ['/app', '/auth', '/invite', '/setup', '/onboarding']) expect(robots).toContain(`Disallow: ${path}`)
    expect(robots).not.toContain('Sitemap:')
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" />')
    expect(routeMetadata).toContain("isMarketingRoot ? 'index, follow' : 'noindex, nofollow'")
    expect(social).toContain('M14 9.536V7a4 4 0 0 1 4-4')
  })
})
