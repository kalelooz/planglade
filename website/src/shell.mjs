const githubUrl = 'https://github.com/kalelooz/planglade'

export const links = {
  github: githubUrl,
  demo: '/demo/',
  issues: `${githubUrl}/issues`,
  newIssue: `${githubUrl}/issues/new/choose`,
  releases: `${githubUrl}/releases`,
  securityReport: `${githubUrl}/security/advisories/new`,
  selfHost: `${githubUrl}/blob/main/backend/docs/SELF_HOSTING.md`,
  userGuide: `${githubUrl}/blob/main/docs/USER_GUIDE.md`,
  contributing: `${githubUrl}/blob/main/CONTRIBUTING.md`,
  license: `${githubUrl}/blob/main/LICENSE`,
}

const primaryNav = [
  { label: 'Product', href: '/product/' },
  { label: 'Self-host', href: '/self-host/' },
  { label: 'Docs', href: '/docs/' },
  { label: 'About', href: '/about/' },
]

function icon(name, className = 'icon') {
  const paths = {
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    external: '<path d="M15 4h5v5M20 4l-9 9"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/>',
    github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3.3-.4 6.8-1.6 6.8-7.4A5.8 5.8 0 0 0 19.3 3 5.4 5.4 0 0 0 19.1 0S17.9-.4 15 1.5a13.4 13.4 0 0 0-6 0C6.1-.4 4.9 0 4.9 0a5.4 5.4 0 0 0-.2 3A5.8 5.8 0 0 0 3.2 7.1c0 5.8 3.5 7 6.8 7.4A4.8 4.8 0 0 0 9 18v4"/><path d="M9 18c-4.5 2-5-2-7-2"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    sun: '<circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20.5 14.3A8 8 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z"/>',
  }
  return `<svg class="${className}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${paths[name]}</svg>`
}

export function arrowIcon() {
  return icon('arrow')
}

export function externalIcon() {
  return icon('external')
}

export function button(href, label, { secondary = false, external = false } = {}) {
  const attrs = external ? ' target="_blank" rel="noreferrer"' : ''
  const suffix = external ? externalIcon() : arrowIcon()
  return `<a class="button${secondary ? ' button-secondary' : ''}" href="${href}"${attrs}><span>${label}</span>${suffix}</a>`
}

function navLink(item, currentPath, mobile = false) {
  const active = currentPath.startsWith(item.href)
  return `<a class="nav-link${active ? ' is-active' : ''}${mobile ? ' mobile-nav-link' : ''}" href="${item.href}"${active ? ' aria-current="page"' : ''}>${item.label}</a>`
}

function header(currentPath) {
  return `
    <header class="site-header">
      <div class="header-inner">
        <a class="wordmark" href="/" aria-label="PlanGlade home">
          <img src="/assets/logo.svg" width="32" height="32" alt="">
          <span>PlanGlade</span>
        </a>
        <nav class="desktop-nav" aria-label="Primary navigation">
          ${primaryNav.map((item) => navLink(item, currentPath)).join('')}
        </nav>
        <div class="header-actions">
          <button class="theme-toggle" type="button" data-theme-toggle aria-label="Use dark appearance" aria-pressed="false">
            <span class="theme-icon theme-icon-light">${icon('sun')}</span>
            <span class="theme-icon theme-icon-dark">${icon('moon')}</span>
            <span class="theme-toggle-label">Theme</span>
          </button>
          <a class="header-github" href="${links.github}" target="_blank" rel="noreferrer" aria-label="View PlanGlade on GitHub">${icon('github')}<span>GitHub</span></a>
          <a class="header-demo" href="${links.demo}">Open demo</a>
          <details class="mobile-menu">
            <summary aria-label="Open navigation menu">${icon('menu')}</summary>
            <nav aria-label="Mobile navigation">
              ${primaryNav.map((item) => navLink(item, currentPath, true)).join('')}
              <a class="nav-link mobile-nav-link" href="${links.github}" target="_blank" rel="noreferrer">GitHub ${externalIcon()}</a>
              <a class="mobile-demo" href="${links.demo}">Open demo ${arrowIcon()}</a>
            </nav>
          </details>
        </div>
      </div>
    </header>`
}

function footer() {
  return `
    <footer class="site-footer">
      <div class="footer-lead">
        <a class="wordmark" href="/" aria-label="PlanGlade home">
          <img src="/assets/logo.svg" width="32" height="32" alt="">
          <span>PlanGlade</span>
        </a>
        <p>A calm, open-source place for tasks and project context.</p>
      </div>
      <div class="footer-links">
        <nav aria-label="Product links">
          <p>Explore</p>
          <a href="/product/">Product</a>
          <a href="/self-host/">Self-host</a>
          <a href="/docs/">Docs</a>
          <a href="${links.demo}">Demo</a>
        </nav>
        <nav aria-label="Project links">
          <p>Project</p>
          <a href="${links.github}" target="_blank" rel="noreferrer">GitHub</a>
          <a href="${links.issues}" target="_blank" rel="noreferrer">Issues</a>
          <a href="${links.releases}" target="_blank" rel="noreferrer">Releases</a>
          <a href="/about/">About</a>
        </nav>
        <nav aria-label="Trust links">
          <p>Trust</p>
          <a href="/privacy/">Privacy</a>
          <a href="/terms/">Terms</a>
          <a href="/security/">Security</a>
          <a href="/contact/">Contact</a>
        </nav>
      </div>
      <div class="footer-floor">
        <p>Self-host now. Hosted cloud is not available yet.</p>
        <p>AGPL-3.0 licensed.</p>
      </div>
    </footer>`
}

export function renderPage({ path, title, description, content, robots = 'index, follow' }) {
  const canonical = `https://planglade.com${path}`
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="${description}">
    <meta name="robots" content="${robots}">
    <meta name="theme-color" content="#f3f0e8" media="(prefers-color-scheme: light)">
    <meta name="theme-color" content="#171a18" media="(prefers-color-scheme: dark)">
    <link rel="canonical" href="${canonical}">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="PlanGlade">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${description}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:image" content="https://planglade.com/assets/editorial-clearing-v1.jpg">
    <meta property="og:image:width" content="1536">
    <meta property="og:image:height" content="1024">
    <meta property="og:image:alt" content="Warm paper forms arranged around an open workspace">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${description}">
    <meta name="twitter:image" content="https://planglade.com/assets/editorial-clearing-v1.jpg">
    <link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
    <script src="/assets/theme.js"></script>
    <link rel="stylesheet" href="/assets/styles.css">
    <title>${title}</title>
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to main content</a>
    ${header(path)}
    <main id="main">${content}</main>
    ${footer()}
    <script src="/assets/site.js" defer></script>
  </body>
</html>`
}
