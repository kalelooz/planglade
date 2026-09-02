# PlanGlade task ledger

## Active task

### PG-DATA-002 — Serialize append imports durably

- Status: **REVISE** — public implementation and focused SQLite evidence pass; full public gates, independent review, merge, and downstream PostgreSQL proof remain pending
- Requested: 2026-09-02
- Scope: prevent overlapping append imports from passing duplicate checks in separate application processes, while giving safe retries a stable provider-neutral idempotency contract.
- Acceptance: a durable workspace lease gives one active importer ownership and returns 409 to overlap; every reviewed source checksum retains and replays its completed result; expired claims recover; release and completion are claim-scoped; import writes and completion commit atomically under Serializable isolation with bounded retry; empty and populated migrations, full public gates, independent review, and downstream PostgreSQL multi-process proof pass.

### Evidence

- 2026-09-02: regression-first tests failed because import coordination existed only in a process-local `Set`. The replacement stores a five-minute claim in the application database, uses the confirmed source checksum as the idempotency key, and records the result in the same transaction as imported data.
- 2026-09-02: real SQLite tests give parallel claims exactly one owner and one conflict, retain and replay older completed checksums after newer imports, recover an expired lease, prevent stale release, and prove bounded retry of Serializable transaction conflicts. The focused import/export route suite and typecheck pass.
- 2026-09-02: a populated migration probe applies the new operation table after all prior migrations, preserves the existing user and workspace, and accepts a durable lease row.
- 2026-09-02: the complete backend suite passes 276/276 on a fresh database with every migration applied. The route suite directly proves an overlapping import returns 409, stale owners cannot complete after lease expiry, and backend lint, typecheck, production build, backend-surface validation, high-severity dependency audit, public/CI/docs/release boundary checks, and the backup/restore release rehearsal all pass.
- Visual evidence: not required for the database, API concurrency, and migration change.

### PG-SEC-001 — Close the invitation test-send relay

- Status: **PASS** for public-core publication; Cloud import and production verification remain separately gated
- Requested: 2026-09-02
- Scope: prevent authenticated invitation test-send from targeting arbitrary recipients or delivering caller-controlled content, apply the normal invitation policy, and share durable abuse controls across create, resend, and test delivery.
- Acceptance: test-send is restricted to the signed-in verified email; overrides remain preview-only; minimum inviter-role and domain policies apply; stable logical retries reuse the provider idempotency key; account, workspace, recipient, test, and installation quotas persist across processes and return 429; normal invitation routes remain intact; focused and full public gates pass.

### Evidence

- 2026-09-02: regression-first route checks prove arbitrary-recipient rejection, OWNER-only and blocked-domain policy enforcement, fixed delivered content with caller content confined to the response preview, stable provider keys for logical retries, and a clear 429 with `Retry-After` after the test quota.
- 2026-09-02: the durable limiter stores only hashed account/workspace/recipient subjects in the existing database throttle table. Create and resend share the recipient quota; two independent Node processes racing against one SQLite database receive only three total test-send claims.
- 2026-09-02: independent review identified a stale quota-window denial race. A deterministic regression reproduced it, and the corrected conditional block claim now re-evaluates capacity if another process resets the window. The review's duplicate-variable claim was disproved by source scopes, TypeScript, and the complete test run.
- 2026-09-02: downstream PostgreSQL CI exposed a concurrent first-row upsert conflict that SQLite serialized away. A focused regression now proves the limiter treats that exact unique-key race as another process winning creation and safely continues the atomic claim.
- 2026-09-02: all 269 backend tests and all 168 frontend tests pass. Backend/frontend lint and typecheck, both production builds, Prisma validation, public boundary, CI/docs/release/backend-surface checks, release backup/restore rehearsal, and high-severity dependency audits pass. A newly disclosed Browserslist advisory was removed with compatible lockfile-only updates; one low-severity frontend build-tool advisory remains non-blocking.
- Visual evidence: not required; this correction changes server API and delivery behavior only.

### UI-005 — Project, Task, and Note control integrity

- Status: **PASS** for public-core publication; Cloud import remains separately gated
- Requested: 2026-09-01
- Scope: make every Project create/edit control durable, prevent nested Project, Task, and Note controls from closing or clicking through their parent dialog or sheet, and verify the shared mutation paths without adding provider-specific behavior.
- Acceptance: Project start/target dates, color, icon, status, and Advanced slug create, edit, save, and survive reload; Task status, priority, project, and due date survive reload; Note formatting and linked-project changes survive reload; nested task-conversion controls remain interactive; focused tests, reference and authenticated browser suites, lint, typecheck, production build, and repository boundaries pass.

### Evidence

- 2026-09-01: live inspection reproduced Project overlay clicks falling through to underlying controls. Browser regression coverage then proved the shared Select/Popover layer matched its parent modal and calendar day buttons could submit a surrounding form.
- 2026-09-01: Dialog and Sheet now provide an in-surface portal container for nested Select and Popover content, transient overlays render above the parent surface, calendar days are explicit non-submit buttons, and project appearance selectors close after a confirmed choice.
- 2026-09-01: slug, color, and icon are first-class provider-neutral Project fields. Server adapters expose them directly and mutable workspaces persist them, while legacy source fallbacks remain readable.
- 2026-09-01: all 168 frontend tests passed; the expanded 10-test reference browser suite passed Project, Task, and Note interaction and save/reload coverage; the authenticated browser integration suite and 3-test landing suite passed; frontend lint, typecheck, production build, public boundary across 491 files, and CI workflow validation passed.
- 2026-09-01: independent bounded UI review found no actionable issues after the correction pass.

### UI-004 — Discoverable plans and support

- Status: **PASS**
- Requested: 2026-09-01
- Scope: give plan discovery and support stable product navigation, add a dedicated Plans route, and provide a reusable contextual engagement card without publishing provider billing implementation.
- Acceptance: Plans and Help & support are reachable from desktop, collapsed, mobile, and command navigation; the reusable corner card waits for caller-confirmed meaningful use and remembers dismissal for 30 days; routes, metadata, accessibility, responsive layout, focused tests, public boundaries, and production build pass.

### Evidence

- 2026-09-01: `/app/plans` now presents Free, Solo, and Teams with a PlanGlade-specific sprout, tree, and grove progression. Provider pricing, checkout, entitlements, and payment administration remain outside the public core.
- 2026-09-01: Plans and Help & support are reachable from expanded, collapsed, mobile, and command navigation. The support sheet provides private email/feedback paths, public documentation and issue paths, and a warning against publishing sensitive information.
- 2026-09-01: the reusable bottom-right engagement card requires caller-confirmed meaningful use, links to Plans, feedback, and GitHub, and stores a 30-day dismissal. Reference/sample mode does not show it.
- 2026-09-01: all 170 frontend tests, frontend lint and typecheck, the frontend production build, public boundary, CI workflow, documentation, and release-readiness checks passed. The focused Playwright check passed at 1440×900 and 390×844 with no accessibility violations, horizontal overflow, console errors, or sub-44px mobile controls.
- 2026-09-01: independent review found the initially unreachable engagement card and missing support command; one bounded correction mounted the card after the three real onboarding milestones and added the typed `open-support` command. Corrected source, tests, build, browser check, and boundary scan passed.
- 2026-09-01: the root backend suite was not acceptance evidence for this frontend-only task; in this fresh Windows worktree it could not initialize Prisma's SQLite schema engine even after client generation, before loading changed code. No backend files changed, and remote CI remains the independent backend gate.

## Completed tasks

### CORE-001 — Canonical public collaboration core

- Status: **PASS**
- Requested: 2026-08-27
- Scope: make the public repository canonical for provider-neutral team access, invitation email/consent, comments, notifications, and task assignment; keep Firebase, Stripe, cloud billing, secrets, provider deployment, and private operations out.
- Acceptance: explicit invite review precedes acceptance; member/comment/notification UI uses existing public APIs; viewers retain read-only access; assignment mutations pass through the canonical server adapter; public boundary, lint, typecheck, focused tests, frontend suite, production builds, and browser inspection pass.

### Evidence

- 2026-08-27: public boundary, CI workflow, docs, release-readiness, and backend-surface checks passed across 424 publishable files.
- 2026-08-27: six focused invitation consent/preview tests and all 117 frontend tests passed; backend and frontend lint, typecheck, and production builds passed.
- 2026-08-27: rendered invitation review passed DOM, visual, and console inspection; evidence is under `artifacts/verification/core-unification/` (intentionally ignored).
- 2026-08-27: leakage scan found no Firebase, Stripe, GCP, billing, cloud-plan, or secret references in the reusable slice.

## Completed tasks

### AUDIT-001 — 2026-08-30 deep-dive remediation

- Status: **PASS** for branch publication; release remains separately gated
- Requested: 2026-08-30
- Scope: verify every finding in the supplied deep-dive audit, implement confirmed provider-neutral security, recovery, storage, import/export, concurrency, and public-surface fixes, and preserve explicit release/runtime/legal gates.
- Evidence: [the finding-by-finding reconciliation](./DEEP_DIVE_REMEDIATION_2026-08-30.md); 258 backend tests and 168 frontend tests pass; backend/frontend lint, typecheck, and production builds pass; public-boundary, CI, docs, release-readiness, release-rehearsal, Prisma migration, backend-surface, dependency-audit, and responsive recovery-screen checks pass. The current-main reconciliation also closes the independently reviewed attachment-reaper race, binds import confirmation to the previewed version and checksum, reports hierarchy loss explicitly, refreshes task versions after reordering, validates canonical origins for every production auth mode, and keeps hosted security metadata downstream.

### UI-003 — Proportional Tasks work surface

- Status: **PASS**
- Requested: 2026-08-27
- Scope: balance the Tasks list around the available canvas so task metadata stays easy to follow while left, middle, and right whitespace and row dividers remain proportional across desktop, tablet, and mobile widths.
- Evidence: the desktop list now caps at 960px inside a centered 1200px Tasks region; at 1728×920 the row metadata cluster measured 646px with exactly 157px on both sides. The 1024×768 and 390×844 layouts rendered without horizontal overflow, warnings, or errors, and mobile status, due date, and priority now wrap fully inside each row. The reference browser check removes status, due-date, and priority columns in turn and proves every remaining grid stays ordered and centered. Frontend typecheck, lint, all 117 tests, the 3-test reference browser suite, the reference production build, and the Impeccable layout detector passed. The independent review's two confirmed findings—mobile clipping and missing dynamic-column coverage—were corrected in one bounded pass. Three retained screenshots are under `artifacts/verification/UI-003/`, and the final wide capture replaced the published Tasks image. Calendar and Connections remain unchanged.

### UI-002 — Calibrated task-list metadata columns

- Status: **PASS**
- Requested: 2026-08-27
- Scope: reduce desktop eye travel by keeping task identity, status, due date, and priority in adjacent aligned columns while preserving the existing mobile metadata layout and interactions.
- Evidence: `npm run test:e2e:reference --prefix frontend` passed all 3 reference-browser tests. The real Tasks page rendered without horizontal overflow at 1728×920, 1024×768, and 390×844; its desktop identity-to-status text gap measured 121px, adjacent metadata columns measured 20px apart, and the complete scan band measured 608px. Clicking the status area opened task details. Three retained local screenshots are under `artifacts/verification/UI-002/`; the 1728×920 capture replaced the published Tasks image. Calendar and Connections were not changed.

### DOC-002 — README Tasks screenshot framing

- Status: **PASS**
- Requested: 2026-08-27
- Scope: replace only the first “A closer look” image with a current, sanitized Tasks-page browser capture and leave the Calendar and Connections images unchanged.
- Evidence: the real public application was captured at 1728×920 from the canonical reference-mode Tasks route; the sidebar-to-content gutter is 32px, the README image path is unchanged, and no synthetic UI image was committed.

### DOC-001 — README home screenshot framing

- Status: **PASS**
- Requested: 2026-08-27
- Scope: replace the oversized desktop home screenshot with a current, sanitized reference-mode browser capture that keeps the navigation and dashboard visually connected.
- Evidence: the real public application was captured at 1728×920 from the canonical reference-mode launch; the sidebar-to-dashboard gutter is 32px, the README image path is unchanged, and no synthetic UI image was committed.

### UI-001 — Approved-resource UI remediation

- Status: **PASS**
- Requested: 2026-08-26
- Scope: fix the verified frontend audit findings in the public repository first, then import the reviewed shared patch into the private cloud repository.
- Acceptance: mobile touch targets meet the project 44px standard; route surfaces are code-split; reduced-motion behavior is intentional; the approved frontend resource and design contract is documented; focused tests, lint, build, detector, and representative browser checks pass independently in both repositories.
- Publication: this remediation task did not itself authorize a push, release, or deployment; publication of the public PR was authorized separately on 2026-08-26.

### Evidence

- 2026-08-26: all 111 frontend tests, lint, typecheck, reference build, and 3 Playwright reference checks passed.
- 2026-08-26: mobile Tasks checks proved 40 frequent controls at a minimum 44×44px with no horizontal overflow at 320px or 390px.
- 2026-08-26: route and vendor splitting reduced the entry chunk to 345.28kB / 99.51kB gzip and removed Vite's large-chunk warning.
- 2026-08-26: desktop and mobile browser inspection passed with no runtime warnings or errors; evidence is under `artifacts/verification/UI-001/` (intentionally ignored).
- 2026-08-26: the Impeccable detector's four warnings were reviewed as existing false positives: Markdown blockquote styling, a functional timeline resize handle, and mutually exclusive project-status color branches.
- 2026-08-26: the bounded PR review correction passed backend configuration/import tests, workspace import route integration tests, repository boundary checks, and the backend surface guard.
