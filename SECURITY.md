# Security Policy

PlanGlade is under active development and is not production-hardened yet. Please treat the project as pre-public release software unless the docs for your deployment path say otherwise.

## Reporting a Vulnerability

Security issues must be reported privately, not through normal GitHub Issues. Do not open a public issue with exploit details, reproduction steps, credentials, tokens, private keys, database URLs, URLs containing secrets, private user data, or screenshots with sensitive data.

**Primary path:** use GitHub Private Vulnerability Reporting on this repository if it is visible to you. This is the preferred path because it keeps the report private and supports coordinated fixes.

**If private vulnerability reporting is not visible:** open a minimal public GitHub issue that says only:

> I need a private channel to report a security issue.

That public issue must not include exploit details, reproduction steps, credentials, tokens, private keys, database URLs, URLs containing secrets, private user data, or screenshots with sensitive data. A maintainer will follow up privately.

A dedicated security email may be added later. Until then, the paths above are the supported reporting channels.

Normal bugs and feature requests belong in GitHub Issues. Suspected security vulnerabilities do not.

### What to include in a private report

Once you are in a private channel, include:

- A short summary of the issue.
- Affected feature, route, or package.
- Safe reproduction steps that do not expose real secrets or user data.
- Expected impact and who could be affected.
- Environment and version (commit SHA, branch, release, or deployment path).
- Whether you would like public credit if the report is confirmed.

## Supported Versions and Scope

**Supported:** the current `main` branch and the latest public release.

**Not supported:** old commits, private forks, modified deployments, unrelated third-party services, and misconfigured self-host environments, unless the issue is caused by PlanGlade's own defaults.

Security reports are welcome for:

- Authentication and session handling.
- Workspace access boundaries and permission checks.
- Secret and environment variable handling.
- Attachment storage, local file storage, and signed URLs.
- Import/export behavior.
- API validation.
- Docker and self-host security defaults.

## Maintainer Response

PlanGlade is a solo-maintainer project. Response is best-effort, not guaranteed.

- Serious reports are acknowledged as soon as practical.
- Confirmed issues affecting authentication, workspace isolation, secret handling, attachment access, import/export, and Docker/self-host security are prioritized over normal feature work.
- There is no guaranteed response time or SLA.

## Coordinated Disclosure

Please avoid public disclosure of vulnerability details until a fix or mitigation is available. When appropriate, the maintainer may use GitHub Security Advisories to coordinate a fix and release an advisory with credit to the reporter (if requested).

## Current Limitations

- PlanGlade is early self-host software.
- It is not production-ready yet.
- Review authentication, storage, backups, TLS, reverse proxy, monitoring, and rate limiting before exposing it to the public internet.
- There is no bug bounty program, formal audit, SOC 2, or round-the-clock security support.
