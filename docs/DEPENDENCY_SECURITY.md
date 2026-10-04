# Dependency security pins

Reviewed on 2026-10-04.

`backend/package.json` pins `@fastify/busboy` to the official `3.2.2` release.
It fixes the multipart boundary and prototype-named header failures affecting
the existing Firebase Admin dependency. See
[GHSA-xjh9-v7x6-24jw](https://github.com/advisories/GHSA-xjh9-v7x6-24jw) and
[GHSA-x8mw-p69m-v3mx](https://github.com/advisories/GHSA-x8mw-p69m-v3mx).

Both workspaces override `braces` with
`npm:@dieub/braces-depth-guard@3.0.3-pn.3`. The upstream package remains at
3.0.3 with no patched release listed for
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
The MIT-licensed derivative adds a maximum nesting depth of 100 to parsing and
AST traversal, bounds parsing length, and rejects cyclic expansion parent chains.
It preserves the existing glob API used by linting and Tailwind. No framework
upgrade or audit exception is included.

This is a new, independently maintained package, not an upstream release. Its
exact version, registry URL and archive integrity are pinned in both lockfiles
and enforced by the dependency regression check in CI. Review any
replacement version before changing those pins. Prefer returning to upstream
when a compatible official fix is available.

The published runtime files and license were compared byte for byte with source
commit [`305a2e4bfe324bb53c336c1b03387ee1251c926f`](https://github.com/dieub/braces-depth-guard/tree/305a2e4bfe324bb53c336c1b03387ee1251c926f).
The archive's SHA-512 matches the registry metadata and provenance subject.
`npm audit signatures` verified its registry signature and GitHub Actions
attestation. The package has no install lifecycle scripts and retains the same
`fill-range` runtime dependency. All 799 tests in that source revision passed.

The project's `npm run test:dependency-guards` checks every installed braces copy
recorded in the two lockfiles, the reviewed archive identity and installed package
identity, ordinary source-file glob expansion, deeply nested
strings and ASTs, the 252-byte multipart boundary, and prototype-named headers.
Hostile parser cases run in a child process with a timeout. This check also runs
as part of `npm test`.

The guard addresses the reviewed depth failure. It does not promise bounds on
expansion output size, AST width, or arbitrary object getters. A clean audit alone
does not prove the fork's safety; retain the source review, regression tests, and
normal build and application checks when updating it.
