<p align="center">
  <img src="./frontend/public/favicon.svg" width="88" height="88" alt="PlanGlade logo">
</p>

<h1 align="center">PlanGlade</h1>

<p align="center">
  A calm, self-hosted workspace for tasks, projects, notes, schedules, and the connections between them.
</p>

> **Early preview:** PlanGlade is under active development and is not yet
> production-hardened. Use unique secrets, keep tested backups, and review the
> [security policy](./SECURITY.md) before exposing it to the public internet.

<p align="center">
  <a href="./docs/USER_GUIDE.md">User guide</a> ·
  <a href="./backend/docs/SELF_HOSTING.md">Self-hosting</a> ·
  <a href="./CONTRIBUTING.md">Contributing</a> ·
  <a href="./CHANGELOG.md">Changelog</a> ·
  <a href="./SECURITY.md">Security</a>
</p>

<p align="center">
  <a href="./docs/images/home.png">
    <img src="./docs/images/home.png" alt="PlanGlade home view showing attention items, inbox entries, recent notes, and upcoming work" width="100%">
  </a>
</p>

PlanGlade keeps planning direct: capture work quickly, organize it when you are ready, and move between list, board, timeline, calendar, and relationship views without duplicating tasks.

## What you can do

- Capture tasks without leaving your current page.
- Triage incoming work in a dedicated inbox.
- Plan tasks in list, board, timeline, and calendar views.
- Organize work into projects with notes and supporting context.
- Explore relationships between projects, tasks, notes, people, and labels.
- Export workspace data and preview guarded imports.
- Run the complete application on your own infrastructure with SQLite and local attachment storage.

## A closer look

Select any image to open the full-resolution view.

<table>
  <tr>
    <td width="50%">
      <a href="./docs/images/tasks.png"><img src="./docs/images/tasks.png" alt="PlanGlade task list with status, due date, priority, and grouping controls"></a>
      <br><strong>Tasks</strong><br><sub>Filter, group, schedule, and review work from one place.</sub>
    </td>
    <td width="50%">
      <a href="./docs/images/calendar.png"><img src="./docs/images/calendar.png" alt="PlanGlade monthly calendar with scheduled tasks and daily task counts"></a>
      <br><strong>Calendar</strong><br><sub>See deadlines and busy days without losing task detail.</sub>
    </td>
  </tr>
  <tr>
    <td colspan="2">
      <a href="./docs/images/connections.png"><img src="./docs/images/connections.png" alt="PlanGlade connections map showing relationships between workspace records"></a>
      <br><strong>Connections</strong><br><sub>Trace dependencies and relationships across the workspace.</sub>
    </td>
  </tr>
</table>

## Run PlanGlade

### Docker

Generate a local release configuration with unique secrets:

```bash
npm run setup:local
docker compose -f compose.yml config
docker compose -f compose.yml build
docker compose -f compose.yml up -d
```

Open `http://localhost:8080/setup`, enter the setup token printed by
`npm run setup:local`, and create the first owner account. Health endpoints are
available at `/healthz` and `/api/health`.

Local email/password sign-in is enabled by default; OAuth and email delivery
are optional. For an internet-facing installation, set `PLANGLADE_PUBLIC_URL`
to the final HTTPS origin, terminate TLS in front of the app, and back up both
Docker volumes. Read the [self-hosting guide](./backend/docs/SELF_HOSTING.md)
before exposing an installation publicly.

### Local development

```bash
npm run install:all
npm run dev
```

The root command runs database initialization, the internal backend on port
3000, and the only user-facing frontend at `http://127.0.0.1:5173`.

## Architecture

The public repository contains the complete self-hosted product and its user-facing documentation:

```text
planglade/
├── frontend/    React and Vite core application
├── backend/     API, authentication, SQLite, migrations, and attachments
├── compose.yml  Single-origin self-host deployment
└── docs/        User-facing and architecture documentation
```

Docker Compose exposes one application origin on port `8080`; API, authentication, and setup requests are routed to the backend internally.

## Documentation

- [Releases and upgrades](./docs/RELEASES.md)
- [PlanGlade 0.2.0 release notes](./docs/releases/0.2.0.md)
- [User guide](./docs/USER_GUIDE.md)
- [Workspace permissions](./docs/PERMISSIONS.md)
- [Self-hosting](./backend/docs/SELF_HOSTING.md)
- [Backup and restore](./backend/docs/BACKUP_RESTORE.md)
- [Production migrations](./backend/docs/PRODUCTION_MIGRATIONS.md)
- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Changelog](./CHANGELOG.md)
- [Support](./docs/SUPPORT.md)

## Verify a checkout

```bash
npm run check:public
npm run check:ci
npm run check:docs
npm run check:backend-surface --prefix backend
npm run lint
npm run typecheck
npm exec --prefix backend -- prisma validate --schema backend/prisma/schema.prisma
npm test
npm run build
npm run test:e2e:integration --prefix frontend
```

Pull requests and pushes to `main` run these gates on GitHub Actions. The
authenticated browser job uses an isolated temporary SQLite database and local
attachment directory; failure traces are retained for seven days.

## Community and support

- Found a bug? Use the [bug report form](https://github.com/kalelooz/planglade/issues/new?template=bug_report.yml).
- Need help? Read the [support guide](./docs/SUPPORT.md).
- Want to improve PlanGlade? Read the [contributing guide](./CONTRIBUTING.md).
- Found a security issue? Follow the private reporting process in the [security policy](./SECURITY.md).

## License

PlanGlade is available under the [GNU Affero General Public License v3.0](./LICENSE).
