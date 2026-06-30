# PlanGlade

A calm, open-source workspace for your projects.

PlanGlade is a light-first project management app for solo users and small teams. It helps you capture work quickly, triage an inbox, organize projects, keep notes nearby, and plan around task due dates without turning the app into an enterprise suite.

PlanGlade is not production-ready yet. The current repo is suitable for local development, maintainer review, and early self-hosting work.

Maintained by kalelooz.

## What Is PlanGlade?

PlanGlade is focused on:

- Home: a daily command center for current work.
- Inbox: quick capture and triage.
- Tasks: list and board views over the same task data.
- Projects: project planning, task progress, notes, and calendar context.
- Notes: Markdown notes with project links and task extraction.
- Calendar: a view over real task due dates.
- Settings: workspace preferences, JSON export, and guarded import.

The product direction is intentionally narrow. No current pricing, hosted cloud promise, AI-first positioning, or enterprise reporting surface is part of the current public claim.

## Current Status

PlanGlade is under active development.

Working today:

- Main app navigation: Home, Inbox, Tasks, Projects, Notes, Calendar, and Settings.
- Server-backed reads and writes for the core task/project/note loop.
- Home command center with today, overdue, inbox, project focus, and next-up.
- Inbox capture and triage into real tasks.
- Tasks with list and board views (board is a toggle inside Tasks, not a separate route).
- Project list and Project Home with real context, task progress, and linked notes.
- Notes with Markdown editing, project linking, and task extraction.
- Calendar as a view over task due dates.
- Settings with workspace preferences, JSON export, and a guarded import flow.
- Public landing and getting-started pages for explaining the MVP before sign-in.
- Local development auth mode for running the app without a production identity provider.
- Production-oriented auth paths exist for Firebase and NextAuth, but public self-host guidance is not finalized.
- An early Docker self-host baseline with a standalone app image, SQLite persistence, migrations, and a health check.

Not ready yet:

- A production-hardened generic self-host guide.
- A public hosted cloud offering (not currently planned for release).
- A dedicated public security contact.
- Billing, pricing, admin/team management, or production SLA promises.

## Features Available Today

- Home command center (today's focus, attention required, captured inbox items, project focus, next up, recent notes).
- Quick capture to Inbox.
- Inbox triage into tasks.
- Tasks with list and board views.
- Projects and Project Home (overview, tasks, notes, calendar).
- Project notes and context.
- Notes with Markdown editing and task extraction.
- Calendar over task due dates.
- Settings for workspace preferences, JSON export, and guarded import.

## Roadmap

For more detail, see [ROADMAP.md](./ROADMAP.md).

**Available Today**

- Home
- Inbox
- Tasks (list and board)
- Projects and Project Home
- Notes and project context
- Calendar over due dates
- Settings
- JSON export and guarded import
- Early self-host docs
- Early Docker self-host baseline

**Next**

- Timeline planning view
- Task dependencies
- Recurring tasks
- Stronger self-host path
- Security hardening

**Later**

- Sharing and collaboration surfaces
- Hosted cloud option
- Billing
- Admin/team features
- AI assistance only after the core app is trustworthy

Routes for deferred surfaces (Timeline, Team, Activity, Connections) may exist in the codebase but are gated and redirect to the app home. They are not part of the public MVP product face.

## Screenshots

### Home

![PlanGlade home dashboard](./public/screenshots/planglade-home-desktop.png)

Today, inbox, next work, and notes in one calm starting point.

### Tasks

![PlanGlade tasks list](./public/screenshots/planglade-tasks-desktop.png)

A compact list and planning surface for workspace tasks.

### Project detail

![PlanGlade project detail](./public/screenshots/planglade-project-detail-desktop.png)

Project work, tasks, and notes in one place.

### Calendar

![PlanGlade calendar](./public/screenshots/planglade-calendar-desktop.png)

Due dates shown from the same task source.

## Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 App Router |
| Language | TypeScript |
| UI | React 19, shadcn/ui, Radix primitives |
| Styling | Tailwind CSS v4, CSS custom properties |
| Database | Prisma with SQLite in the current tracked schema |
| Auth | Local dev session, Firebase mode, NextAuth mode |
| Icons | Lucide React |
| Tables | TanStack Table |
| Drag and drop | dnd-kit |
| Markdown | MDXEditor and react-markdown |
| Package manager | npm |

## Requirements

- Node.js 20.9 or newer.
- npm 10 or newer.
- A local `.env` file based on `.env.example`.

Why Node 20.9+: the repo uses Next.js 16, and current Next.js 16 requires Node.js 20.9+.

## Local Development Setup

1. Install dependencies.

```bash
npm install
```

2. Copy the environment example.

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

3. For local development without production auth, set these values in `.env`:

```env
DATABASE_URL="file:../db/custom.db"
PLANGLADE_AUTH_MODE="dev"
NEXT_PUBLIC_PLANGLADE_AUTH_MODE="dev"
PLANGLADE_STORAGE_PROVIDER="local"
PLANGLADE_LOCAL_STORAGE_DIR="storage/local-attachments"
PLANGLADE_STORAGE_SIGNING_SECRET="replace-with-a-random-local-secret"
```


4. Generate Prisma client and create/update the local database.

```bash
npm run db:generate
npm run db:push
```

5. Start the dev server.

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Start from `.env.example`.

Important local/dev variables:

- `DATABASE_URL`: SQLite database path for the current tracked schema.
- `PLANGLADE_AUTH_MODE`: use `dev` for local development.
- `NEXT_PUBLIC_PLANGLADE_AUTH_MODE`: match the server auth mode.
- `PLANGLADE_STORAGE_PROVIDER`: use `local` for local file storage.
- `PLANGLADE_LOCAL_STORAGE_DIR`: local attachment folder.
- `PLANGLADE_STORAGE_SIGNING_SECRET`: signing secret for local attachment URLs.

Production-style variables depend on the auth/storage path:

- Firebase auth/storage: `NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, and Firebase Admin credentials when not using platform-provided credentials.
- NextAuth provider mode: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and provider credentials such as Google or GitHub.
- Email invites: `PLANGLADE_EMAIL_PROVIDER`, `PLANGLADE_EMAIL_FROM`, and `RESEND_API_KEY` if Resend delivery is enabled.
- Invite expiry job: `PLANGLADE_MAINTENANCE_TOKEN`.

Do not commit real `.env` files or secrets.

## Database And Setup Notes

The tracked Prisma schema currently uses SQLite:

```env
DATABASE_URL="file:../db/custom.db"
```

Use `npm run db:push` for local development setup.

`npm run db:reset` exists, but it is destructive. Use it only on an isolated local database when you intentionally want to reset data.

## Self-Hosting Status

PlanGlade has an early local/developer path and an early Docker self-host baseline. It is not production-ready or production-hardened.

Current honest status:

- Local development with SQLite and local file storage is documented above.
- Docker Compose builds the standalone app, persists SQLite in a named volume, and applies checked-in Prisma migrations before startup.
- Docker uses NextAuth for sign-in and Firebase Storage for attachments; both require real external configuration.
- `/api/health` reports basic auth/storage readiness.
- Basic manual backup/restore notes exist in `docs/BACKUP_RESTORE.md`.
- Firebase App Hosting notes exist in `docs/DEPLOYMENT_FIREBASE_APP_HOSTING.md`, but that file is deployment notes, not a final public production guide.
- PostgreSQL, bundled HTTPS/reverse proxy, automated backups, monitoring, and public-internet hardening are not included.

Quick Docker start after replacing every placeholder in `.env`:

```bash
cp .env.example .env
docker compose config
docker compose build
docker compose up -d
curl http://localhost:3000/api/health
```

Do not expose the placeholder configuration publicly. See the full guide for required secrets, auth/storage setup, migrations, updates, HTTPS, backups, and restore testing.

See `docs/SELF_HOSTING.md` for the current self-hosting notes and limitations.

Backup and restore notes are in `docs/BACKUP_RESTORE.md`.

## Useful Commands

```bash
npm run dev
npm run db:generate
npm run db:push
npx prisma validate
npm test
npm run lint
npm run typecheck
npm run build
```

Notes:

- `npm run build` validates auth config before building.
- `npm run start` expects the standalone build output from `npm run build`.
- Full lint/typecheck/build can take longer. For small docs changes, they are not required.

## Contributing, Security, And License

PlanGlade is licensed under AGPL-3.0. See [LICENSE](./LICENSE).

See [CONTRIBUTING.md](./CONTRIBUTING.md), [SECURITY.md](./SECURITY.md), and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

The repo is still pre-public-launch and not production-hardened. Keep contributions small, scoped, and honest about current product limits.

## Documentation Map

- `docs/SELF_HOSTING.md`: local and early Docker self-host setup, limitations, and safety notes.
- `docs/BACKUP_RESTORE.md`: manual Docker/local SQLite and Firebase backup/restore notes.
- `docs/DEPLOYMENT_FIREBASE_APP_HOSTING.md`: Firebase App Hosting notes, not a final generic production guide.
- `docs/QUALITY-GATES.md`: validation expectations for repo work.
