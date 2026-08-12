# Releases and upgrades

PlanGlade publishes versioned self-host preview releases from signed Git tags.
Every release includes source, SHA-256 checksums, backend and frontend CycloneDX
SBOMs, build provenance, and version-specific upgrade notes.

## Release contract

Before tagging a release:

1. Update all three package versions and lockfiles to the same version.
2. Add a versioned changelog entry and `docs/releases/<version>.md`.
3. Run `npm run install:all`, `npm run check:release`, and
   `npm run test:release` plus the ordinary CI suite.
4. For every release after `0.2.0`, rehearse the documented upgrade from the
   immediately previous release using disposable copies of both persistent
   volumes. Record the versions and result in the release notes.
5. Create an annotated, cryptographically signed tag: `git tag -s v<version>`.
6. Push the tag. The release workflow verifies its signature, repeats the
   release gates, generates artifacts, and creates a GitHub pre-release.

Do not tag from an unreviewed branch, bypass a failed migration or restore
rehearsal, or overwrite an existing release tag.

## Operator upgrade rule

Before upgrading, read the notes for the target version, stop writes, and back
up the SQLite and attachment volumes from the same point in time. Retain the
earlier application version until the upgraded data has been verified. See
[Production migrations](../backend/docs/PRODUCTION_MIGRATIONS.md) and
[Backup and restore](../backend/docs/BACKUP_RESTORE.md).

## First baseline

`0.2.0` is the first public baseline. It has no supported predecessor. Databases
from private prototypes, development snapshots, or unrelated PlanGlade forks
must not be treated as upgrade sources.
