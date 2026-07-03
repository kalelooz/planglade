# PlanGlade — Execution Roadmap & Agent Workflow

**Status:** v6.1 — consolidated, audited, and corrected after external audit + public `main` validation
**Supersedes:** Build Roadmap and Codex Tickets v1, the evergreen portions of Codex Greenfield Start Prompt v1
**Companion documents:** `PRODUCT.md` (product/design truth), `TECHNICAL.md` (architecture/security/drift), `AGENT-BOOTSTRAP.md` (session-start prompt)

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

Before coding: restate the task, identify ambiguity, list exact files expected to change.

During coding: one ticket only. No unrelated cleanup. No broad refactors. No dependency additions unless justified. Do not change product direction.

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

### 4.7 SaaS/public launch decisions — 2026-07-03

Maintainer decision: first priority is getting the website live fast, not implementing cloud, billing, or demo. Public copy should be short and human: **Self-host now. Cloud soon. Demo soon. Free to self-host. Paid cloud coming.** Avoid long internal-risk wording on public pages.

New companion file: `SAAS-LAUNCH.md`. It owns public website launch, cloud sequencing, demo plan, pricing direction, open-source/private SaaS boundary, and external tooling choices.

First implementation task after replacing resources: `WEBSITE-LIVE-001`. Next planning task after that: `RESOURCE-MISMATCH-AUDIT-001`.

### 4.7 Built but no known originating ticket

Firebase auth/storage/App Hosting · NextAuth v4 (vs. planned v5) · local dev auth mode · file attachments + signed local URLs · Firebase Storage attachment support · workspace invites · invite policy · email invite delivery (Resend) · invite expiry maintenance job · guarded import flow · Activity/Comment/Notification/SavedView/work-item-relation schema models. Treat these as implemented code lacking planning provenance — real, tested, but nobody wrote down when or why they were scoped.

---

## 5. Implementation Debt Backlog

Generated from `TECHNICAL.md §3`. Ticket IDs continue the project's existing convention.

| ID | Title | Why | Priority |
|---|---|---|---|
| `DOCS-TRUTH-RESOURCE-002` | Replace old resource files with v6.2 pack | Sync Architect/Codex/library sources before further implementation | **Highest — do first** |
| `RESOURCE-MISMATCH-AUDIT-001` | Audit live repo against v6.2 resources | Create factual mismatch report before broad fixes | **Highest — do after resource replacement** |
| `WEBSITE-LIVE-001` | Launch PlanGlade website fast | Self-host now, Cloud soon, Demo soon; no billing/demo/cloud implementation | High — first product/code task |
| `BRANCH-001` | Reconcile `frontend-redesign-exploration` and `main` | Orphaned upstream, 235-commit divergence, red test suite, contradictory uncommitted status file | **Highest — blocks branch trust** |
| `DEBT-001` | Fix `readme-mvp-scope.test.ts` failure | Currently red on the active branch, independent of any other change | High |
| `DEBT-002` | Reconcile README with the no-Mermaid/no-badges decision and the branch-specific README test contract | An external draft produced without live-repo access risks reintroducing Mermaid/badges or breaking the branch-local README assertions. Public `main` uses `Available Today / Next / Later`; the active branch reportedly still expects `Available / MVP`. Fix only against the branch being tested. | High |
| `DEBT-003` | Auth.js/NextAuth v4 → v5 upgrade, or formally accept v4 as target | Real breaking-change migration, not a version bump — needs scoping before it's picked up casually | Medium |
| `DEBT-004` | Postgres production datasource + migration path | Spec says production Postgres; only SQLite exists | Medium |
| `DEBT-005` | Test runner decision: adopt Node's built-in runner as target, or migrate 283 tests to Vitest/Playwright | Real migration cost either way; needs an explicit call, not a default | Medium |
| `DEBT-006` | Port Docker baseline from `main` onto the active development branch | Docker already shipped once — this is porting/rebasing, not building from scratch | High, once `BRANCH-001` is underway |
| `DEBT-007` | Port/verify Docker docs during branch reconciliation | Public `main` README/self-host docs now acknowledge Docker. The remaining risk is that `frontend-redesign-exploration` lacks the Docker files/docs or carries contradictory `ACTIVE_PLAN` status. | Medium |
| `DEBT-008` | GitHub OAuth: wire up UI or remove server-side config | Currently half-configured, unreachable dead path | Low |
| `DEBT-009` | Resolve `@mdxeditor/editor` vs. "no complex rich-text blocks" non-goal | Direct contradiction between installed dependency and documented non-goal | Low |
| `DEBT-010` | Verify necessity/legitimacy of `z-ai-web-dev-sdk` and `next-intl` | Unexplained dependencies with no corresponding product decision | Low |
| `DEBT-011` | Clean up extraneous `@emnapi/runtime` npm entry | Minor hygiene | Low |
| `DEBT-012` | Complete legacy `FLOWBOARD_*` → `PLANGLADE_*` env var cleanup | Already in progress; finish it | Low |

---

## 6. Open Decisions Log

Unlike the debt backlog above, these aren't implementation tasks — they're calls only the maintainer can make. Each needs one recorded line here the moment it's decided, so this stops happening.

1. **Auth strategy:** permanent dual-mode (NextAuth + Firebase), or converge on one?
2. **Database:** **Decision for hosted cloud:** Postgres is required before paid cloud. SQLite may remain local/dev/early self-host until explicitly migrated.
3. **Firebase positioning:** does a Google-proprietary auth/storage path undercut the AGPL/self-host pitch, or is dual-mode fine as long as self-hosters can run NextAuth-only?
4. **Attachments:** build UI to activate the existing backend, or leave it dormant until a later phase?
5. **Collaboration/invites:** same question — activate now, or hold for Phase 4 as originally planned?
6. **Test runner:** Node's built-in runner as the new standard, or migrate to Vitest/Playwright?
7. **Docs vs. Notes:** confirm in `PRODUCT.md` that Docs is now an advanced/default-off feature rather than a core MVP tab (this one has a clear answer already — just needs to be written down, done in this revision).
8. **Public history transparency:** should the README state plainly that public commit history starts from a curated export?
9. **i18n scope:** is `next-intl` a real planned feature, or premature scaffolding to strip out?
10. **Reporting scope:** is `recharts` tied to a real near-term feature, or the same situation?
11. **Rich text:** keep `@mdxeditor/editor` and revise the non-goal, or confirm it's unused and remove it?

---

## 7. Self-Hosting / Docker Reconciliation

This gets its own section because it's the clearest example of "the target was already met, just not everywhere yet":

1. Docker baseline shipped on `main` via PR #15, closing issue #6. Confirmed: multi-stage Dockerfile, docker-compose.yml, non-root user, persistent volumes, health check.
2. It does not exist on `frontend-redesign-exploration`, the branch where actual feature work happens.
3. `README.md` and `docs/SELF_HOSTING.md` on public `main` now describe the early Docker baseline; older audit notes saying they still describe Docker as unsupported are stale.
4. Postgres remains unimplemented even where Docker exists — the shipped baseline still runs SQLite.

**Sequence:** resolve `BRANCH-001` first (decide whether `main` merges into the dev branch, the dev branch merges into `main`, or both reconcile into a new baseline) → port/verify Docker files and Docker docs on whichever branch is canonical (`DEBT-006` / `DEBT-007`) → only then take on Postgres (`DEBT-004`) as a separate, later ticket.

---

## 8. Current State

*(Milestone-level only — see §0 for how this relates to `docs/ACTIVE_PLAN.md`. Update this section in place; do not copy it into other documents.)*

**As of 2026-07-01:**

- Public export (`main`) has 14 visible commits as of this validation, with `9681a60` latest, includes a merged Docker self-host baseline, and is the branch GitHub visitors see.
- Active development (`frontend-redesign-exploration`) is ~235 commits past the divergence point, orphaned from its deleted upstream, and currently has one failing test.
- Recent work on the active branch has focused on: public-facing UI polish (Home, Tasks, Inbox), Project Detail redesign (Concept 2, removing the Docs tab), Calendar visual acceptance, Settings appearance/priority display, and environment-variable naming cleanup.
- Public issue #8 (contributor guide) remains open. Security contact work is implemented on `main` via `9681a60`; if #9 still appears open in GitHub UI, verify/close it from the owner account rather than treating the code/doc work as missing.
- No planning document had been updated to reflect Firebase, attachments, invites, or Docker until this revision.

- SaaS/public launch direction is now decided: website first, self-host now, cloud soon, demo soon, no checkout until cloud is real.
- Public copy must be concise and human; avoid long internal-risk wording on marketing pages.
- First website publish should not wait for Postgres, billing, public demo, or production cloud.

---

## 9. Public MVP Exit Criteria

Ready for honest public alpha when: user can sign in · create workspace · capture an inbox item · convert it to a task · create a project · attach a task to a project · create a note/doc for a project · calendar shows task due dates · Settings can export data · landing page does not overclaim · self-host docs are accurate · CI passes · basic security audit passes · no fake features are visible.

**Current blockers against this list:** CI does not currently pass on the active branch (§0), and self-host/Docker work must be reconciled from public `main` into whichever branch becomes canonical (§7).

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

### WEBSITE-LIVE-001 — Launch PlanGlade Website

Goal: make `planglade.com` ready to go live with short human copy: **Self-host now. Cloud soon. Demo soon.**

Rules: no billing, no checkout, no cloud accounts, no real public demo, no database/auth behavior changes, no fake claims.

Full task details live in `SAAS-LAUNCH.md §14`.

## 11. Ticket Prompt Template

```text
Task Name:
Goal:
Context:
Allowed Areas:
Do-Not-Touch:
Requirements:
Acceptance Criteria:
Design Reference:
Validation Steps:
Completion Report Required:
```

Rules: one ticket only · exact files/areas · no unrelated cleanup · report skipped items · run validation.
