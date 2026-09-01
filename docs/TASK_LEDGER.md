# PlanGlade task ledger

## Active task

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
