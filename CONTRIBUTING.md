# Contributing

Thanks for your interest in PlanGlade. This guide is for first-time contributors. It covers project status, local setup, how to pick an issue, how to open a pull request, what to validate, and the quality bar for merged work.

## Project Status

PlanGlade is a calm, light-first project workspace for solo users and small teams. The project is **pre-public-launch and not production-hardened**. Treat it as early software: the core task/project/note loop works, but auth, persistence, self-hosting, and security are still maturing.

Contributions should keep the MVP focused and honest. We are not trying to be an enterprise suite.

## Who This Project Is For

- Solo users and small teams who want a fast, clear way to capture and finish work.
- Contributors who care about calm, readable UX and boring, maintainable code.
- People comfortable with TypeScript, Next.js, React, Prisma, and Tailwind.

If you are new to the stack, start with a small docs or validation issue before taking on app code.

## Contribution Philosophy

- **Small and scoped.** One issue per pull request. Keep diffs easy to review.
- **Issue-based.** Work from an open, labeled issue. If you want to add something new, open an issue and discuss it first.
- **Honest.** Do not add fake features, fake metrics, fake hosted-cloud claims, pricing claims, or enterprise bloat. Docs and UI must describe what the app actually does today.
- **Existing patterns first.** Reuse existing components, routes, API contracts, Zod schemas, and workspace guards before inventing new abstractions.
- **No surprise refactors.** Avoid broad refactors, unrelated cleanup, or reformatting that is not part of the issue.

## What Not To Contribute Yet

- Monetization, billing, subscriptions, or seat-based licensing.
- Enterprise, team admin, or heavy permission-management surfaces.
- Assistive or automated "smart" features that imply capabilities the app does not have.
- Unrelated rewrites of working systems.
- New dependencies without a clear, discussed justification.
- Fake demo actions on real product surfaces (every action must work, be disabled, or be removed).

## Security Reporting

Do not report security vulnerabilities in public issues, and never paste secrets, tokens, database URLs, private keys, exploit details, or private user data into an issue or pull request.

If you find a security issue, follow [SECURITY.md](./SECURITY.md). It explains how to report privately (GitHub Private Vulnerability Reporting is preferred).

## Local Setup

You need:

- **Node.js 20.9 or newer.** PlanGlade uses Next.js, which requires this version.
- **npm 10 or newer.** This is the only supported package manager.

Steps:

1. Fork and clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the environment example:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Open `.env` and use the local development values (already shown in `.env.example`): local dev auth mode and local file storage. For the exact variable names and values, see `.env.example` and the Environment Variables section of `README.md`.

5. Generate the Prisma client and prepare the local SQLite database:

   ```bash
   npm run db:generate
   npm run db:push
   ```

6. Start the development server:

   ```bash
   npm run dev
   ```

7. Open `http://localhost:3000`.

The local path uses SQLite by default. You do not need Docker, PostgreSQL, or Firebase for local development. For the self-host Docker path, see `docs/SELF_HOSTING.md`.

## Choosing An Issue

- Start with small, labeled, open issues. Look for `good first issue`, `bug`, or `docs` labels.
- **Ask first** before taking on large product, auth, database, security, architecture, or dependency changes. Open an issue or comment on an existing one to align before coding.
- **One issue per pull request.** If two issues are related, open separate PRs.
- Pull latest `main` before starting so you are not working from stale assumptions.
- If an issue is already assigned or has active discussion, coordinate with the maintainer before starting.

## Branch And Pull Request Workflow

1. Branch from the latest `main`:

   ```bash
   git checkout main
   git pull origin main
   git checkout -b a-short-descriptive-name
   ```

2. Use a descriptive branch name (for example, `inbox-row-overflow-fix`).
3. Keep commits focused. Small, reviewable commits are preferred over one large commit.
4. When you open a pull request, include:
   - A short summary of the problem and the fix.
   - The list of files changed.
   - The validation you ran (see below).
   - Screenshots for visible UI changes, with private data removed.
5. Link the issue with `Closes #X` only when the PR fully resolves it. Otherwise use `Refs #X`.
6. Stay inside the issue scope. Avoid unrelated formatting churn or drive-by fixes; report those as separate issues.

## Validation

Run the checks that match your change.

For app code (routes, components, API, auth, Prisma, runtime behavior, config):

```bash
npm run lint
npm run typecheck
npm test
npx prisma validate
npm run build
git diff --check
```

For docs-only changes (markdown, comments, issue templates), a smaller set is usually enough:

```bash
npm test
git diff --check
```

`npm test` runs the repo's static guards, including checks that docs do not make false claims. Run `npm run build` whenever you touch routes, config, auth, Prisma, runtime behavior, or anything that could affect a production build. If you skip a command, say why in the PR description.

## Code Quality Standards

- **TypeScript.** Use strict typing. Avoid `any` where a real type works.
- **Reuse first.** Use existing components, routes, API contracts, Zod schemas, and services before adding new abstractions.
- **Workspace-scoped data.** All data access must be scoped to the authenticated user's workspace. Never trust client-provided user or workspace identity. Reuse the existing workspace membership and role guards.
- **No secrets.** Do not commit `.env`, local database files, screenshots with private data, or generated local artifacts. `.env` is gitignored on purpose.
- **Safe rendering.** Do not render untrusted HTML without sanitization.
- **No new dependencies.** Do not add a library unless it clearly reduces complexity and fits the existing stack. Discuss it in the issue first.
- **Naming.** Keep user-facing task pages and links named `Tasks` and `/tasks`. Keep `work-items` for internal API or legacy redirect naming only.
- **Real actions.** Every user-facing action must work, be disabled, or be removed. No fake demo buttons on live surfaces.

## Documentation Standards

- Keep docs honest about current state.
- No production-ready, self-host, cloud, or security overclaims.
- When behavior or setup changes, update `README.md` and the relevant `docs/` files in the same PR.
- Avoid internal workflow wording in public docs. Write for contributors and users, not as if narrating to a machine.
- Update screenshots when a visible UI surface changes, and remove private data first.

## Pull Request Review

Good pull requests:

- Explain the problem and the fix clearly.
- Stay inside the agreed scope.
- List the validation that was run.
- Update docs when behavior or setup changes.
- Include screenshots for visible UI changes.
- Add or update tests for behavior changes.
- Avoid unrelated formatting churn.

A maintainer will review. Small, focused PRs usually merge faster.

No CLA or DCO process is required for this project at this time.
