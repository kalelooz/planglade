# PlanGlade — Technical Reference

**Status:** v6.3 - consolidated, audited, corrected after resource mismatch audit, updated for SaaS launch planning, and aligned with repo-level `AGENTS.md`
**Supersedes:** Technical Reference v2
**Companion documents:** `PRODUCT.md` (product/design truth), `EXECUTION.md` (roadmap/tickets/current state), `AGENTS.md` (repo-level agent rules), `AGENT-BOOTSTRAP.md` (session-start prompt)

This document is the architecture, security, and deployment **target**, per the maintainer's explicit direction: when live code disagrees with this document, the document stays as written and the gap is tracked as debt — not silently absorbed by rewriting the spec to match whatever shipped. Exception: where code has already delivered exactly what this document specifies (e.g. Docker), the document's job is just to stop being stale about it.

**SaaS/public launch note:** operational business choices, website copy, demo plan, pricing direction, analytics/tooling picks, and hosted-cloud sequencing live in `SAAS-LAUNCH.md`. This file only owns the technical truth and drift.

---

## 0. Read this first — how to use this reference

Use current `main` and the files it contains as the implementation baseline. This document records architecture decisions and durable implementation status; avoid treating branch names, commit SHAs, package versions, or test totals as timeless facts.

**Dated evidence:** PR #34, merged 2026-07-10, replaced MDXEditor with the Markdown-backed Tiptap Notes editor and reported `412/412` passing tests for that PR. That total is historical validation evidence, not a standing test-count claim.

---

## 1. Architecture Decision

Keep PlanGlade as **one full-stack Next.js application**. Do not split into microservices.

**Rationale:** the MVP needs product speed, not distributed-system complexity. Next.js App Router handles pages, route handlers, server actions, and server components in one place. Self-hosting stays simple with one app and one database. No current scaling pressure justifies services, queues, or Kubernetes.

```text
Browser
  → Next.js App Router
      → Server Components
      → Server Actions / Route Handlers
      → Central AuthN/AuthZ Layer (public self-host mode: dev / nextauth; firebase is SaaS-only — see §3.2)
      → Prisma
      → Database
```

---

## 2. Stack — Target vs. Confirmed Reality

| Layer | Target (spec) | Confirmed reality |
|---|---|---|
| Framework | Next.js App Router | Next.js App Router; `package.json` is authoritative for versions |
| Language | TypeScript strict | TypeScript |
| Styling | Tailwind CSS | Tailwind CSS v4 |
| UI | shadcn/ui + Radix | Radix primitives and local UI components |
| Icons | Lucide React | Lucide React |
| ORM | Prisma | Prisma |
| Database | PostgreSQL production, SQLite dev | **SQLite only** — no Postgres datasource configured anywhere |
| Auth | Auth.js / NextAuth | NextAuth v4 for public self-host; v5 migration remains tracked debt |
| Validation | Zod | Zod |
| Forms | React Hook Form | React Hook Form |
| Testing | Vitest + Playwright | **Node's built-in test runner** via `tsx` — no Vitest, no Playwright in CI |
| Deployment | Docker + docker-compose | Docker baseline with migrations, health check, non-root runtime, SQLite, and local attachment storage |

**Confirmed but never specified anywhere in `PRODUCT.md` or this document:**

| Package | Apparent purpose | Status |
|---|---|---|
| `firebase` / `firebase-admin` | Firebase Auth + Storage adapters | **SaaS-only — see §3.2.** Temporary extraction debt pending `SAAS-FIREBASE-EXTRACT-001`; not a public self-host path |
| Tiptap packages | Markdown-backed Notes editor | Deliberate — selected by `NOTES-TIPTAP-001`; Notes still store Markdown and remain a lightweight editor rather than a block system |
| `next-intl` | Internationalization | No product doc mentions multi-language support at all |
| `recharts` | Charting | Reports/analytics is explicitly "Later" in `PRODUCT.md §11` |
| `z-ai-web-dev-sdk` | Unknown | Unexplained; verify it's needed before treating it as trusted |
| `papaparse` | CSV parsing | Consistent with planned `IMPORT-001` — fine |

---

## 3. Implementation Status and Known Drift

Reconciled against direct evidence from both the Architect's decision-history review and Codex's live repo audit (2026-07-01). This replaces speculation from the prior version of this document with confirmed facts, and separates "code fell short of the target" from "the target was never actually written down."

### 3.1 Version/tooling drift — code should converge to spec (maintainer's standing decision)

| Area | Spec | Reality | Action |
|---|---|---|---|
| Auth library | NextAuth v5 | v4 | Debt - see `EXECUTION.md` backlog. Note: v5 has breaking API changes from v4; this is a real migration, not a version bump |
| Production database | PostgreSQL | SQLite only, no Postgres path exists | Debt |
| Test runner | Vitest + Playwright | Node's built-in runner is the actual runner | Debt, **or** formally adopt Node's runner as the target. This needs an explicit maintainer call rather than a default migration. |
| Docker self-host | Docker + compose | Present | No current implementation gap for the early Docker baseline |

### 3.2 Firebase — SaaS-only, not a public self-host path

**Settled decision (`FIREBASE-SAAS-BOUNDARY-001`, 2026-07-09):** Firebase is reserved for PlanGlade's private hosted SaaS/cloud deployment. It is **not** part of the public open-source self-host product. The public repository and self-host experience must remain independently usable without any Firebase account, credentials, project, or setup.

The live code still contains a three-way auth mode switch (`dev` / `firebase` / `nextauth`) and a `firebase` storage provider, but these are **temporary extraction debt**, not a supported public self-host mode:

- **Public core / self-host boundary:** `nextauth` (or `dev` for local development) for auth, `local` storage for attachments, the documented self-host database, and Docker/public migration tooling. Production defaults resolve to `nextauth` and `local`; no Firebase configuration is required or advertised for self-host.
- **Private hosted SaaS boundary:** Firebase auth adapter, Firebase Admin, Firebase Storage, hosted-provider configuration, and private deployment/operational details. These belong to private SaaS infrastructure.
- Firebase and NextAuth remain **mode-selected, not simultaneous** for authentication; storage provider (local vs. Firebase) is selected independently of auth mode.

Physical extraction of the Firebase implementation into a private SaaS codebase is tracked as `SAAS-FIREBASE-EXTRACT-001`. Until that lands, the Firebase code remains in-repo behind an explicit opt-in (`PLANGLADE_AUTH_MODE=firebase` / `PLANGLADE_STORAGE_PROVIDER=firebase`) and must not be re-advertised as a public self-host feature. See `EXECUTION.md` §5/§6 and the extraction manifest in `docs/FIREBASE_EXTRACTION_PLAN.md`.

### 3.3 Backend-complete, UI-dormant — lower urgency than previously flagged

Two subsystems exist, are well-tested, and are **not reachable through the normal product UI today**:

- **Attachments:** local provider fully implemented (signed URLs, HMAC signing, path-traversal protection, MIME/size validation) and is the public self-host default. A Firebase Storage provider also exists but is **SaaS-only** (see §3.2); it remains as temporary extraction debt behind an explicit opt-in. No frontend component calls the upload/list/download endpoints yet. Project feature flag defaults to `false`.
- **Workspace invites & member management:** creation, resend, revoke, expiry, role/domain policy, email delivery (console/Resend) are all implemented and tested. Only **invite acceptance** is reachable via `/login?inviteToken=...`. No send-invite, policy, or member-admin UI exists. `/team` explicitly redirects to `/app`.

This reads as backend-built-ahead-of-UI, correctly gated from users — reasonable sequencing, not a broken promise. The real decision is whether to build the UI now (pulling Phase 4 collaboration forward) or leave both dormant until their originally planned phase. Either is defensible; it just needs to be a decision, not silence.

### 3.4 Legacy naming cleanup — in progress, not a surprise

`PLANGLADE_*` environment variables fall back to legacy `FLOWBOARD_*` equivalents throughout the codebase (auth, storage, email, workspace scaffolding). Commits and a dedicated test (`public-legacy-naming-cleanup.test.ts`) confirm this is active, tracked cleanup from the pre-rename codebase, not newly discovered drift.

### 3.5 Small, concrete, low-effort fixes

- **GitHub OAuth is dead code in practice.** `GITHUB_ID`/`GITHUB_SECRET` are accepted server-side and would enable the provider, but the login page only renders a Google button and calls `signIn("google")`. Either wire up the UI or drop the server-side config — leaving it half-configured is the worst of both options.
- `npm ls` reports one extraneous package: `@emnapi/runtime@1.10.0`. Harmless, but worth a clean-up pass.

---

## 4. Core Data Model

`prisma/schema.prisma` is authoritative for model fields, relations, constraints, and the datasource. The current datasource is SQLite; PostgreSQL is a future private hosted-SaaS direction, not a current runtime option.

The model groups are identity and tenancy (`User`, `Workspace`, memberships and invites); core work (`Project`, `WorkItem`, labels, inbox items, and work-item relations); and product context (`Note`, `ProjectDoc`, `Attachment`, saved views, comments, activity, notifications, and user settings).

`PRODUCT.md` owns purpose-level descriptions; this document does not duplicate a partial schema snapshot.

---

## 5. Authorization Architecture

All permissions live in `src/lib/permissions/`. No inline permission logic scattered through route handlers.

**Required check order** — every API/server action touching workspace data must verify, in this order:
1. User is authenticated.
2. User is a workspace member.
3. Entity belongs to the verified workspace.
4. User role allows the operation.

**Hard rule:** never use a client-provided `userId` or `workspaceId` as trusted identity. The session is the only source of truth.

```ts
export async function requireWorkspaceMember(workspaceId: string) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new PermissionError("UNAUTHENTICATED")
  }

  const member = await prisma.workspaceMember.findUnique({
    where: {
      userId_workspaceId: {
        userId: session.user.id,
        workspaceId,
      },
    },
  })

  if (!member) {
    throw new PermissionError("UNAUTHORIZED")
  }

  return {
    userId: session.user.id,
    workspaceId,
    role: member.role,
  }
}
```

**Confirmed session resolution (mode-selected):**
- `dev` (public local development): upserts a fixed development user, creates/updates a configured dev workspace, ensures OWNER membership.
- `nextauth` (public self-host): calls `getServerSession`, requires an email, resolves DB user/membership.
- `firebase` (SaaS-only — see §3.2): requires a Bearer token or equivalent header, verified via Firebase Admin, then resolves DB user/membership. Not a public self-host path.
- Non-dev users without a membership receive `409 ONBOARDING_REQUIRED`.

---

## 6. API and Server Action Rules

**Prefer server actions** for simple authenticated mutations: create/update task, create project, capture/convert inbox item, create note/doc.

**Use route handlers** when: external integrations need endpoints, import/export uses file upload/download, an explicit API contract is clearer, or the testing boundary benefits from an HTTP contract.

**Standard response shape:**
```ts
return Response.json({ data })
return Response.json({ error: "Message", code: "CODE" }, { status: 400 })
```

All request bodies validate through Zod.

---

## 7. Calendar and Timeline Rule

Calendar and timeline must never duplicate task data.

- **Calendar MVP:** query tasks where `dueDate` is not null.
- **Timeline v1:** query tasks where `startDate` or `dueDate` is not null. If `startDate` is null, render as a milestone/due marker.

**Current surface status:** dependency handling is partially shipped contextual task functionality in selected task, board, and project interfaces, but it is not a complete standalone workflow or primary product surface. Timeline has partial project-level rendering; its standalone route redirects and Timeline is not an MVP navigation surface.

---

## 8. Notes and Docs Rule

Notes and docs are separate by product meaning. Notes are freeform, global or project-linked. Docs are structured, always project-linked.

**Update:** the Project Detail UI no longer surfaces a Docs tab — Notes now carries project context in the primary UI, and Docs is an advanced, default-off project feature flag rather than a core MVP tab. The backend/data model for Docs is unchanged; only its default visibility changed.

**Notes editor decision:** Tiptap is the selected Notes editor. The database remains Markdown-backed; Tiptap parses Markdown for editing and serializes back to Markdown on save. This is basic rich-text editing for lightweight Notes, not a Notion-style block system.

PlanGlade Markdown uses `++underlined text++` as its underline extension because standard Markdown has no underline syntax. The editor also accepts legacy `<u>text</u>` input and normalizes it to `++text++` when saved. Renderers must preserve this extension rather than silently dropping underline formatting.

Markdown is rendered through the existing safe-rendering boundary: raw active HTML and unsafe link protocols are not executed or rendered as trusted content.

---

## 9. Self-Hosting Baseline

Docker packaging exists: multi-stage Node 22 Alpine `Dockerfile`, `docker-compose.yml`, non-root user, standalone Next.js runner, persistent SQLite and local-attachment volumes, health check, NextAuth as the public self-host default with local attachment storage. (A Firebase Storage provider exists in-repo but is SaaS-only — see §3.2 — and is not part of the Docker self-host path.)

**What's not solved:** PostgreSQL remains a separate, unimplemented provider migration — the shipped baseline still tracks SQLite. HTTPS/reverse proxy, monitoring, and automated backups are explicitly not bundled.

`README.md` and `docs/SELF_HOSTING.md` acknowledge the early Docker baseline. Treat older claims that Docker is unsupported or missing as stale audit residue.

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      NEXTAUTH_URL: ${NEXTAUTH_URL}
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      POSTGRES_DB: planglade
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```
*(Reference future Postgres baseline. The current compose file uses SQLite + volume-mounted storage. Treat Postgres as a later migration ticket, not current truth.)*

---

## 10. Testing Requirements

```text
tests/
  unit/
  integration/
  e2e/
```

**Confirmed current reality:** the runner is Node's built-in test runner via `tsx`, not Vitest/Playwright. No Jest/Vitest config exists; Playwright is not wired into CI. No line/branch coverage instrumentation exists. PR #34, merged 2026-07-10, reported `412/412` passing tests for that change; do not treat it as a timeless count.

**Honest coverage read (from direct repo audit):** strongest around workspace authorization denial paths, invite/member guards, import/export, and task relations/hierarchy. Weakest around real Firebase/OAuth callbacks, Firebase Storage operations, Resend network delivery, and actual browser upload/download flows — none of which are integration-tested against real services. Of the 49 files, 22 are primarily source-text assertions rather than rendered component or interaction tests; treat "UI test" coverage claims accordingly.

**Minimum layers before public MVP (target, unchanged):**
- *Unit:* validators, task date logic, project progress logic, note checklist extraction.
- *Integration:* unauthenticated API denied, cross-workspace reads/writes denied, inbox conversion creates a task and marks the item converted, calendar query returns only workspace tasks, docs are project/workspace scoped.
- *E2E:* sign-in dev flow, create workspace, capture inbox item, convert to task, create project, add task to project, create note/doc, calendar shows task, navigation works without console errors.

---

## 11. CI/CD

**Confirmed current pipeline:** `npm ci` → `npm run check:readme-sync` → `npm run db:generate` → `npx prisma validate` → `npm run ci:check` → `npm run test` → `npm audit --omit=dev --audit-level=high`.

**Target, not yet true:** pin third-party GitHub Actions to SHA, minimal permissions, Dependabot weekly (Dependabot itself is confirmed active — 5 merged PRs), secret scanning, push protection, protected main branch.

If §3.1's testing decision lands on Vitest/Playwright, this pipeline needs new steps to run them — that's additional scope beyond "install the packages."

---

## 12. Hosted Cloud / SaaS Technical Direction

The first public website does **not** require hosted cloud. Do not block `WEBSITE-LIVE-001` on cloud work.

When hosted cloud work starts, target a boring, upgrade-safe architecture:

- Keep one Next.js app. Do not split into microservices.
- Use PostgreSQL for hosted cloud. SQLite is local/dev/self-host baseline only until explicitly upgraded.
- Keep storage behind a provider boundary. Prefer S3-compatible object storage for hosted attachments when attachment UI is enabled.
- Keep billing behind a provider boundary. Do not hard-code Stripe-only assumptions because Qatar support is unresolved.
- Keep analytics optional and env-driven. No hardcoded tracker URLs or public secrets.
- Keep demo isolated from production workspaces. No shared customer data, no billing actions, no uploads, no invites.

Preferred first hosted stack is documented in `SAAS-LAUNCH.md`: Vercel or equivalent for app hosting, Neon/Supabase-style Postgres, Cloudflare R2-style object storage, Resend-style transactional email, Umami optional for website analytics, and Uptime Kuma/Better Stack/Sentry/PostHog later as needed.

This is direction, not a ticket. Implement only when a scoped ticket requests it.

## 13. Observability

**MVP:** structured server logs, request IDs, safe error handling, no PII/secrets in logs.
**Later:** OpenTelemetry, Sentry or self-hosted error tracking, audit log for destructive/admin actions.

---

## 14. File Structure

```text
src/
  app/
    (marketing)/
    (auth)/
    (app)/
      layout.tsx
      page.tsx
      inbox/
      tasks/
      projects/
      notes/
      calendar/
      settings/
    api/
  components/
    ui/
    layout/
    inbox/ tasks/ projects/ notes/ docs/ calendar/ shared/
  lib/
    auth/ db/ permissions/ validations/ services/ utils/
  hooks/
  types/
prisma/
tests/
docs/
```

---

## 15. Security Hard Rules

Canonical copy — `PRODUCT.md` does not repeat this list, it links here.

Never: commit `.env` · expose secrets in browser code · hardcode admin credentials · ship fake auth in production · trust a client-provided user/workspace identity · render raw HTML without sanitization · expose stack traces · add packages without a license/security review.

Always: rate-limit auth and import endpoints before public launch · sanitize imported content.

Every workspace route must verify, in order: authenticated user → workspace membership → entity belongs to workspace → role permits the operation.

**Security reconciliation:** PR #29 records remediation of the known 11 application findings. Issue #30 remains open only for live Firebase overwrite-precondition verification in the private SaaS path. No new security audit is claimed here; real-service Firebase, OAuth, Resend, and browser attachment integration coverage remains limited.

**Add to this list given confirmed findings:** review `z-ai-web-dev-sdk` for legitimacy and necessity before the next dependency audit — it's unexplained in any planning doc or ticket history found so far.

---

## 16. Build Validation Checklist

Every completion report must include: files changed, what was implemented, what was intentionally skipped, validation commands run, browser/manual checks, known risks/follow-ups, and confirmation that no unrelated files changed.

```bash
npm run lint
npm run typecheck
npm run test
npx prisma validate
npm run build
```

---

## 17. Technical Non-Goals

Do not build in MVP: microservices, a background worker, real-time collaboration, native mobile, external calendar sync, AI classification, time-tracking reports, resource/inventory management, billing, team workload dashboards.

Complex block systems remain out of scope. The Tiptap Notes editor provides basic Markdown-backed formatting only; slash commands, drag handles, collaboration, AI controls, and Notion-style blocks are non-goals.
