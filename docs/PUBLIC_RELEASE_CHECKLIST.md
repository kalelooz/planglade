# Public Release Checklist

Use this checklist before creating the fresh public PlanGlade repository. Do not push from the current private working branch.

## Public Export Goal

- Create one clean public `main` history.
- Include only public app code, public docs, tests, configuration, license, and GitHub community files.
- Exclude local files, generated output, private planning history, private agent workflow notes, old artifacts, local databases, and logs.
- Keep the public story honest: PlanGlade is useful for local development and early self-host review, but it is not production-ready yet.

## Include

- `src/**`
- `prisma/**`
- `public/**`
- `scripts/**`
- `tests/**`
- `.github/**`
- `.env.example`
- `.gitignore`
- `.dockerignore`
- `.gitattributes`
- `README.md`
- `LICENSE`
- `CONTRIBUTING.md`
- `SECURITY.md`
- `CODE_OF_CONDUCT.md`
- `ROADMAP.md`
- `CHANGELOG.md`
- `docs/SELF_HOSTING.md`
- `docs/BACKUP_RESTORE.md`
- `docs/PUBLIC_RELEASE_CHECKLIST.md`
- package/config files needed to install, lint, typecheck, test, and build

## Exclude

- `.env`
- `.env.*` except `.env.example`
- local database files: `*.db`, `*.sqlite`, `*.sqlite3`
- `db/**`
- `node_modules/**`
- `.next/**`
- `out/**`
- `coverage/**`
- `playwright-report/**`
- `test-results/**`
- `artifacts/**`
- `output/**`
- `logs/**`
- `.logs/**`
- `.playwright-mcp/**`
- `docs/ACTIVE_PLAN.md`
- `docs/archive/**`
- `docs/audits/**`
- `docs/slices/**`
- `docs/sources/**`
- `docs/superpowers/**`
- `docs/artifacts/**`
- `.agents/**`
- `.codex/**`
- `.opencode/**`
- `.zscripts/**`
- `Reddit/**`
- `external/**`
- old local screenshots that are not needed by README/docs
- private SaaS notes and private agent workflow notes
- local machine paths or personal-only notes

## Pre-Push Checks

Run from the clean export directory:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npx prisma validate
npm run build
npm run check:readme-sync
git diff --check
```

Also search the clean export before the first public commit:

```bash
git grep -n -I "OPENAI_API_KEY\\|sk-\\|NEXTAUTH_SECRET\\|AUTH_SECRET\\|GOOGLE_CLIENT_SECRET\\|DATABASE_URL=\\|POSTGRES_PASSWORD=\\|PRIVATE_KEY\\|TOKEN=\\|PASSWORD="
git grep -n -I -E "[A-Z]:\\\\|[A-Z]:/"
```

Expected result: only placeholder documentation/config references, no real secrets, no local private paths.

## Fresh Public Repo Steps

1. Create a separate clean export directory outside this working repo.
2. Copy only the include list above.
3. Run the pre-push checks.
4. Review `git status --short` and `git diff --check`.
5. Initialize a fresh Git repo in the export directory.
6. Commit once as the public initial commit.
7. Add `https://github.com/kalelooz/planglade` as the remote.
8. Push only after the clean export passes review.
