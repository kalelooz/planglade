# Security Policy

PlanGlade is under active development and is not production-hardened yet. Please treat the project as pre-public release software unless the docs for your deployment path say otherwise.

## Reporting Vulnerabilities

Do not open a public issue with secrets, tokens, database URLs, private keys, exploit details, or private user data.

Until a dedicated security email is published, use GitHub private vulnerability reporting if it is available on the repository. If it is not available, contact the maintainer through GitHub before disclosing publicly. If you do not have a private channel, open a minimal public issue that says you need to report a security concern, without including exploit details or sensitive data.

Helpful report details:

- A short summary of the issue.
- Affected area, route, or feature.
- Safe reproduction steps that do not expose real secrets or user data.
- Expected impact.
- Any suggested fix, if you have one.

## Scope

Supported version: the current `main` branch after the public repository is launched.

Security reports are welcome for:

- Authentication and session handling.
- Workspace access boundaries.
- Import/export behavior.
- Attachment storage and signed URLs.
- API validation and permission checks.
- Handling of secrets and environment variables.

## Public Discussion

Please wait for maintainer confirmation before publishing detailed vulnerability information. Public issues and pull requests should avoid exploit instructions and real credentials.

## Current Limitations

- PlanGlade is early self-host software.
- It is not production-ready yet.
- Review authentication, storage, backups, TLS, reverse proxy, monitoring, and rate limiting before exposing it to the public internet.
- Response goals are best-effort while the project is solo-maintained; security reports will be prioritized over normal feature work.
