# PlanGlade task ledger

## Active task

### PG-STO-009 — Retry attachment storage deletion durably

- Status: **REVISE** — independent correction review, publication, and downstream proof are pending
- Requested: 2026-09-02
- Scope: retain a durable, provider-neutral cleanup job whenever an attachment record is deleted so a temporary storage-provider failure cannot create an untracked object.
- Acceptance: the cleanup job commits atomically with attachment deletion; immediate deletion remains fast; failures retain only safe retry metadata; expiring claims and bounded backoff support multiple workers; maintenance retries are idempotent across process restart; the public migration preserves populated data; focused/full public gates, independent review, Cloud PostgreSQL import, scheduler proof, and production-safe verification pass.

### Evidence

- 2026-09-02: the finding reproduced against public `main` `b68c302569cc3e52a739d14f7d1fd7fba2659ed9`. The database transaction removed the attachment and committed its activity record before calling the provider; a controlled invalid-provider fault then returned 500 with the attachment row already gone and the storage object still present.
- 2026-09-02: a provider-neutral `AttachmentDeletionJob` is now queued in the same transaction as record deletion. A five-minute UUID claim prevents concurrent workers from owning one attempt, expired claims recover after crashes, failures release the claim with bounded exponential backoff, and successful or repeated not-found deletion removes the job idempotently. Stored and logged failures contain only a validated error class, not provider response text.
- 2026-09-02: the existing maintenance endpoint drains pending deletion jobs before its expired-upload work. Self-hosting guidance now requires a private five-minute schedule, secret Bearer handling, and monitoring of the safe failure count; no new endpoint, dependency, background thread, or provider assumption was added.
- 2026-09-02: thirteen focused SQLite tests pass. They prove one provider call under both same-process and true parallel-process claims, recovery of an expired claim, safe stale-worker completion after takeover, retry timing from failure completion with exponential growth and a one-hour cap, fresh claims inside a delayed batch, transaction rollback of both attachment deletion and its queued intent, route-level durability during an injected provider outage, a successful retry from a fresh Node process, a harmless repeated retry, existing upload-reservation race safety, and a populated migration that preserves attachments while the cleanup job survives deletion of the original workspace row. The full backend suite also passes all 294 tests against a clean database built from all seven migration SQL files. The known local Windows Prisma schema-engine failure remains limited to that engine binary; Linux CI is required to prove `prisma migrate deploy` itself.
- 2026-09-02: independent review caught stale batch and failure timestamps before merge. The correction now takes each claim from that attempt's actual start, schedules backoff from provider completion, and prevents an expired claimant from overwriting or reporting failure after a newer worker wins. The review's requested process, takeover, timing, cap, and rollback regressions all pass.
- 2026-09-03: downstream Cloud review found that Task and Note deletion still relied on attachment-row cascades without queuing the affected storage keys. The provider-neutral correction now scans and queues each directly attached object and active reservation inside the parent-delete transaction, removes only the scanned rows, and changes both parent foreign keys from cascade to restrict. A concurrently finalized or otherwise unseen child therefore blocks and rolls back the whole parent deletion instead of losing cleanup intent. Work-item children still use `SET NULL`, so parent deletion preserves descendant tasks. Follow-up review then found two capability races. Upload capabilities and durable reservations now share one absolute expiry, while normal reservation cleanup and all deletion paths wait a bounded one-hour drain period. Parent deletion calculates one latest deletion time per storage key, and direct attachment deletion reads the matching reservation before queuing. A slow-stream regression proves early maintenance retains the job, the admitted upload completes afterward, and later maintenance removes the object; a consumed-reservation regression proves a still-valid create-only URL cannot recreate an object after either parent or direct record deletion. Route tests also cover provider outage, activity rollback, stale lane rejection, and child-task preservation; the populated migration test preserves rows and proves a late attachment forces rollback. All 17 focused attachment tests, all 298 backend tests, and all 171 frontend tests pass. All eight migrations apply to empty and populated SQLite databases with no foreign-key violations; both lints, both typechecks, both production builds, public/CI/docs/release/backend-surface checks, release backup/restore rehearsal, and both high-severity dependency audits pass. The final independent correction review reran the 15 route/reservation tests and returned PASS with no actionable findings.

### PG-OPS-007 — Publish safe health and immutable revision status

- Status: **PASS** — public implementation and private downstream production proof are complete
- Requested: 2026-09-02
- Scope: keep readiness checks useful to operators while removing public provider topology and configuration errors, and expose only a validated immutable source revision.
- Acceptance: public 200, 503, and 500 responses contain only status, service, and a validated 40-character revision or `unknown`; component detail remains server-side; provider-neutral container builds can supply the revision; focused and full public gates, independent review, Cloud import, exact-merge deployment, and production response-to-image proof pass.

### Evidence

- 2026-09-02: the finding is current. Production `/api/health` returned Firebase, Resend, storage, billing, provider-capability, and component error structures but no build identifier, even though the running image was independently tied to a reviewed commit.
- 2026-09-02: regression coverage now requires the complete public response shape for ready, degraded, database-failure, and unexpected-failure paths; invalid or mutable revision text is replaced with `unknown`, while exact lowercase 40-character revisions are returned. Detailed readiness failures are logged internally and are not serialized.
- 2026-09-02: all ten focused health/API contract tests pass. Backend typecheck, lint, and production build pass, and a clean runner image built with a controlled revision exposes that exact value through `PLANGLADE_BUILD_REVISION`; the local test image was removed after inspection.
- 2026-09-02: independent review found raw database and unexpected exceptions could retain connection details in internal logs, and the self-hosting guide still described the removed detailed public response. Exception telemetry is now limited to a validated error name and optional safe code, tests prove the secret sentinel is absent from logs as well as responses, and operator guidance points component diagnosis to internal logs only.
- 2026-09-02: public PR #118 merged as `e0d9e774f74a18ada745d0c38db15a3e55a14615` after the complete quality/build suite, authenticated browser integration, CodeQL, static analyses, container revision probe, and independent correction review passed.
- 2026-09-02: the private downstream imported that exact reviewed public merge without merging Git history, preserved its provider diagnostics only in internal telemetry, passed complete independent Cloud CI, and promoted an exact-merge image through a zero-traffic probe. Direct, tagged, and hosted production health each return HTTP 200 with exactly `revision`, `service`, and `status`, and the revision matches the promoted source. Provider-specific identifiers, rollback commands, and operational evidence remain in the private C-042 record.

### PG-DATA-005 — Prevent stale collaborative overwrites

- Status: **PASS** for public-core publication; Cloud import and PostgreSQL multi-process proof remain separately gated
- Requested: 2026-09-02
- Scope: require optimistic preconditions for shared task, project, and note updates or deletes, and serialize board ordering against durable per-lane versions.
- Acceptance: missing entity or lane preconditions fail closed with 428 and current state; stale writes return 409 and current state; list data and lane versions come from one snapshot; every task lane membership/order writer advances the durable version; conflicts reload the winning state; two-client edit, reorder, import overlap, migration, integration, and build checks pass.

### Evidence

- 2026-09-02: real SQLite route tests race two clients against the same task, project, note, and board lane. Exactly one same-version edit wins, stale requests return 409, and reloads preserve the committed value and ordering.
- 2026-09-02: lane versions are claimed in Serializable transactions with bounded retry. Task create, status change, reorder, delete, and append import all advance affected non-Inbox lanes; list rows and versions are read in one Serializable snapshot.
- 2026-09-02: a populated migration probe preserves existing workspaces and tasks, accepts a lane-version row, and proves workspace deletion cascades it. A separate import-versus-reorder race preserves the imported task and advances the lane once per committed writer.
- 2026-09-02: clients send entity and lane preconditions, preserve the established conflict payload, refetch active task/project/note queries after 409, and show the winning server state. The complete frontend suite and authenticated integration suite pass.
- 2026-09-02: independent review found non-atomic list/version reads, an import bypass, a delete-lane race, a stale integration fixture, missing reload proof, and missing operator documentation. The bounded correction pass addresses each confirmed finding; focused backend tests, both typechecks and lints, Prisma validation, and both production builds pass.
- 2026-09-02: downstream review found destructive deletes still accepted stale clients and note-conflict payloads could expose a note made private during the race. The upstream correction requires entity versions on task, project, and note deletes, requires the task lane version, filters current note state through the caller's live access boundary, races updates against deletes, and exercises a real API-client 409 through the active query cache.
- Visual evidence: not required; this is a database, API concurrency, and cache-reload change with no layout change.

### PG-DATA-002 — Serialize append imports durably

- Status: **PASS** — public and Cloud implementations, PostgreSQL multi-process proof, production migration, and safe live verification are complete
- Requested: 2026-09-02
- Scope: prevent overlapping append imports from passing duplicate checks in separate application processes, while giving safe retries a stable provider-neutral idempotency contract.
- Acceptance: a durable workspace lease gives one active importer ownership and returns 409 to overlap; every reviewed source checksum retains and replays its completed result; expired claims recover; release and completion are claim-scoped; import writes and completion commit atomically under Serializable isolation with bounded retry; empty and populated migrations, full public gates, independent review, and downstream PostgreSQL multi-process proof pass.

### Evidence

- 2026-09-02: regression-first tests failed because import coordination existed only in a process-local `Set`. The replacement stores a five-minute claim in the application database, uses the confirmed source checksum as the idempotency key, and records the result in the same transaction as imported data.
- 2026-09-02: real SQLite tests give parallel claims exactly one owner and one conflict, retain and replay older completed checksums after newer imports, recover an expired lease, prevent stale release, and prove bounded retry of Serializable transaction conflicts. The focused import/export route suite and typecheck pass.
- 2026-09-02: a populated migration probe applies the new operation table after all prior migrations, preserves the existing user and workspace, and accepts a durable lease row.
- 2026-09-02: the complete backend suite passes 276/276 on a fresh database with every migration applied. The route suite directly proves an overlapping import returns 409, stale owners cannot complete after lease expiry, and backend lint, typecheck, production build, backend-surface validation, high-severity dependency audit, public/CI/docs/release boundary checks, and the backup/restore release rehearsal all pass.
- 2026-09-02: downstream reconciliation found the preview contract and Settings confirmation still described imports as non-idempotent. The follow-up correction marks checksum retries idempotent, states that matching project slugs are updated, and keeps the restore warning; focused backend and frontend contract tests, both typechecks and lints, and all public boundary checks pass.
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
