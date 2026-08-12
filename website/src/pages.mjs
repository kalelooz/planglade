import { arrowIcon, button, externalIcon, links } from './shell.mjs'

function pageHero({ eyebrow, title, lede, actions = '' }) {
  return `
    <section class="page-hero">
      <div class="page-hero-inner">
        <p class="eyebrow">${eyebrow}</p>
        <h1>${title}</h1>
        <p class="page-lede">${lede}</p>
        ${actions ? `<div class="button-row">${actions}</div>` : ''}
      </div>
    </section>`
}

function textLink(href, label, external = false) {
  return `<a class="text-link" href="${href}"${external ? ' target="_blank" rel="noreferrer"' : ''}>${label}${external ? externalIcon() : arrowIcon()}</a>`
}

const home = `
  <section class="hero">
    <div class="hero-inner">
      <div class="hero-copy hero-enter hero-enter-1">
        <p class="eyebrow">Open-source personal project workspace</p>
        <h1>Make room for work that matters.</h1>
        <p class="hero-lede">Capture tasks, keep project context close, and see your week without turning planning into another job.</p>
        <div class="button-row">
          ${button(links.demo, 'Try the browser-local demo')}
          ${button(links.github, 'View the source', { secondary: true, external: true })}
        </div>
      </div>
      <figure class="hero-product hero-enter hero-enter-2">
        <div class="product-frame">
          <div class="frame-bar" aria-hidden="true"><span></span><span></span><span></span><b>Home</b></div>
          <img src="/assets/product/home.png" width="3083" height="1660" alt="PlanGlade Home showing focused tasks, inbox items, active projects, and recent notes" fetchpriority="high">
        </div>
        <figcaption><span>Real product capture</span><a href="${links.demo}">Open this view ${arrowIcon()}</a></figcaption>
      </figure>
    </div>
  </section>

  <section class="proof-strip" aria-label="PlanGlade availability">
    <div><strong>Open source</strong><span>AGPL-3.0</span></div>
    <div><strong>Self-host today</strong><span>Your infrastructure</span></div>
    <div><strong>Demo today</strong><span>Sample data in your browser</span></div>
    <div><strong>Cloud later</strong><span>No paid signup yet</span></div>
  </section>

  <section class="editorial-split section-shell">
    <div class="editorial-image-wrap">
      <img src="/assets/editorial-clearing-v1.jpg" width="1536" height="1024" alt="Warm paper forms arranged around a clear open space" loading="lazy">
      <p class="image-note">A system should leave room to think.</p>
    </div>
    <div class="editorial-copy">
      <p class="eyebrow">Why PlanGlade</p>
      <h2>Keep the work connected.</h2>
      <p>Tasks rarely stand alone. They belong to projects, rely on notes, land on dates, and block other work. PlanGlade keeps those relationships visible without making you maintain a complicated system.</p>
      <p>Start with a quick capture. Add structure when it becomes useful.</p>
      ${textLink('/about/', 'Read the product principles')}
    </div>
  </section>

  <section class="product-story section-shell">
    <div class="section-heading split-heading">
      <div>
        <p class="eyebrow">One set of work</p>
        <h2>Change the view, not the task.</h2>
      </div>
      <p>List, board, calendar, and connections all refer to the same underlying work. You do not have to copy it into separate systems.</p>
    </div>

    <article class="story-row story-row-wide">
      <div class="story-copy">
        <span class="story-index">01</span>
        <h3>See the work that needs a decision.</h3>
        <p>Filter and group tasks, move between views, and open the full context without leaving the page.</p>
        ${textLink('/product/#tasks', 'Explore task planning')}
      </div>
      <figure class="screenshot-card screenshot-card-wide">
        <img src="/assets/product/tasks.png" width="3068" height="1652" alt="PlanGlade Tasks with status, priority, due date, filters, and grouping controls" loading="lazy">
      </figure>
    </article>

    <div class="story-pair">
      <article class="story-row story-row-stacked">
        <figure class="screenshot-card">
          <img src="/assets/product/calendar.png" width="3083" height="1660" alt="PlanGlade monthly calendar showing scheduled tasks and daily workload" loading="lazy">
        </figure>
        <div class="story-copy">
          <span class="story-index">02</span>
          <h3>Plan the week you actually have.</h3>
          <p>Dates stay attached to tasks, so the calendar is a planning view rather than another place to update.</p>
        </div>
      </article>
      <article class="story-row story-row-stacked story-row-offset">
        <figure class="screenshot-card">
          <img src="/assets/product/connections.png" width="3083" height="1660" alt="PlanGlade Connections showing relationships between projects, tasks, notes, people, and labels" loading="lazy">
        </figure>
        <div class="story-copy">
          <span class="story-index">03</span>
          <h3>Follow the thread when context matters.</h3>
          <p>Trace related projects, tasks, notes, people, and labels from one focused map.</p>
        </div>
      </article>
    </div>
  </section>

  <section class="workflow-section">
    <div class="section-shell">
      <div class="section-heading split-heading">
        <div>
          <p class="eyebrow">A lighter workflow</p>
          <h2>Capture first. Shape later.</h2>
        </div>
        <p>PlanGlade gives unformed work somewhere to land, then helps you add only the structure that earns its place.</p>
      </div>
      <ol class="workflow-list">
        <li><span>01</span><h3>Catch it</h3><p>Quick capture keeps an idea from interrupting the work already in front of you.</p></li>
        <li><span>02</span><h3>Place it</h3><p>Process the inbox, connect a project or note, and choose a date when one matters.</p></li>
        <li><span>03</span><h3>See it clearly</h3><p>Return through the view that fits the decision: list, board, calendar, or connections.</p></li>
      </ol>
    </div>
  </section>

  <section class="self-host-callout section-shell">
    <div>
      <p class="eyebrow">Run it on your terms</p>
      <h2>The complete core app stays public.</h2>
      <p>PlanGlade ships with NextAuth, SQLite, local attachment storage, Docker, migrations, and backup guidance. Hosted cloud is separate and is not required.</p>
      <div class="button-row">
        ${button('/self-host/', 'Review self-hosting')}
        ${button(links.github, 'Browse the repository', { secondary: true, external: true })}
      </div>
    </div>
    <div class="terminal" aria-label="PlanGlade setup commands">
      <div class="terminal-bar"><span></span><span></span><span></span><b>setup</b></div>
      <pre><code><span>git clone</span> https://github.com/kalelooz/planglade
<span>cd</span> planglade
<span>npm run</span> setup:local
<span>docker compose</span> up -d</code></pre>
      <p>Read the self-hosting guide before exposing an installation publicly.</p>
    </div>
  </section>

  <section class="closing-band">
    <div class="closing-band-inner">
      <p class="eyebrow">See the real thing</p>
      <h2>Explore the sample workspace, then decide if it fits.</h2>
      <p>The demo uses browser-local sample data. Changes stay on this device and do not create a cloud account.</p>
      <div class="button-row">
        ${button(links.demo, 'Open the demo')}
        ${textLink('/docs/', 'Read the docs')}
      </div>
    </div>
  </section>`

const product = `
  ${pageHero({
    eyebrow: 'Product',
    title: 'One workspace. Several useful views.',
    lede: 'PlanGlade keeps tasks, projects, notes, dates, and relationships together so each view tells the same story.',
    actions: `${button(links.demo, 'Explore the demo')}${button(links.userGuide, 'Read the user guide', { secondary: true, external: true })}`,
  })}

  <section class="feature-ledger section-shell" id="tasks">
    <div class="feature-ledger-intro">
      <p class="eyebrow">Tasks and inbox</p>
      <h2>Make room for unfinished thinking.</h2>
      <p>Capture work quickly, then add status, priority, dates, relations, and project context when you are ready.</p>
    </div>
    <figure class="screenshot-card feature-ledger-image">
      <img src="/assets/product/tasks.png" width="3068" height="1652" alt="PlanGlade task list with grouping, filters, due dates, priorities, and task details" fetchpriority="high">
    </figure>
    <dl class="detail-list">
      <div><dt>Inbox</dt><dd>A holding place for work that has not been organized yet.</dd></div>
      <div><dt>Several views</dt><dd>Use list, board, and timeline presentations without creating duplicate tasks.</dd></div>
      <div><dt>Full context</dt><dd>Open details, dependencies, relations, comments, and history from the work itself.</dd></div>
    </dl>
  </section>

  <section class="feature-band">
    <div class="section-shell feature-band-grid">
      <figure class="screenshot-card">
        <img src="/assets/product/calendar.png" width="3083" height="1660" alt="PlanGlade calendar with scheduled tasks across a monthly view" loading="lazy">
      </figure>
      <div>
        <p class="eyebrow">Calendar</p>
        <h2>Dates remain part of the task.</h2>
        <p>Review a month or week, spot crowded days, and open the normal task details from the calendar.</p>
        <ul class="plain-checks">
          <li>Month and week planning</li>
          <li>Daily workload counts</li>
          <li>Shared task details across views</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="feature-band feature-band-reverse">
    <div class="section-shell feature-band-grid">
      <div>
        <p class="eyebrow">Connections</p>
        <h2>See why a piece of work matters.</h2>
        <p>Filter the relationship map, select one record, and inspect its direct connections without losing the wider picture.</p>
        <ul class="plain-checks">
          <li>Projects, tasks, notes, people, and labels</li>
          <li>Focused relationship inspection</li>
          <li>Dependency context beside the work</li>
        </ul>
      </div>
      <figure class="screenshot-card">
        <img src="/assets/product/connections.png" width="3083" height="1660" alt="PlanGlade relationship map with a selected item and its connected records" loading="lazy">
      </figure>
    </div>
  </section>

  <section class="product-principles section-shell">
    <div class="section-heading split-heading">
      <div><p class="eyebrow">Product boundaries</p><h2>Useful now, honest about what is next.</h2></div>
      <p>The public site describes the current core application. It does not advertise deferred features, fake usage numbers, or a cloud plan you cannot buy.</p>
    </div>
    <div class="boundary-table">
      <div><span>Available now</span><strong>Self-hosted core app</strong><p>Run the complete public application on infrastructure you control.</p></div>
      <div><span>Available now</span><strong>Browser-local demo</strong><p>Explore sample work and interactions without creating an account.</p></div>
      <div><span>Not available yet</span><strong>Hosted cloud</strong><p>No checkout, paid signup, or public cloud account exists today.</p></div>
    </div>
  </section>

  <section class="closing-band">
    <div class="closing-band-inner">
      <p class="eyebrow">Try a real workflow</p>
      <h2>Start on Home. Follow a task into its project and calendar.</h2>
      <p>The demo is the core PlanGlade interface compiled with sample browser-local data.</p>
      <div class="button-row">${button(links.demo, 'Open the demo')}${button(links.github, 'Inspect the code', { secondary: true, external: true })}</div>
    </div>
  </section>`

const selfHost = `
  ${pageHero({
    eyebrow: 'Self-host',
    title: 'Your workspace, on infrastructure you control.',
    lede: 'The complete PlanGlade core stays public, provider-neutral, and usable without a hosted PlanGlade account.',
    actions: `${button(links.selfHost, 'Open the setup guide', { external: true })}${button(links.github, 'View the repository', { secondary: true, external: true })}`,
  })}

  <section class="setup-grid section-shell">
    <div class="setup-intro">
      <p class="eyebrow">Before you begin</p>
      <h2>Self-hosting is a technical setup.</h2>
      <p>PlanGlade is an early preview. Use unique secrets, terminate TLS, keep tested backups, and review the security guide before exposing it to the internet.</p>
    </div>
    <ol class="setup-steps">
      <li><span>01</span><div><h3>Clone and configure</h3><p>Generate a local release configuration with unique secrets. Do not commit the resulting environment file.</p></div></li>
      <li><span>02</span><div><h3>Build and start</h3><p>Use Docker Compose to build the frontend and backend, then start the single-origin application.</p></div></li>
      <li><span>03</span><div><h3>Create the first owner</h3><p>Open the setup route, use the one-time setup token, and create the first workspace owner.</p></div></li>
      <li><span>04</span><div><h3>Protect and back up</h3><p>Back up both the SQLite data and attachment volume, then rehearse a restore before relying on the installation.</p></div></li>
    </ol>
  </section>

  <section class="command-section">
    <div class="section-shell command-grid">
      <div>
        <p class="eyebrow">Local release path</p>
        <h2>One origin, two runtime responsibilities.</h2>
        <p>The frontend serves the product interface. The API-only backend owns authentication, SQLite, migrations, and attachments.</p>
      </div>
      <div class="terminal terminal-large" aria-label="PlanGlade Docker setup commands">
        <div class="terminal-bar"><span></span><span></span><span></span><b>PowerShell or shell</b></div>
        <pre><code><span>git clone</span> https://github.com/kalelooz/planglade
<span>cd</span> planglade
<span>npm run</span> setup:local
<span>docker compose</span> -f compose.yml config
<span>docker compose</span> -f compose.yml build
<span>docker compose</span> -f compose.yml up -d</code></pre>
      </div>
    </div>
  </section>

  <section class="ownership-section section-shell">
    <div class="section-heading split-heading">
      <div><p class="eyebrow">What stays yours</p><h2>A public core without a provider lock.</h2></div>
      <p>The documented self-host path uses standard local components. Optional OAuth and email delivery do not replace the local baseline.</p>
    </div>
    <dl class="ownership-list">
      <div><dt>Identity</dt><dd>NextAuth with local email and password enabled by default.</dd></div>
      <div><dt>Data</dt><dd>SQLite with checked-in migrations and documented upgrade procedures.</dd></div>
      <div><dt>Files</dt><dd>Local attachment storage on a dedicated Docker volume.</dd></div>
      <div><dt>Recovery</dt><dd>Backup, restore, and production migration guides live in the public repository.</dd></div>
    </dl>
  </section>

  <section class="closing-band">
    <div class="closing-band-inner">
      <p class="eyebrow">Use the maintained guide</p>
      <h2>Read the current prerequisites and security notes before installing.</h2>
      <p>The repository documentation is the source of truth for setup commands, environment variables, upgrades, and backups.</p>
      <div class="button-row">${button(links.selfHost, 'Read the self-hosting guide', { external: true })}${textLink('/security/', 'Review security notes')}</div>
    </div>
  </section>`

const docs = `
  ${pageHero({
    eyebrow: 'Docs',
    title: 'Start with the path you need.',
    lede: 'Use the public guides for everyday workflows, self-hosting, releases, contribution, and support.',
  })}
  <section class="docs-index section-shell">
    <a class="docs-feature" href="${links.userGuide}" target="_blank" rel="noreferrer">
      <span>Use PlanGlade</span><h2>User guide</h2><p>Quick capture, inbox processing, task views, projects, notes, calendar planning, connections, and data tools.</p>${externalIcon()}
    </a>
    <div class="docs-list">
      <a href="${links.selfHost}" target="_blank" rel="noreferrer"><span>Run it yourself</span><strong>Self-hosting guide</strong><p>Installation, authentication, TLS, storage, backups, and upgrades.</p>${externalIcon()}</a>
      <a href="${links.releases}" target="_blank" rel="noreferrer"><span>Keep it current</span><strong>Releases</strong><p>Version notes, checksums, upgrade guidance, and release artifacts.</p>${externalIcon()}</a>
      <a href="${links.contributing}" target="_blank" rel="noreferrer"><span>Improve the project</span><strong>Contributing</strong><p>Development setup, quality gates, pull requests, and community expectations.</p>${externalIcon()}</a>
      <a href="${links.issues}" target="_blank" rel="noreferrer"><span>Ask or report</span><strong>Issues and support</strong><p>Search known problems, report a bug, or share early product feedback.</p>${externalIcon()}</a>
    </div>
  </section>
  <section class="docs-note section-shell">
    <div><p class="eyebrow">Current status</p><h2>Documentation follows the public core.</h2></div>
    <p>The website summarizes the product. Detailed operational instructions stay beside the code they describe, where every change can be reviewed.</p>
  </section>`

const about = `
  ${pageHero({
    eyebrow: 'About',
    title: 'Planning software should lower the temperature.',
    lede: 'PlanGlade is being built for people who need structure without turning personal work into process theater.',
    actions: `${button(links.github, 'Follow the project on GitHub', { external: true })}${button(links.demo, 'Explore the demo', { secondary: true })}`,
  })}
  <section class="manifesto section-shell">
    <figure><img src="/assets/editorial-clearing-v1.jpg" width="1536" height="1024" alt="Layered paper and fabric surrounding an open center" loading="lazy"></figure>
    <div>
      <p class="eyebrow">The idea</p>
      <h2>A clearing, not another pile.</h2>
      <p>Work arrives messy. A useful tool should give it somewhere to land, make the important relationships visible, and then get out of the way.</p>
      <p>PlanGlade favors calm information density, direct language, and a small number of durable concepts: tasks, projects, notes, dates, people, labels, and the links between them.</p>
    </div>
  </section>
  <section class="principle-list section-shell">
    <article><span>01</span><h2>Show the real product.</h2><p>The site uses current captures and a working demo. It does not use invented dashboards or fictional metrics.</p></article>
    <article><span>02</span><h2>Keep the core public.</h2><p>The self-hosted application and its provider-neutral contracts remain in the public repository.</p></article>
    <article><span>03</span><h2>Earn complexity.</h2><p>New views and controls should help with a real decision, not decorate the system.</p></article>
    <article><span>04</span><h2>Say what is not ready.</h2><p>Hosted cloud is not available yet. The site will not turn future plans into present-tense promises.</p></article>
  </section>
  <section class="closing-band">
    <div class="closing-band-inner"><p class="eyebrow">Early public preview</p><h2>Use it, question it, and tell us where it gets in the way.</h2><p>Issue #65 collects first-use, core-workflow, and mobile feedback from the public preview.</p><div class="button-row">${button(`${links.github}/issues/65`, 'Share early feedback', { external: true })}${textLink('/contact/', 'Contact and support')}</div></div>
  </section>`

function infoPage(title, intro, sections, eyebrow = 'PlanGlade public site') {
  return `
    ${pageHero({ eyebrow, title, lede: intro })}
    <section class="prose-page section-shell">
      ${sections.map(({ heading, body }) => `<section><h2>${heading}</h2>${body}</section>`).join('')}
    </section>`
}

const privacy = infoPage(
  'Privacy',
  'A short account of what the public website and demo do with your information.',
  [
    { heading: 'Public website', body: '<p>The marketing pages do not offer an account, checkout, newsletter form, or cloud workspace. PlanGlade may use privacy-conscious aggregate traffic measurement when it is explicitly configured by the site operator.</p>' },
    { heading: 'Browser-local demo', body: '<p>The demo uses sample data in your browser. Do not enter private or sensitive information. Clearing site data removes browser-local changes.</p>' },
    { heading: 'Self-hosted installations', body: '<p>A self-hosted PlanGlade installation is controlled by the person or organization running it. That operator is responsible for access, logs, backups, retention, and applicable privacy obligations.</p>' },
    { heading: 'Hosted cloud', body: '<p>Hosted cloud is not available yet. There is no PlanGlade cloud account or paid signup today.</p>' },
  ],
)

const terms = infoPage(
  'Terms',
  'Simple conditions for using the public website, browser-local demo, and open-source project.',
  [
    { heading: 'Website and demo', body: '<p>The public website and demo are provided for evaluation on an as-is basis. The demo is not a place to store work you need to keep.</p>' },
    { heading: 'Open-source software', body: `<p>PlanGlade source code is licensed under the GNU Affero General Public License v3.0. Review the <a href="${links.license}" target="_blank" rel="noreferrer">license in the repository</a> before distributing or modifying the software.</p>` },
    { heading: 'Self-hosting', body: '<p>You are responsible for configuring, securing, operating, updating, and backing up your own installation.</p>' },
    { heading: 'Hosted cloud', body: '<p>No hosted cloud service, subscription, checkout, or service-level commitment is offered today.</p>' },
  ],
)

const security = infoPage(
  'Security',
  'How to report a vulnerability and what to review before running PlanGlade on the public internet.',
  [
    { heading: 'Report privately', body: `<p>Use <a href="${links.securityReport}" target="_blank" rel="noreferrer">GitHub Private Vulnerability Reporting</a> for suspected vulnerabilities. Do not post exploit details, secrets, or private data in a public issue.</p>` },
    { heading: 'Before self-hosting publicly', body: '<p>Use unique secrets, HTTPS, a maintained reverse proxy, tested backups, controlled network access, and appropriate monitoring. Review authentication, storage permissions, logs, and rate limiting for your environment.</p>' },
    { heading: 'Early preview', body: '<p>PlanGlade is under active development and is not yet production-hardened for every environment. Keep the application and its dependencies current.</p>' },
    { heading: 'Public policy', body: `<p>The repository <a href="${links.github}/security/policy" target="_blank" rel="noreferrer">security policy</a> is the source of truth for supported versions and reporting details.</p>` },
  ],
)

const contact = infoPage(
  'Contact and support',
  'Use the public GitHub project for normal questions, bugs, feature ideas, and self-host feedback.',
  [
    { heading: 'Report a bug', body: `<p>Search existing reports first, then <a href="${links.newIssue}" target="_blank" rel="noreferrer">open the matching issue form</a> with a clear reproduction and environment details.</p>` },
    { heading: 'Share product feedback', body: `<p>Use <a href="${links.github}/issues/65" target="_blank" rel="noreferrer">the early public feedback issue</a> for first-use, core-workflow, and mobile observations.</p>` },
    { heading: 'Ask for help', body: `<p>Read the <a href="${links.github}/blob/main/docs/SUPPORT.md" target="_blank" rel="noreferrer">support guide</a>, then use a public issue when the question contains no sensitive information.</p>` },
    { heading: 'Report a vulnerability', body: `<p>Use <a href="${links.securityReport}" target="_blank" rel="noreferrer">Private Vulnerability Reporting</a>. Keep security details out of public issues.</p>` },
  ],
  'Support',
)

const notFound = `
  <section class="not-found section-shell">
    <p class="eyebrow">404</p>
    <h1>This path has not been cleared yet.</h1>
    <p>The page may have moved, or the address may be incomplete.</p>
    <div class="button-row">${button('/', 'Return home')}${button('/docs/', 'Browse the docs', { secondary: true })}</div>
  </section>`

export const pages = [
  { path: '/', output: 'index.html', title: 'PlanGlade | A quieter place for project work', description: 'Open-source workspace for tasks, projects, notes, calendars, and connected work. Self-host PlanGlade or explore the browser-local demo.', content: home },
  { path: '/product/', output: 'product/index.html', title: 'Product | PlanGlade', description: 'See how PlanGlade keeps tasks, projects, notes, calendar planning, and connected work in one calm workspace.', content: product },
  { path: '/self-host/', output: 'self-host/index.html', title: 'Self-host PlanGlade', description: 'Run the complete open-source PlanGlade core with NextAuth, SQLite, local attachment storage, Docker, and documented backups.', content: selfHost },
  { path: '/docs/', output: 'docs/index.html', title: 'Documentation | PlanGlade', description: 'Find PlanGlade user, self-hosting, release, contribution, and support documentation.', content: docs },
  { path: '/about/', output: 'about/index.html', title: 'About | PlanGlade', description: 'Read the principles behind PlanGlade, a calm open-source workspace for personal project work.', content: about },
  { path: '/privacy/', output: 'privacy/index.html', title: 'Privacy | PlanGlade', description: 'Privacy notes for the PlanGlade public website, browser-local demo, and self-hosted installations.', content: privacy },
  { path: '/terms/', output: 'terms/index.html', title: 'Terms | PlanGlade', description: 'Terms for using the PlanGlade public website, browser-local demo, and open-source project.', content: terms },
  { path: '/security/', output: 'security/index.html', title: 'Security | PlanGlade', description: 'PlanGlade security reporting and self-hosting guidance.', content: security },
  { path: '/contact/', output: 'contact/index.html', title: 'Contact and support | PlanGlade', description: 'Find the right public or private channel for PlanGlade support, bugs, feedback, and security reports.', content: contact },
  { path: '/404/', output: '404.html', title: 'Page not found | PlanGlade', description: 'The requested PlanGlade page could not be found.', robots: 'noindex, follow', content: notFound },
]
