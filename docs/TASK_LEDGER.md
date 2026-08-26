# PlanGlade task ledger

## Active task

### AUTH-001 — Backfill normalized emails and retire transitional authentication scans

- Status: **PASS**
- Requested: 2026-08-26
- Scope: resolve public issue #89 with a fail-safe normalized-email data migration, remove both authentication-time transitional scans, and document self-host conflict recovery.
- Acceptance: application and migration share the exact normalizer; invalid values, collisions, and inconsistent stored values block before mutation; valid null values backfill in one transaction; verification rejects any remaining null value; runtime authentication uses only the unique indexed lookup; focused integration coverage proves normalization, failures, rollback, completion, and scan removal.
- Publication: the owner explicitly authorized this scoped fix and remote branch push on 2026-08-26.

### Evidence

- 2026-08-26: 30 focused authentication, normalized-email migration, and Docker packaging tests passed.
- 2026-08-26: all 234 backend tests, all 111 frontend tests, and the authenticated browser integration suite passed.
- 2026-08-26: lint, typecheck, both production builds, Prisma validation, public/CI/docs/release checks, backend surface guard, and release backup/restore rehearsal passed.
- 2026-08-26: release rehearsal backfilled and verified a legacy null `normalizedEmail`; rollback coverage proved a simulated second-row write failure preserved every null source row.
- 2026-08-26: the real Node 22/Alpine migrator image passed fresh named-volume creation, recovery of a deliberately root-owned existing volume, mixed-case/whitespace backfill, completed verification, invalid-email and indexed-collision blocking, and injected write-failure rollback with persisted rows inspected after each run; migration and operator commands executed as UID/GID 1001 after the ownership repair.
- 2026-08-26: the second assurance pass corrected fresh-volume ownership and restored the lockfile's patched `deepmerge-ts` override in the migrator image; backend and built-image audits then reported zero vulnerabilities.
- 2026-08-26: separate root-owned standards and issue-acceptance review found no remaining findings; authentication policy prohibited delegated review.
- Visual verification: not applicable; this task changes only backend authentication, migration, tests, and operator guidance.

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
