# PlanGlade — Execution Roadmap & Agent Workflow

**Status:** v6.3 - consolidated, audited, corrected after resource mismatch audit, updated for SaaS launch planning, and aligned with repo-level `AGENTS.md`
**Supersedes:** Build Roadmap and Codex Tickets v1, the evergreen portions of Codex Greenfield Start Prompt v1
**Companion documents:** `PRODUCT.md` (product/design truth), `TECHNICAL.md` (architecture/security/drift), `AGENTS.md` (repo-level agent rules), `AGENT-BOOTSTRAP.md` (session-start prompt)

---

## 0. Relationship to `docs/ACTIVE_PLAN.md`

The repository already contains `docs/ACTIVE_PLAN.md`, used as a working, commit-level status file. Don't compete with it. The split going forward:

- **`docs/ACTIVE_PLAN.md`** (in-repo) — tactical, session-to-session status. Updated by whoever's actually coding, every session. Git-tracked.
- **§7 of this document** — milestone/phase-level status. Updated by the Architect when a phase actually closes, not every session.

If the two ever disagree, `docs/ACTIVE_PLAN.md` wins on tactical detail; this document wins on phase/scope framing. Reconcile, don't duplicate.

---

## 1. Build Strategy and Phase Overview

Build in slices that each leave the app better than before.

| Phase | Name | Goal | Public value |
|---|---|---|---|
| 0 | Foundation | App, auth, workspace, DB, shell | Can log in and use app shell |
| 1 | Solo Core | Inbox, tasks, projects, notes, calendar | Useful for solo users |
| 2 | Public MVP | Docs, landing, self-host, OSS docs | Can publish honestly |
| 3 | Planning Power | Timeline, dependencies, recurring tasks | Addresses strongest PM gap |
| 4 | Sharing + Mobile | PWA polish, invites, shared workspaces | Families/small teams |
| 5 | Optional Power | Time tracking, reports, importers | Freelancer/team expansion |

**Fast-track goal:** publish an honest public MVP proving capture → task → project → note/doc → calendar, with a calm UI and credible self-hosting.

**Reality check as of this revision:** Phase 4 backend work (invites, member management) and Phase 2 self-host work (Docker) are both already substantially built — see §5 and §7. The phase table above describes intended *sequence and priority*, not a strict gate on what code exists. Treat it as prioritization, not prophecy.

---

## 2. Roles — Architect and Agent

**Architect (ChatGPT project):** owns product direction, scope, and ticket authorship. Not the implementer. Has decision-history/memory of this workstream and public web access to the repo, but **no live local repo access, no ability to run code or tests.**

**Agent / Doer (Codex):** implements exactly the scoped ticket given to it, protects existing work, reports clearly. Not the architect — does not change product direction, does not do unrelated cleanup, does not add dependencies without justification.

**The gap this caused:** because the Architect can't independently verify the live repo, and no process existed to write real-time decisions back into the planning docs, product and technical decisions were made in conversation and communicated to Codex via tickets, but never reconciled back into a "final" doc — producing the drift catalogued in `TECHNICAL.md §3`. Going forward: any decision made in an Architect/user conversation that changes scope, stack, or product surface gets a one-line entry in §8's decision log **in the same session it's made**, not reconstructed later.

---

## 3. Build Rules (for the Agent)

`AGENTS.md` carries the always-on repo rules and should be loaded automatically by Codex. `AGENT-BOOTSTRAP.md` is only the explicit runtime prompt for sessions or tools that need one.

Before coding: restate the task, identify ambiguity, list exact files expected to change.

During coding: one ticket only. No unrelated cleanup. No broad refactors. No dependency additions unless justified. Do not change product direction.

Skills/plugins: let Codex use relevant installed skills automatically. Ticket prompts may include a `Skills` field with suggested or required skills. If a listed skill is unavailable, continue manually using the same checks and report that the skill was not installed. Do not install third-party skill packs or commit private workflow skills unless the maintainer explicitly asks.

After coding: run relevant validation, report files changed, report what was built, report what was skipped, report risks/follow-ups, report validation commands and results.

### Completion Report Format

```md
# Completion Report — [TASK NAME]

## Summary
[What was completed]

## Files Changed
| File | Status | Notes |
|---|---|---|

## What Changed
[Bullets]

## Validation
[Commands/checks run and result]

## Manual Smoke Test
[Browser/manual checks]

## Skipped / Deferred
[Anything not done and why]

## Risks / Follow-ups
[Any risks or next tickets]
```

---

## 4. Ticket History (Reconstructed)

Reconstructed from planning docs, project memory, public PR/issue history, and repo commit logs. This is not guaranteed complete — private Codex session history beyond what's reflected in commits/docs isn't fully recoverable. Treat gaps as gaps, not as "nothing happened."

### 4.1 Original planned sequence (Build Roadmap v1)

`SETUP-001` Initialize app · `SETUP-002` Prisma schema/DB · `AUTH-001` Auth and onboarding · `PERM-001` Permission helpers/tests · `SHELL-001` App shell/nav/tokens · `INBOX-001` Inbox capture/conversion · `TASKS-001` Task list CRUD/filtering · `PROJECTS-001` Projects list · `PROJECTS-002` Project detail overview · `NOTES-001` Notes core · `CALENDAR-001` Calendar month over tasks · `DOCS-001` Project docs · `HOME-001` Home dashboard · `TASKS-002` Board view toggle · `NOTES-002` Note-to-task extraction · `SETTINGS-001` Data export · `SELFHOST-001` Docker/self-host baseline · `LANDING-001` Landing page · `OSS-001` Public repo docs · `SECURITY-001` Pre-public security baseline · `TIMELINE-001` Timeline v1 · `DEPENDENCY-001` Dependencies · `RECURRENCE-001` Recurring tasks · `CALENDAR-002` Week view/time blocks · `PWA-001` Responsive/PWA polish · `COLLAB-001` Invites and roles · `SHARED-001` Shared/family workspace polish · `TIME-001` Time tracking · `IMPORT-001` Guided import · `REPORTS-001` Basic reports.

### 4.2 Baseline/alignment and style tickets (not in original roadmap)

`BASELINE-001` — legacy FlowBoard-era baseline fixes (status icon prop mismatch, `/report` Suspense issue). `ALIGN-001` — route/brand alignment (`/` landing, `/app` Home, `/onboarding` fixed, redirects for advanced routes). `SOURCE-STYLE-001` — replaced nature/moss visual direction with neutral minimalist system. `CAPTURE-001` / `CAPTURE-002` — made shell and Home quick capture server-backed, removed spoofable client-provided user ID. `BUILD-AUTH-001` — fixed onboarding/build/auth-branding issues. `ROUTES-ALIGN-001` — canonicalized public/authenticated routing. `DATA-FIX-001` (Prisma indexes — completion unconfirmed). `LANDING-FIX-001` (landing overclaim fixes — completion unconfirmed).

### 4.3 Inbox / Tasks / Project Detail / Calendar UI tickets

`INBOX-CELL-INTERACTION-005` — full-cell clickable date/priority controls. Inbox grid column alignment + bulk send/dismiss. Tasks readability revert (rolled back an experimental layout). Completed-today retention removed after rejection. `PROJECT-DETAIL-UX-003` — widened Project Detail, **removed Docs tab in favor of Notes as project context, removed board toggle**. Landing copy cleanup — "Project Docs" language replaced with "project notes/context." `CONNECTIONS-GRAPH-ORIENTATION-013` — Connections graph/minimap (later gated, non-MVP). `CALENDAR-FINAL-ACCEPTANCE-023` — final calendar visual pass (visible add buttons, no color-wash/chip-soup/overflow). Settings priority display style — Text/Dots/Badge/Arrows, applied across Home/Tasks/Board/Drawer/Project Detail. `SETTINGS-APPEARANCE-PREVIEW-POLISH-001` — cleaned appearance preview. `HOME-POLISH-001` — tightened Home, server-backed capture, Inbox rows framed as triage not completion. Home task-row interaction fix — removed direct-complete affordance from Home rows. Demo-data cleanup — believable task titles/priorities for public screenshots.

### 4.4 Landing / public presentation tickets

`PREVIEW-002` — rebuilt landing product preview to match real Home screen. `LOGO-001` — logo exploration (not final). Public screenshot preparation. `PUBLIC-READY-002` — public readiness cleanup (license, security, contributing, templates, Dependabot, config cleanup, lockfile cleanup, screenshots). `PUBLIC-READY-003` — planned follow-up pass (completion state unconfirmed). `LEGAL-001` — added AGPL-3.0, aligned README/self-host claims. `PUBLIC-MAINTAINER-START-008` — reviewed Dependabot PRs, created starter issues (Docker, font warning, contributor guide, security contact, README gallery). Public repo cleanup — sanitized export, single main branch, excluded internal AI/workflow/audit files.

### 4.5 README history specifically

Issue #10 (README gallery for visual learners) — closed. PR #12 "Improve README visual gallery" — closed unmerged. PR #13 "Rewrite README gallery cleanly" — closed unmerged. **PR #14 "Add README screenshot gallery" — merged 2026-06-30, captions only, explicitly scoped to avoid a broader README rewrite.** Read this history as a standing preference for restraint over the richer visual treatments (Mermaid, badges, graphs) that were tried twice and not kept.

### 4.6 Public GitHub maintenance (issues/PRs, confirmed via public repo)

5 Dependabot PRs merged 2026-06-30 (react-hook-form, tailwind-merge, react/@types-react, @tanstack/react-query, @radix-ui/react-separator). Issue #6 "Docker self-host setup" → **closed 2026-07-01** via PR #15 (multi-stage image, compose, persistent SQLite, migrations, health check, docs). Issue #7 "Next.js font warning" → closed via PR #11 (merged). Issue #8 "First-time contributor guide" → **still open.** Issue #9 / PR #16 "Dedicated security reporting contact" → implementation commit `9681a60` is on public `main` and `SECURITY.md` now contains private-reporting guidance; the user's API/merge report says #9 is closed and Private Vulnerability Reporting is enabled, while unauthenticated GitHub pages may still display #9/#16 as open. Treat the security-contact implementation as landed; verify the issue UI from the owner account if it still appears open.

### 4.7 SaaS/public launch decisions - updated 2026-07-06

Current status: the PlanGlade public website is live on Netlify. `WEBSITE-LIVE-001` is complete and should not be suggested as the next implementation task.

`WEBSITE-POST-LIVE-AUDIT-001` is complete. PR #27 was squash-merged and the production Netlify deployment was verified on 2026-07-07. Public copy should stay short and human: **Self-host now. Cloud soon. Try demo. Demo mode. Changes are disabled. Free to self-host. Paid cloud coming.** Avoid long internal-risk wording on public pages.

Demo decision: public demo is read-only. Visitors can browse, open, filter, and navigate. They cannot create, edit, delete, upload, invite, export, change settings, trigger emails, or change workspace data. Blocked actions use: **Demo mode — changes are disabled.**

New companion file: `SAAS-LAUNCH.md`. It owns public website launch, cloud sequencing, demo plan, pricing direction, open-source/private SaaS boundary, and external tooling choices.

Do not open another website/demo ticket unless production verification finds a real issue.

### 4.7 Built but no known originating ticket

Firebase auth/storage/App Hosting · NextAuth v4 (vs. planned v5) · local dev auth mode · file attachments + signed local URLs · Firebase Storage attachment support · workspace invites · invite policy · email invite delivery (Resend) · invite expiry maintenance job · guarded import flow · Activity/Comment/Notification/SavedView/work-item-relation schema models. Treat these as implemented code lacking planning provenance — real, tested, but nobody wrote down when or why they were scoped.

---

## 5. Implementation Debt Backlog

Generated from `TECHNICAL.md §3`. Ticket IDs continue the project's existing convention.

| ID | Title | Why | Priority |
|---|---|---|---|
| `DOCS-TRUTH-RESOURCE-002` | Replace old resource files with v6.2 pack | Sync Architect/Codex/library sources before further implementation | **Highest — do first** |
| `RESOURCE-MISMATCH-AUDIT-001` | Audit live repo against v6.2 resources | Create factual mismatch report before broad fixes | **Highest — do after resource replacement** |
| `WEBSITE-LIVE-001` | Launch PlanGlade website fast | Website is live on Netlify | **Done - no longer pending** |
| `WEBSITE-POST-LIVE-AUDIT-001` | Verify live Netlify website after launch | PR #27 merged; production deployment verified 2026-07-07 | **Done** |
| `DEMO-READONLY-001` | Build/readiness-check read-only public demo | No login, no writes, broad sample data, server-side mutation blocking | High - only if post-live audit finds gaps |
| `SAAS-FIREBASE-EXTRACT-001` | Move Firebase auth/storage adapters into the private hosted SaaS codebase | Firebase is SaaS-only (`FIREBASE-SAAS-BOUNDARY-001`); the in-repo Firebase code is temporary extraction debt. Full manifest in `docs/FIREBASE_EXTRACTION_PLAN.md`. Blocked on a private SaaS destination existing. | Medium |
| `DEBT-003` | Auth.js/NextAuth v4 → v5 upgrade, or formally accept v4 as target | Real breaking-change migration, not a version bump — needs scoping before it's picked up casually | Medium |
| `DEBT-004` | Postgres production datasource + migration path | Spec says production Postgres; only SQLite exists | Medium |
| `DEBT-005` | Test runner decision: adopt Node's built-in runner as target, or migrate 327 tests to Vitest/Playwright | Real migration cost either way; needs an explicit call, not a default | Medium |
| `DEBT-008` | GitHub OAuth: wire up UI or remove server-side config | Currently half-configured, unreachable dead path | Low |
| `DEBT-009` | Resolve Notes editor vs. "no complex rich-text blocks" non-goal | Resolved by `NOTES-TIPTAP-001`: Markdown-backed Tiptap editor, not a block system | **Done** |
| `DEBT-010` | Verify necessity/legitimacy of `z-ai-web-dev-sdk` and `next-intl` | Unexplained dependencies with no corresponding product decision | Low |
| `DEBT-011` | Clean up extraneous `@emnapi/runtime` npm entry | Minor hygiene | Low |
| `DEBT-012` | Complete legacy `FLOWBOARD_*` → `PLANGLADE_*` env var cleanup | Already in progress; finish it | Low |

---

## 6. Open Decisions Log

Unlike the debt backlog above, these aren't implementation tasks — they're calls only the maintainer can make. Each needs one recorded line here the moment it's decided, so this stops happening.

1. **Auth strategy:** **Decided (`FIREBASE-SAAS-BOUNDARY-001`).** Public self-host auth is independent of Firebase — NextAuth (or `dev` for local development) is the public path. Firebase auth is private hosted SaaS infrastructure.
2. **Database:** **Decision for hosted cloud:** Postgres is required before paid cloud. SQLite may remain local/dev/early self-host until explicitly migrated.
3. **Firebase positioning:** **Decided (`FIREBASE-SAAS-BOUNDARY-001`, 2026-07-09).** Firebase is SaaS-only. The public self-host product must remain independently usable without any Firebase account, credentials, or setup. The in-repo Firebase adapter code is temporary extraction debt tracked as `SAAS-FIREBASE-EXTRACT-001`.
4. **Attachments:** build UI to activate the existing backend, or leave it dormant until a later phase?
5. **Collaboration/invites:** same question — activate now, or hold for Phase 4 as originally planned?
6. **Test runner:** Node's built-in runner as the new standard, or migrate to Vitest/Playwright?
7. **Docs vs. Notes:** confirmed in `PRODUCT.md`: Docs is now an advanced/default-off feature rather than a core MVP tab.
8. **Public history transparency:** should the README state plainly that public commit history starts from a curated export?
9. **i18n scope:** is `next-intl` a real planned feature, or premature scaffolding to strip out?
10. **Reporting scope:** is `recharts` tied to a real near-term feature, or the same situation?
11. **Rich text:** decided by `NOTES-TIPTAP-001` — Tiptap is the Markdown-backed Notes editor; MDXEditor is removed and complex block-system features remain out of scope.

---

## 7. Self-Hosting / Docker Status

The early Docker baseline exists in the checked-out branch:

1. `Dockerfile` and `docker-compose.yml` are present.
2. The baseline uses a standalone app image, a migration step, persistent SQLite, persistent local attachments, a health check, and NextAuth as the public self-host default. (A Firebase Storage provider exists in-repo but is SaaS-only — see `TECHNICAL.md §3.2` — and is not part of the Docker self-host path.)
3. `README.md` and `docs/SELF_HOSTING.md` describe the early Docker baseline.
4. Postgres remains unimplemented — the shipped baseline still runs SQLite.

**Sequence:** keep the current Docker baseline intact → launch the public website honestly → only then take on Postgres (`DEBT-004`) as a separate, later ticket.

---

## 8. Current State

*(Milestone-level only — see §0 for how this relates to `docs/ACTIVE_PLAN.md`. Update this section in place; do not copy it into other documents.)*

**As of 2026-07-03:**

- Current checked-out branch is `codex/ci-actions-node24`.
- Current validation: `npm test` passes **327/327**.
- Docker baseline files are present in this branch.
- Recent work on the active branch has focused on: public-facing UI polish (Home, Tasks, Inbox), Project Detail redesign (Concept 2, removing the Docs tab), Calendar visual acceptance, Settings appearance/priority display, and environment-variable naming cleanup.
- Public issue #8 (contributor guide) remains open. Security contact work is implemented on `main` via `9681a60`; if #9 still appears open in GitHub UI, verify/close it from the owner account rather than treating the code/doc work as missing.
- No planning document had been updated to reflect Firebase, attachments, invites, or Docker until this revision.

- SaaS/public launch direction is now decided: website is live on Netlify, self-host now, cloud soon, read-only demo, no checkout until cloud is real.
- Public copy must be concise and human; avoid long internal-risk wording on marketing pages.
- Post-live verification should not wait for Postgres, billing, or production cloud.
- `RESOURCE-MISMATCH-AUDIT-001` was run on 2026-07-06. Its website follow-up, `WEBSITE-POST-LIVE-AUDIT-001`, was completed through PR #27 and verified in production on 2026-07-07.

**Decision log:**
- 2026-07-09 — `FIREBASE-SAAS-BOUNDARY-001`: Firebase is reserved for the private hosted SaaS/cloud deployment and is not part of the public open-source self-host product. Public self-host defaults changed to `nextauth` + local storage so it requires no Firebase account, variables, credentials, or services. The in-repo Firebase adapter code remains as temporary extraction debt behind an explicit opt-in; physical removal is tracked as `SAAS-FIREBASE-EXTRACT-001` (manifest in `docs/FIREBASE_EXTRACTION_PLAN.md`), blocked on a private SaaS destination existing. Resolves Open Decisions #1 and #3.

---

## 9. Public MVP Exit Criteria

Ready for honest public alpha when: user can sign in · create workspace · capture an inbox item · convert it to a task · create a project · attach a task to a project · create a note/doc for a project · calendar shows task due dates · Settings can export data · landing page does not overclaim · self-host docs are accurate · CI passes · basic security audit passes · no fake features are visible.

**Current blockers against this list:** production-facing hardening remains intentionally limited for the early self-host baseline.

---


## 10. Immediate Tickets

### DOCS-TRUTH-RESOURCE-002 — Replace Resource Pack

Goal: replace the old PlanGlade project-resource/source files with the v6.2 pack: `PRODUCT.md`, `TECHNICAL.md`, `EXECUTION.md`, `SAAS-LAUNCH.md`, and `AGENT-BOOTSTRAP.md`.

Rules: docs/resource files only; no app code; remove or mark superseded old source packs; do not preserve duplicate truth sources.

Full prompt file: `CODEX-PROMPT-RESOURCE-REPLACE-001.md`.

### RESOURCE-MISMATCH-AUDIT-001 — Audit Repo Against v6.2 Resources

Goal: compare the actual repository against the v6.2 resource pack and produce a factual mismatch report before planning further implementation.

Rules: audit only unless explicitly allowed to make tiny doc fixes; no product code changes; report exact file evidence and validation status.

Full prompt file: `CODEX-PROMPT-RESOURCE-MISMATCH-AUDIT-001.md`.

### WEBSITE-POST-LIVE-AUDIT-001 - Post-Live Website Audit

Status: **Completed.** PR #27 was squash-merged and the production Netlify deployment was verified on 2026-07-07.

Goal: verify the live Netlify website after launch.

Rules: audit and small docs/copy fixes only; no billing, no checkout, no cloud accounts, no app feature work, no broad README rewrite.

Acceptance: homepage loads, GitHub/self-host/demo links work, `/demo` is read-only, `/app` is not exposed as a fake public demo, public docs do not say the website/demo are still pending, and no fake cloud/billing claims exist.

### WEBSITE-LIVE-001 - Launch PlanGlade Website

Status: **Completed.** The public website is live on Netlify. Do not run this as the next implementation task.

Goal: make `planglade.com` ready to go live with short human copy: **Self-host now. Cloud soon. Try demo.**

Rules: no billing, no checkout, no cloud accounts, no writable public demo, no fake claims.

Full task details live in `SAAS-LAUNCH.md §14`.

## 11. Ticket Prompt Template

```text
Task Name:
Goal:
Context:
Skills:
Allowed Areas:
Do-Not-Touch:
Requirements:
Acceptance Criteria:
Design Reference:
Validation Steps:
Completion Report Required:
```

Skills field: optional by default. Use suggested skills for workflow helpers, and reserve required skills for risky work such as auth, workspace data, API routes, storage, public copy, or demo write-blocking.

Rules: one ticket only · exact files/areas · no unrelated cleanup · report skipped items · run validation.
