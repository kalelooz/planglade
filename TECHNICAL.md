# PlanGlade — Technical Reference

**Status:** v6.1 — consolidated, audited, and corrected after external audit + Architect/Codex exports + public `main` web validation on 2026-07-01
**Supersedes:** Technical Reference v2
**Companion documents:** `PRODUCT.md` (product/design truth), `EXECUTION.md` (roadmap/tickets/current state), `AGENT-BOOTSTRAP.md` (session-start prompt)

This document is the architecture, security, and deployment **target**, per the maintainer's explicit direction: when live code disagrees with this document, the document stays as written and the gap is tracked as debt — not silently absorbed by rewriting the spec to match whatever shipped. Exception: where code has already delivered exactly what this document specifies (e.g. Docker), the document's job is just to stop being stale about it.

**SaaS/public launch note:** operational business choices, website copy, demo plan, pricing direction, analytics/tooling picks, and hosted-cloud sequencing live in `SAAS-LAUNCH.md`. This file only owns the technical truth and drift.

---

## 0. Read this first — repo state as of 2026-07-01

Two branches, materially different:

| | `main` | `frontend-redesign-exploration` |
|---|---|---|
| Role | Public export / curated snapshot | Actual active development |
| Commits | 14 visible public commits as of this validation (`9681a60` latest) | ~235 ahead of main's divergence point |
| Docker | **Present** (Dockerfile, docker-compose.yml, merged via PR #15) | Absent |
| Test suite | Not independently verified in this audit | **282/283 passing** — 1 known failure, see below |
| Upstream | N/A (canonical) | **Deleted** — orphaned branch |
| Known issues | Public Docker docs are now updated on `main`; public issue/PR UI may disagree about #9 even though the security-contact commit is on `main` | `docs/ACTIVE_PLAN.md` uncommitted with contradictory Docker status entries |

**Before anything else in this document matters:** reconcile these two histories. An orphaned upstream plus a red, unmerged, heavily-diverged branch is an operational risk independent of any doc/code drift below. This isn't a "someday" item — see `EXECUTION.md §7`.

**Known failing test on `frontend-redesign-exploration`:** Codex reported `tests/readme-mvp-scope.test.ts`, assertion `README-TRIM-1`, expecting the literal string `**Available / MVP**` in `README.md`. Do **not** assume that branch-local contract applies to public `main`: public `main` currently checks the newer `**Available Today**` / `**Next**` / `**Later**` roadmap wording. Any README change must be made against the branch actually being tested, with the test updated deliberately if the wording standard changes.

---

## 1. Architecture Decision

Keep PlanGlade as **one full-stack Next.js application**. Do not split into microservices.

**Rationale:** the MVP needs product speed, not distributed-system complexity. Next.js App Router handles pages, route handlers, server actions, and server components in one place. Self-hosting stays simple with one app and one database. No current scaling pressure justifies services, queues, or Kubernetes.

```text
Browser
  → Next.js App Router
      → Server Components
      → Server Actions / Route Handlers
      → Central AuthN/AuthZ Layer (mode: dev / firebase / nextauth)
      → Prisma
      → Database
```

---

## 2. Stack — Target vs. Confirmed Reality

| Layer | Target (spec) | Confirmed installed (frontend-redesign-exploration, 2026-07-01) |
|---|---|---|
| Framework | Next.js 14+ App Router | `next@16.2.6` |
| Language | TypeScript strict | `typescript@5.9.3` |
| Styling | Tailwind CSS | `tailwindcss@4.1.18` (v4, via `@tailwindcss/postcss`) |
| UI | shadcn/ui + Radix | Full Radix primitive set + `radix-ui@1.4.3` |
| Icons | Lucide React | `lucide-react@0.525.0` |
| ORM | Prisma | `prisma@6.19.3` / `@prisma/client@6.19.3` |
| Database | PostgreSQL production, SQLite dev | **SQLite only** — no Postgres datasource configured anywhere |
| Auth | Auth.js / NextAuth **v5** | `next-auth@4.24.14` — **v4** |
| Validation | Zod | `zod@4.3.5` |
| Forms | React Hook Form | `react-hook-form@7.71.1` |
| Testing | Vitest + Playwright | **Node's built-in test runner** via `tsx` — no Vitest, no Playwright in CI |
| Deployment | Docker + docker-compose | Present on `main` only (see §0) |

**Confirmed but never specified anywhere in `PRODUCT.md` or this document:**

| Package | Apparent purpose | Status |
|---|---|---|
| `firebase` / `firebase-admin` | Auth + storage, mode-selectable alongside NextAuth | Deliberate — see §3.2 |
| `@mdxeditor/editor` | Rich markdown/MDX editor | **Directly contradicts §16 Technical Non-Goals** ("no complex rich-text blocks") — needs a decision: keep and revise the non-goal, or confirm unused and remove |
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
| Auth library | NextAuth v5 | v4.24.14 confirmed installed | Debt — see `EXECUTION.md` backlog. Note: v5 has breaking API changes from v4; this is a real migration, not a version bump |
| Production database | PostgreSQL | SQLite only, no Postgres path exists | Debt |
| Test runner | Vitest + Playwright | Node's built-in runner confirmed as the actual CI runner; Playwright exists only as a transitive lockfile reference, not in use | Debt, **or** formally adopt Node's runner as the new target — 283 tests already exist against it, so migration has real cost. This is worth an explicit maintainer call rather than defaulting to "migrate" |
| Docker self-host | Docker + compose | **Shipped on `main`** (PR #15/#6). Absent on the active dev branch | Not debt — this is a branch-reconciliation problem, not a missing-feature problem. See `EXECUTION.md §7` |

### 3.2 Firebase — ratified, not drift

Confirmed as a deliberate three-way auth mode switch (`dev` / `firebase` / `nextauth`), selected via `PLANGLADE_AUTH_MODE`, with matching client/server env validation and independent storage-provider selection. This is documented product architecture as of this revision, not an accident:

- Firebase and NextAuth are **mode-selected, not simultaneous** for authentication.
- Storage provider (local vs. Firebase) is selected independently of auth mode.
- On the checked-out branch, local storage is rejected in production; on `main`, production local storage is now allowed given a signing secret.
- **Open question the maintainer should still answer:** does permanent dual-mode auth serve the AGPL/self-host positioning, or does leaning on Firebase (a proprietary Google service) as a first-class path undercut it? This is a positioning call, not a technical one — see `EXECUTION.md`'s Open Decisions Log.

### 3.3 Backend-complete, UI-dormant — lower urgency than previously flagged

Two subsystems exist, are well-tested, and are **not reachable through the normal product UI today**:

- **Attachments:** local + Firebase providers fully implemented (signed URLs, HMAC signing, path-traversal protection, MIME/size validation). No frontend component calls the upload/list/download endpoints. Project feature flag defaults to `false`.
- **Workspace invites & member management:** creation, resend, revoke, expiry, role/domain policy, email delivery (console/Resend) are all implemented and tested. Only **invite acceptance** is reachable via `/login?inviteToken=...`. No send-invite, policy, or member-admin UI exists. `/team` explicitly redirects to `/app`.

This reads as backend-built-ahead-of-UI, correctly gated from users — reasonable sequencing, not a broken promise. The real decision is whether to build the UI now (pulling Phase 4 collaboration forward) or leave both dormant until their originally planned phase. Either is defensible; it just needs to be a decision, not silence.

### 3.4 Legacy naming cleanup — in progress, not a surprise

`PLANGLADE_*` environment variables fall back to legacy `FLOWBOARD_*` equivalents throughout the codebase (auth, storage, email, workspace scaffolding). Commits and a dedicated test (`public-legacy-naming-cleanup.test.ts`) confirm this is active, tracked cleanup from the pre-rename codebase, not newly discovered drift.

### 3.5 Small, concrete, low-effort fixes

- **GitHub OAuth is dead code in practice.** `GITHUB_ID`/`GITHUB_SECRET` are accepted server-side and would enable the provider, but the login page only renders a Google button and calls `signIn("google")`. Either wire up the UI or drop the server-side config — leaving it half-configured is the worst of both options.
- `npm ls` reports one extraneous package: `@emnapi/runtime@1.10.0`. Harmless, but worth a clean-up pass.

---

## 4. Core Data Model

The schema below is the model set this document can currently confirm field-level detail for. It is **known to be incomplete**: Codex's audit surfaced Prisma model names — `Attachment`, `WorkspaceInvite`, `WorkspaceInvitePolicy`, `Activity`, `Comment`, `Notification`, `SavedView`, and work-item relation models — that exist in the live schema but were not dumped in full. Do not treat the block below as a complete picture of the database until someone pulls the actual current `prisma/schema.prisma` and reconciles it here. That's a concrete, scoped follow-up, not a rhetorical caveat.

```prisma
model User {
  id          String   @id @default(cuid())
  name        String?
  email       String   @unique
  image       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  memberships WorkspaceMember[]
  tasks        Task[]  @relation("TaskAssignee")
  notes        Note[]
}

model Workspace {
  id         String   @id @default(cuid())
  name       String
  slug       String   @unique
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  members    WorkspaceMember[]
  projects   Project[]
  tasks      Task[]
  notes      Note[]
  docs       Doc[]
  inboxItems InboxItem[]
  labels     Label[]
}

model WorkspaceMember {
  id          String   @id @default(cuid())
  role        String   @default("owner") // owner, admin, member
  userId      String
  workspaceId String
  joinedAt    DateTime @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@unique([userId, workspaceId])
  @@index([workspaceId])
}

model Project {
  id          String   @id @default(cuid())
  name        String
  description String?
  status      String   @default("active") // active, paused, done, archived
  color       String?
  startDate   DateTime?
  dueDate     DateTime?
  workspaceId String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tasks       Task[]
  notes       Note[]
  docs        Doc[]

  @@index([workspaceId])
  @@index([workspaceId, status])
}

model Task {
  id          String   @id @default(cuid())
  title       String
  description String?
  status      String   @default("todo") // backlog, todo, in_progress, blocked, done, cancelled
  priority    String   @default("medium") // low, medium, high, urgent
  type        String   @default("task") // task, subtask, milestone
  startDate   DateTime?
  dueDate     DateTime?
  completedAt DateTime?
  workspaceId String
  projectId   String?
  parentId    String?
  assigneeId  String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  parent      Task?     @relation("Subtasks", fields: [parentId], references: [id], onDelete: SetNull)
  subtasks    Task[]    @relation("Subtasks")
  assignee    User?     @relation("TaskAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  labels      TaskLabel[]
  blocks      TaskDependency[] @relation("TaskBlocks")
  blockedBy   TaskDependency[] @relation("TaskBlockedBy")

  @@index([workspaceId])
  @@index([workspaceId, status])
  @@index([workspaceId, dueDate])
  @@index([workspaceId, projectId])
}

model TaskDependency {
  id            String   @id @default(cuid())
  blockerTaskId String
  blockedTaskId String
  type          String   @default("finish_to_start")
  createdAt     DateTime @default(now())

  blockerTask   Task     @relation("TaskBlocks", fields: [blockerTaskId], references: [id], onDelete: Cascade)
  blockedTask   Task     @relation("TaskBlockedBy", fields: [blockedTaskId], references: [id], onDelete: Cascade)

  @@unique([blockerTaskId, blockedTaskId])
}

model InboxItem {
  id              String   @id @default(cuid())
  content         String
  status          String   @default("pending") // pending, converted, dismissed
  source          String   @default("manual") // manual, note, calendar, import
  workspaceId     String
  convertedTaskId String?
  convertedNoteId String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace       Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, status])
}

model Note {
  id          String   @id @default(cuid())
  title       String
  content     String?
  workspaceId String
  projectId   String?
  authorId    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  author      User?     @relation(fields: [authorId], references: [id], onDelete: SetNull)

  @@index([workspaceId])
  @@index([workspaceId, projectId])
}

model Doc {
  id          String   @id @default(cuid())
  title       String
  content     String?
  status      String   @default("active") // active, archived
  workspaceId String
  projectId   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
  @@index([projectId, status])
}

model Label {
  id          String   @id @default(cuid())
  name        String
  color       String
  workspaceId String

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  tasks       TaskLabel[]

  @@unique([workspaceId, name])
}

model TaskLabel {
  taskId  String
  labelId String

  task    Task  @relation(fields: [taskId], references: [id], onDelete: Cascade)
  label   Label @relation(fields: [labelId], references: [id], onDelete: Cascade)

  @@id([taskId, labelId])
}
```

**Confirmed to exist, not yet documented above (pull full definitions before treating this section as complete):** `Attachment`, `WorkspaceInvite`, `WorkspaceInvitePolicy`, `Activity`, `Comment`, `Notification`, `SavedView`, work-item relation/hierarchy models. `PRODUCT.md §9` should gain purpose-level entries for each once fields are confirmed.

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

**Confirmed session resolution (three modes, mode-selected):**
- `dev`: upserts a fixed development user, creates/updates a configured dev workspace, ensures OWNER membership.
- `firebase`: requires a Bearer token or equivalent header, verified via Firebase Admin, then resolves DB user/membership.
- `nextauth`: calls `getServerSession`, requires an email, resolves DB user/membership.
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

---

## 8. Notes and Docs Rule

Notes and docs are separate by product meaning. Notes are freeform, global or project-linked. Docs are structured, always project-linked.

**Update:** the Project Detail UI no longer surfaces a Docs tab — Notes now carries project context in the primary UI, and Docs is an advanced, default-off project feature flag rather than a core MVP tab. The backend/data model for Docs is unchanged; only its default visibility changed. Reflect this in `PRODUCT.md §10`.

---

## 9. Self-Hosting Baseline

**Status as of 2026-07-01: present on public `main`, absent on active `frontend-redesign-exploration`; partial and branch-inconsistent, not "missing."**

Docker packaging exists and is merged on `main` (PR #15, closing issue #6): multi-stage Node 22 Alpine `Dockerfile`, `docker-compose.yml`, non-root user, standalone Next.js runner, persistent SQLite and local-attachment volumes, health check, NextAuth as default with Firebase optional, and production local storage now permitted given a signing secret.

**What's not solved even on `main`:** PostgreSQL remains a separate, unimplemented provider migration — the shipped baseline still tracks SQLite. HTTPS/reverse proxy, monitoring, and automated backups are explicitly not bundled.

**Current public-`main` doc status:** `README.md` and `docs/SELF_HOSTING.md` now acknowledge the early Docker baseline. Treat older claims that these docs still say Docker is unsupported as stale audit residue.

**Still broken right now:** none of the Docker baseline exists on the active `frontend-redesign-exploration` branch. See `EXECUTION.md §7` for reconciliation.

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
*(Reference baseline. The actually-shipped `main` compose file uses SQLite + volume-mounted storage rather than the Postgres service shown here — reconcile this block against the real file once branches are merged, rather than treating this as current truth.)*

---

## 10. Testing Requirements

```text
tests/
  unit/
  integration/
  e2e/
```

**Confirmed current reality:** 49 test files, 283 tests, 282 passing, one failing (`readme-mvp-scope.test.ts`, see §0). Runner is Node's built-in test runner via `tsx`, not Vitest/Playwright. No Jest/Vitest config exists; Playwright is present only as a transitive lockfile entry, not wired into CI. No line/branch coverage instrumentation exists.

**Honest coverage read (from direct repo audit):** strongest around workspace authorization denial paths, invite/member guards, import/export, and task relations/hierarchy. Weakest around real Firebase/OAuth callbacks, Firebase Storage operations, Resend network delivery, and actual browser upload/download flows — none of which are integration-tested against real services. Of the 49 files, 22 are primarily source-text assertions rather than rendered component or interaction tests; treat "UI test" coverage claims accordingly.

**Minimum layers before public MVP (target, unchanged):**
- *Unit:* validators, task date logic, project progress logic, note checklist extraction.
- *Integration:* unauthenticated API denied, cross-workspace reads/writes denied, inbox conversion creates a task and marks the item converted, calendar query returns only workspace tasks, docs are project/workspace scoped.
- *E2E:* sign-in dev flow, create workspace, capture inbox item, convert to task, create project, add task to project, create note/doc, calendar shows task, navigation works without console errors.

---

## 11. CI/CD

**Confirmed current pipeline:** `npm ci` → `npm run check:readme-sync` → `npm run db:generate` → `npm run ci:check` → `npm run test` → `npm audit --omit=dev --audit-level=critical`.

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

~~complex rich-text blocks~~ — **contradicted by `@mdxeditor/editor` being installed.** Either this non-goal needs revising because a rich editor was deliberately adopted, or the dependency is unused and should be removed. Resolve before restating this list as accurate.
