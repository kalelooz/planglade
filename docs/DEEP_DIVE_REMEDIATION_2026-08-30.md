# Deep-dive audit remediation — 2026-08-30

This record reconciles the 2026-08-30 external deep-dive report against the public core branch. It is an implementation record, not a release declaration.

## Source-confirmed findings

| Finding | Result | Evidence |
| --- | --- | --- |
| SEC-01 | Addressed | Production Prisma configuration excludes query logging. |
| AUTH-01 | Addressed | Durable account and installation login buckets gate expensive password verification. |
| INV-01 | Addressed | Invitations store only token hashes; legacy pending plaintext-token rows are revoked by migration. |
| INV-02 | Addressed | Invitation URLs use the startup-validated canonical origin. |
| INV-03 | Addressed | Acceptance has one database claim winner and preserves an existing member role. |
| STO-01 | Addressed for the public self-host contract | Transfers stream; upload reservations bind actor, workspace, target, MIME type, byte ceiling, and expiry; finalization consumes one reservation transactionally; opaque object names, quota checks, free-space headroom, concurrency limits, and expired-object/temp cleanup are implemented. Content malware scanning remains an explicitly documented deployment concern. |
| DEP-01 | Addressed in source | Nginx preserves `$http_host`; release rehearsal validates the checked-in deployment contract. A real published-image Compose smoke test remains a release-environment gate. |
| DATA-01 | Addressed | Import creates notes first, maps destination IDs, and reports/drops unresolved note links. |
| INV-04 | Addressed | Resend rotates token version and delivery idempotency. |
| SEC-02 | Addressed | The API proxy centrally rejects cross-origin unsafe requests; route inventory tests cover unsafe handlers. |
| SEC-03 | Addressed | Invite and recovery responses use `no-store` and `no-referrer`. |
| AUTH-02 | Addressed | Legacy email-only JWT fallback was removed; session token version 1 is required. |
| AUTH-03 | Addressed | Saved one-time recovery codes reset the local password, revoke sessions through `authVersion`, and are account/globally throttled. |
| CFG-01 | Addressed | Canonical public URL validation runs before production startup. |
| DATA-02 | Addressed | Export v2 has a capability manifest; preview reports checksum, supported versions, exact losses, collision strategy, non-idempotence, relationship issues, and attachment impact; unsupported versions cannot be confirmed. |
| DATA-03 | Addressed on the primary collaborative mutation | Work-item field, placement, label, note, activity, and notification changes share a transaction. Frontend updates send an `updatedAt` precondition; stale writes return `409` with current server state. Other command/version seams remain normal incremental product work. |
| OPS-01 | Addressed for enforceable storage ownership | Quota demand is reconciled from durable attachment and reservation rows; atomic reservations, free-space headroom, transfer limits, and cleanup are implemented. A richer administrator storage-health UI and retention policy remain post-preview product work. |
| WEB-01 | Addressed | The empty sitemap was removed because the provider-neutral core has no canonical deployment hostname. |
| WEB-02 | Addressed at the provider-neutral boundary | Social preview is PNG and route metadata is complete; deployment-specific absolute canonical URLs belong in the downstream deployment overlay. |
| WEB-03 | Addressed | Nginx returns real 404s outside the explicit SPA route allowlist. |
| WEB-04 | Addressed | `.well-known/security.txt` is published. |
| TEST-01 | Materially addressed | Security, replay, race, quota, recovery, migration, release-rehearsal, and responsive UI checks were added or exercised. Firefox/WebKit critical journeys remain a P2 expansion. |
| GOV-01 | No current defect | GitHub Issues are enabled and repository reporting documentation passes its alignment check. |
| REL-01 | External release gate | Release rehearsal passes, but no tag or public release is created from an unreviewed branch. The first signed pre-release must follow review and merge. |

## P2 backlog retained

The report's broader P2 recommendations remain visible backlog rather than being misreported as defects closed by one branch: fuller frontend state separation; pagination/virtualization and graph aggregation; typography and Home/Connections/task-row product refinement; deterministic demo fixtures; Firefox/WebKit journeys; stronger artifact signing; container capability/read-only hardening; and trademark, DCO/inbound-licensing, and third-party-notice policy.

Optimistic concurrency for work items is included in this remediation. The remaining recommendations require product, legal, release, or deployment decisions and are not prerequisites for publishing this review branch.

## Current-main reconciliation

The final review against the current public main found and corrected four gaps in the original branch: expired-upload cleanup now claims a reservation before deleting storage, import execution revalidates the previewed version and checksum, task hierarchy is reported as an explicit append-import loss, and task placement refreshes sibling concurrency versions. Canonical mutation origins are now required for every production authentication mode, while the public `security.txt` remains provider-neutral. Focused race and trust-boundary tests cover these corrections.
