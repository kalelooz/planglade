# Changelog

All notable public-facing changes should be recorded here.

This project has not published a stable public release yet. Versioned preview
releases are documented below.

## Unreleased

### Added

- Added complete attachment controls to saved tasks and notes, including
  upload, list, download, rename, and permission-aware permanent deletion.

### Changed

- Relicensed PlanGlade from GNU AGPL v3.0 to the MIT License.
- Calibrated the desktop Tasks list so its compact metadata columns sit inside
  a centered, responsive work surface with balanced gutters and shorter
  dividers instead of spanning the entire viewport.

## [0.2.0] - 2026-08-09

First public self-host preview.

### Added

- A solo-first PlanGlade workspace with projects, tasks, inbox, calendar,
  notes, saved views, settings, export, and guarded import.
- A first-run setup flow with local email/password authentication by default;
  OAuth and email delivery remain optional.
- Docker Compose deployment with separate frontend, backend, migration, SQLite,
  and local attachment-storage boundaries.
- AGPL-3.0 licensing, contributor guidance, security reporting, support docs,
  accessibility checks, and pinned CI actions.

### Upgrade and migration notes

- This is the first versioned public baseline, so there is no supported
  upgrade from an earlier PlanGlade release.
- The release contains one checked-in initial Prisma migration. Do not point it
  at databases created by private prototypes or development snapshots.
- Back up both persistent volumes before every future update and follow
  [the version-specific release notes](./docs/releases/0.2.0.md).

[0.2.0]: https://github.com/kalelooz/planglade/releases/tag/v0.2.0
