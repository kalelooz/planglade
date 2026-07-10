# PlanGlade — SaaS Launch Plan

**Status:** v1.1 / resource pack v6.3 - public website + SaaS/cloud plan, aligned with repo-level `AGENTS.md`
**Date:** 2026-07-03
**Companion documents:** `PRODUCT.md`, `TECHNICAL.md`, `EXECUTION.md`, `AGENTS.md`, `AGENT-BOOTSTRAP.md`

---

## 0. Purpose

This file owns the public website, SaaS/cloud launch plan, demo plan, pricing direction, business boundary, and launch tooling. It exists so `PRODUCT.md`, `TECHNICAL.md`, and `EXECUTION.md` do not keep mixing product truth with SaaS operations.

This file does **not** override the technical security rules in `TECHNICAL.md`.

---

## 1. Current Launch Status

The PlanGlade public website is live on Netlify.

Current priority: post-live verification and demo/read-only audit.

Public line:

> Self-host now. Cloud soon.

Supporting line:

> Try demo.

Do not wait for cloud, billing, or Postgres to publish the first website.

Expose demo only through the dedicated read-only demo route. Do not expose normal `/app` as a public demo.

---

## 2. Public Copy Rules

Use short human copy.

Approved:

- Self-host now.
- Cloud soon.
- Try demo.
- Free to self-host.
- Paid cloud coming.
- Demo mode.
- Changes are disabled.
- Run PlanGlade yourself.
- A calmer way to manage projects.

Avoid on public pages:

- technical users
- production hardening
- being prepared
- currently planned
- not currently available
- active development
- future cloud foundation
- operational maturity

Internal docs can discuss risk honestly. Public marketing should not sound scared or robotic.

---

## 3. First Website Positioning

Hero:

> A calm clearing for your projects.

Subtitle:

> Open-source workspace for tasks, projects, notes, calendar planning, and getting work out of your head.

Status:

> Self-host now. Cloud soon.

CTAs:

- View on GitHub
- Self-host PlanGlade
- Try demo

Feature labels:

- Tasks
- Projects
- Notes
- Inbox
- Calendar

Status section:

- Available now: Self-host
- Coming soon: Cloud
- Available now: Demo mode

Pricing teaser:

- Self-hosted: Free
- Cloud: Paid plan coming soon

FAQ:

- Is PlanGlade free? Yes. You can self-host PlanGlade for free.
- Is Cloud live? Not yet. Cloud is coming soon.
- Can I try a demo? Yes. Demo mode is read-only; changes are disabled.
- Who is it for? Solo builders, freelancers, students, writers, maintainers, small teams, and anyone who wants a calmer project workspace.

---

## 4. What the First Website Must Not Do

- No checkout.
- No paid signup.
- No cloud account creation.
- No fake demo.
- No fake testimonials.
- No fake user counts.
- No fake analytics screenshots.
- No "production ready" claim.
- No full pricing page unless the cloud path is actually ready.
- No public route that bypasses app auth.

---

## 5. Self-Host vs SaaS Boundary

Self-host/open-source should include the core app people need:

- tasks
- projects
- inbox
- notes/docs
- calendar
- settings/export
- auth needed for self-hosting
- database migrations
- Docker/self-host docs
- backup/restore docs as they mature
- health checks as they mature

Private SaaS/business material does not need to be public:

- payment provider secrets
- hosted-cloud billing setup
- production customer analytics dashboards
- private support tooling
- private marketing experiments
- private deployment runbooks
- provider account settings
- internal pricing experiments
- private infrastructure config

**SaaS infrastructure boundary (`FIREBASE-SAAS-BOUNDARY-001`):** Firebase may be used by the hosted PlanGlade SaaS deployment, but it is not part of the public self-host setup. Public self-host documentation and defaults must not require Firebase. Firebase authentication, Firebase Admin, Firebase Storage, Firebase App Hosting configuration, and Firebase/GCP service-account setup all belong to private SaaS infrastructure. The in-repo Firebase adapter code is temporary extraction debt (`SAAS-FIREBASE-EXTRACT-001`); until it is moved to a private SaaS codebase it stays behind an explicit opt-in and must not be advertised or defaulted to as a public self-host feature. Public core functionality remains fully available without Firebase.

AGPL compliance still matters. Do not hide core app changes that must be released under AGPL.

---

## 6. Pricing Direction

Public website now:

- Self-hosted: Free
- Cloud: Paid plan coming soon

Internal target for first paid cloud plan:

- PlanGlade Cloud: $9/month
- Annual: $90/year

Reasoning: the target market has common solo/project tools around the same zone. The plan should feel affordable but not cheap. Avoid too many tiers early.

Do not implement checkout until these exist:

- production auth decision
- hosted Postgres path
- backups and restore test
- support email
- Terms / Privacy / Refund / Acceptable Use
- billing provider decision
- basic monitoring
- demo isolation if demo is launched

Later team pricing can be added only after collaboration/invites are product-ready.

---

## 7. Billing Direction

Do not hard-code Stripe-only billing.

Reason: the maintainer is in Qatar, and Stripe global availability must be confirmed for the seller/company setup before building checkout around it.

Use a provider-neutral billing shape later:

- `Plan`
- `Subscription`
- `BillingCustomer`
- `BillingEvent`
- `provider`
- `providerCustomerId`
- `providerSubscriptionId`

Possible provider paths to research/confirm before implementation:

- Stripe through a supported jurisdiction/company setup
- Stripe Atlas if the maintainer chooses that route
- PayPal/manual payment as temporary fallback
- Paddle/Lemon Squeezy only after seller availability is confirmed

First website should use demo/GitHub/self-host CTAs, not checkout.

---

## 8. Demo Direction

Public demo is read-only.

Demo copy:

> Try demo.

Banner/message:

> Demo mode — changes are disabled.

Allowed:

- browse projects
- open tasks
- open drawers and modals
- use filters/views
- view notes
- view calendar
- click around the app

Blocked:

- create
- edit
- delete
- file uploads
- member invites
- billing
- email sending
- exports
- workspace deletion
- account, email, security, and workspace settings changes
- API tokens

Demo data should be broad and non-tech-only:

- Small bakery launch
- Student thesis plan
- Home renovation
- Freelance client website
- Community event
- Open-source release

Implementation rules:

- demo data must be isolated from real users
- demo must require no login or email
- demo writes must be blocked server-side, not only by disabled UI
- blocked actions must show: Demo mode — changes are disabled.
- demo must have visible banner: Demo mode — changes are disabled.
- no customer data in demo
- no profanity, edgy content, or private-looking data

Do not use a writable demo plan. Read-only avoids shared-demo vandalism, moderation work, and database abuse.

---

## 9. Recommended Tooling

Use existing tools. Do not build everything from scratch.

### Website analytics

Preferred: Umami.

Reason: simple, fast, privacy-focused, open-source analytics alternative. Add only if env-driven and easy to disable.

Implementation rule: no hardcoded analytics URL or website ID. Use env vars such as:

- `NEXT_PUBLIC_UMAMI_SRC`
- `NEXT_PUBLIC_UMAMI_WEBSITE_ID`

If env vars are missing, analytics should do nothing.

### Demo / feedback

First day: read-only demo plus GitHub/self-host links.

Later: Formbricks if surveys/feedback/waitlist need to be owned and self-hosted.

### Uptime

Later: Uptime Kuma or Better Stack.

Do not block first website launch on this.

### Product analytics

Later: PostHog, only after demo/cloud has actual usage to learn from.

### Error tracking

Later: Sentry or equivalent.

Do not add a heavy observability stack before the public website is live.

---

## 10. Recommended Cloud Architecture Later

Do not rebuild into microservices.

Keep:

- one Next.js app
- central auth/permission layer
- Prisma
- PostgreSQL for hosted cloud
- provider boundary for storage
- provider boundary for billing
- provider boundary for analytics

Suggested low-friction hosted stack later:

- App hosting: Vercel or equivalent managed Next.js hosting
- Database: Neon/Supabase-style managed Postgres
- Object storage: Cloudflare R2 or another S3-compatible store
- Email: Resend or equivalent transactional email
- Analytics: Umami first, PostHog later if needed
- Uptime: Uptime Kuma/Better Stack later
- Errors: Sentry later

Priority order from maintainer:

1. easy for beginner
2. open-source/self-host credibility
3. scalable without rebuild
4. lowest cost

This means managed services first, but keep Docker portability.

---

## 11. Website Post-Live Checklist

Current status: the website is live on Netlify. Use this checklist for post-live verification and follow-up audits.

Minimum:

- domain points to deployed website
- homepage loads
- mobile layout works
- View on GitHub link works
- Self-host link works
- demo link works
- `/app` remains protected
- no fake demo; `/demo` is read-only
- no checkout
- no false production-ready claim
- README and website do not contradict each other
- title/meta/OG description exist
- favicon exists or simple placeholder exists
- build passes

Good but not required for day one:

- Umami env-driven analytics
- sitemap
- robots.txt
- Open Graph image
- basic privacy page
- status page

---

## 12. Known Current Conflicts to Fix

The public README/docs may still say cloud is not planned or no hosted cloud promise exists. That now conflicts with the new direction.

Fix to short language:

> Self-host now. Cloud soon.

Do not say:

> hosted cloud is not planned

Do not overcorrect into:

> cloud is live

---

## 13. External Reference Notes

These are not strict dependencies. They support decisions and should be rechecked before implementation:

- Vercel Pro pricing and deployment features.
- Neon pricing and Postgres capabilities.
- Cloudflare R2 pricing/free tier and S3-compatible storage economics.
- Resend free/pro transactional email pricing.
- Umami as open-source privacy-friendly analytics.
- Formbricks as open-source survey/feedback tooling.
- Uptime Kuma as self-hosted monitoring.
- PostHog as heavier product analytics later.
- Stripe global availability for Qatar/company setup.
- PayPal Qatar/payment support as a possible fallback.

---

## 14. Ticket - WEBSITE-LIVE-001

Status: **Completed.** The public website is live on Netlify. Do not run this as the next implementation task.

```md
Task Name: WEBSITE-LIVE-001 - Launch PlanGlade Website

Goal:
Make planglade.com ready to go live with clean, short, honest public copy.

Positioning:
- Self-host now.
- Cloud soon.
- Try demo.
- Demo mode.
- Changes are disabled.
- Free to self-host.
- Paid cloud coming.

Allowed Areas:
- Landing page
- Public metadata
- README/roadmap wording only if it conflicts with the website
- SEO basics
- Optional lightweight analytics hook

Do-Not-Touch:
- No billing
- No checkout
- No cloud accounts
- No writable public demo
- No database/auth/app behavior changes
- No new big dependencies
- No fake testimonials
- No fake stats
- No fake production-ready claims

Copy Rules:
Use short human wording.

Good:
- Self-host now. Cloud soon.
- Run PlanGlade yourself.
- Try demo.
- Demo mode.
- Changes are disabled.
- Free to self-host.
- Paid cloud coming.

Avoid:
- technical users
- production hardening
- being prepared
- not currently available
- currently planned
- active development

Requirements:
1. Hero:
   - Title: A calm clearing for your projects.
   - Subtitle: Open-source workspace for tasks, projects, notes, calendar planning, and getting work out of your head.
   - Badge/copy: Self-host now. Cloud soon.
2. CTAs:
   - View on GitHub
   - Self-host PlanGlade
   - Try demo
3. Add simple product section:
   - Tasks
   - Projects
   - Notes
   - Inbox
   - Calendar
4. Add simple status section:
   - Available now: Self-host
   - Coming soon: Cloud
   - Available now: Demo mode
5. Add simple pricing copy:
   - Self-hosted: Free
   - Cloud: Paid plan coming soon
6. Add FAQ:
   - Is PlanGlade free?
   - Is Cloud live?
   - Can I try a demo?
   - Who is it for?
7. Optional analytics:
   - Add Umami only if it can be done through env vars and no hardcoded script URL.
   - If env vars are missing, analytics should do nothing.
8. Add/update:
   - page title
   - meta description
   - Open Graph title/description
   - favicon/app icon if already available
   - sitemap/robots if already supported cleanly

Acceptance:
- Website builds.
- Copy is short and human.
- No scary legal/dev wording.
- No fake cloud/demo/billing.
- GitHub and demo links work.
- README does not contradict the website.
- /demo is read-only and /app is not exposed as a fake demo.

Validation:
- npm run lint
- npm run typecheck
- npm test
- npx prisma validate
- npm run build
- git diff --check

Report:
- Files changed
- Copy changed
- Links used
- Analytics added or skipped
- Validation results
```

## 15. Ticket - WEBSITE-POST-LIVE-AUDIT-001

```md
Task Name: WEBSITE-POST-LIVE-AUDIT-001 - Post-Live Website Audit

Goal:
Verify the live Netlify website after launch and record any small follow-up fixes.

Allowed Areas:
- Public website copy if it contradicts live status
- README/roadmap wording only if it directly contradicts live website or demo status
- Public metadata
- Demo route/read-only audit report

Do-Not-Touch:
- No billing
- No checkout
- No cloud accounts
- No app feature work
- No broad redesign
- No dependency changes

Acceptance:
- Homepage loads on the live Netlify site.
- GitHub, self-host, and demo links work.
- /demo is read-only.
- /app is not exposed as a fake public demo.
- Public docs do not say the website or demo are still pending.
- No fake cloud, checkout, billing, or production-ready claims exist.

Validation:
- Browser smoke check of the live site.
- Smallest relevant repo checks for any docs/copy changes.
```
