# PlanGlade task ledger

## Active task

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
