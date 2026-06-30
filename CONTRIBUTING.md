# Contributing

Thanks for your interest in PlanGlade.

PlanGlade is a calm, light-first project workspace for solo users and small teams. The project is pre-public-launch and not production-hardened yet, so contributions should keep the MVP focused and honest.

## Before You Start

- Keep changes small and scoped.
- Prefer issue- or ticket-based work.
- Use existing patterns before adding new abstractions.
- Avoid broad refactors unless a ticket explicitly asks for them.
- Do not add fake features, fake metrics, fake hosted-cloud claims, pricing claims, or enterprise bloat.
- Do not commit secrets, `.env` files, local databases, screenshots with private data, or generated local artifacts.

## Project Values

- Calm, readable UX.
- Simplicity over cleverness.
- Real actions over demo-only buttons.
- Security-first handling of workspace data.
- Existing components, routes, API contracts, and validation patterns first.
- Honest docs about current limits.

## Local Development

Use the setup instructions in `README.md` and `docs/SELF_HOSTING.md`.

The short version is:

- Install with npm.
- Copy `.env.example` to `.env`.
- Use local development auth/storage unless you are deliberately testing Firebase or NextAuth.
- Generate Prisma client and prepare the local SQLite database.
- Start the Next.js dev server.

Use the environment variables documented in `.env.example` and README.

## Validation

Run the checks that match your change.

```bash
npm run lint
npm run typecheck
npm run test
npx prisma validate
```

Run `npm run build` when you touch routes, config, auth, Prisma, runtime behavior, or anything that could affect production builds.

## Pull Requests

Good pull requests:

- Explain the problem and the fix.
- Stay inside the agreed scope.
- List validation that was run.
- Update docs when behavior or setup changes.
- Include screenshots for visible UI changes when useful.
- Avoid unrelated formatting churn.
- Add or update tests for behavior changes.
- Open an issue first for large product, security, data model, or architecture changes.

## Code Style

- Use TypeScript, existing components, existing API contracts, and current workspace-scoped patterns.
- Prefer simple, readable changes over clever abstractions.
- Keep user-facing pages named `Tasks` and `/tasks`; keep `work-items` internal or legacy-only.
- Do not add dependencies unless they clearly reduce complexity.
- Do not ship fake features, fake metrics, fake AI claims, fake pricing, or overclaimed self-hosting status.

No CLA or DCO process is required for this project at this time.
