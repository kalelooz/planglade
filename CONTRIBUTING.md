# Contributing

Thanks for helping improve PlanGlade. The project is an early public preview
for individuals and small teams, so contributions should stay focused,
reviewable, and honest about current behavior.

## Before you start

You need Node.js 22 or newer and npm. Docker is optional for normal local
development and required only for testing the self-host release bundle.

PlanGlade has two runtime packages:

- `frontend/`: the React and Vite product interface and only visual surface.
- `backend/`: the Next.js API, authentication, Prisma/SQLite, and attachments.

The frontend development command starts both packages. Port 3000 is an internal
API/auth process; use `http://127.0.0.1:5173` in the browser.

## Local setup

From a fresh checkout:

```bash
npm run install:all
npm run dev
```

The launcher creates an ignored `.runtime/planglade-dev.db`, applies the Prisma
schema, starts the backend on port 3000, and starts Vite on port 5173. Local
development uses the canonical development identity and does not require
Docker, Firebase, OAuth credentials, or an email service.

For the Docker release path, generate unique local secrets and follow the
[self-hosting guide](./backend/docs/SELF_HOSTING.md):

```bash
npm run setup:local
```

Never commit `.env`, `.runtime/`, local databases, attachment data, or secrets.

## Choosing work

- Use an open issue or create one with the repository's issue forms.
- Keep one issue and one coherent change per pull request.
- Ask before large authentication, database, security, architecture, or
  dependency changes.
- Do not add fake features, metrics, cloud claims, or non-working controls.
- Reuse existing routes, components, contracts, and dependencies first.

Security vulnerabilities do not belong in public issues. Follow
[SECURITY.md](./SECURITY.md). General help and conduct-contact instructions are
in [docs/SUPPORT.md](./docs/SUPPORT.md).

## Pull requests

Branch from current `main`, keep commits focused, and include:

- the problem and end result;
- files or surfaces changed;
- exact validation performed;
- screenshots for visible UI changes with private data removed;
- a linked issue when one exists.

Use `Closes #X` only when the pull request completely resolves that issue.

## Validation

Run the smallest checks that prove the change. The complete local gate is:

```bash
npm run check:public
npm run check:ci
npm run check:docs
npm run lint
npm run typecheck
npm exec --prefix backend -- prisma validate --schema backend/prisma/schema.prisma
npm test
npm run build
```

Changes to authentication, routing, shared frontend state, or the frontend/API
boundary should also run:

```bash
npm run test:e2e:integration --prefix frontend
```

State any skipped command and why in the pull request.

## Code and product standards

- Use strict TypeScript and runtime validation at trust boundaries.
- Authenticate first, then verify workspace membership, entity ownership, and
  role/capability permission.
- Never trust client-provided user or workspace IDs as identity.
- Never render untrusted HTML or expose secrets and internal storage keys.
- Keep user-facing task routes named `Tasks` and `/tasks`; `work-items` remains
  an internal API term.
- Every visible action must work, be clearly disabled, or be removed.
- Update user and operator documentation when behavior changes.

No CLA or DCO process is currently required.
