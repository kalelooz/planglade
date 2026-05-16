# FlowBoard - Complete Audit and Roadmap

Last updated: 2026-05-16  
Mode: merged final report from Codex + Claude audits. Planning/audit plus small low-risk UI cleanup.  
Core goal: a plain, simple, easy-to-use, very fast management tool for solo users and small teams.
Execution rule: build incrementally. Every work session starts with a short TODO list, and TODOs are completed and validated one by one before moving to the next item.
Current focus: UI/UX frontend first. Backend, auth, and deeper persistence work wait unless needed to validate a frontend slice.
UI/UX rule: prefer proven libraries, shadcn/Radix primitives, and mature product patterns over hand-designed custom UI. Use MCP/tools when they help validate the browser, inspect docs, or reuse design-system patterns. Commit validated incremental slices locally.

## Brutal Summary

FlowBoard currently looks like a polished product demo, not a functioning product.

The UI has real craft in places: sidebar, drawer, Kanban, notes, calendar, timeline, command palette, charts, dark mode, and shadcn/Radix foundations. But the product logic behind it is mostly fake. Most buttons either mutate isolated local component state, show a toast, or do nothing durable. Refresh the browser and the "product" forgets most actions. That is the biggest problem.

For your stated goal, the product is over-wide and under-real. It tries to show Dashboard, Projects, Timeline, Calendar, My Tasks, Notes, Graph View, Activity Log, Team, Reports, and Settings before the core workflow is trustworthy. A noob solo user does not need ten shiny rooms. They need one reliable loop: capture work fast, organize it later, see what matters today, move tasks, and never lose data.

My recommendation: stop adding new screens. Make the existing core loop real.

## Do Not Delete

The `Reddit/` folder is protected research material. Do not delete it. Treat it as the voice-of-customer folder and read it before product decisions.

The local audit used these project docs and artifacts:

- `README.md`
- `worklog.md`
- `download/README.md`
- `download/mockup.html`
- `download/landing.html`
- existing `AUDIT_AND_ROADMAP.md`
- Reddit JSON exports in `Reddit/`

I did not treat `node_modules` documentation as project docs.

## Current Project Reality

### What Works

- Next.js app starts locally with `npx next dev -p 3000`.
- `npx tsc --noEmit` passes.
- The app has a coherent visual direction: restrained SaaS dashboard, teal accent, compact spacing, useful icons.
- The Kanban board, notes view, timeline/Gantt, calendar, table-like My Tasks, report view, and universal drawer are visibly advanced for a demo.
- The drawer history/breadcrumb idea is good.
- shadcn/ui and Radix give you a solid accessibility/component base.
- The command palette is directionally right for a fast power-user tool.

### What Is Fake or Broken

| Area | Current reality | Why it matters |
|---|---|---|
| Data | Hardcoded mock data in multiple files | No single source of truth |
| Auth | Mock Google login stores hardcoded "Alex Morgan" in `sessionStorage` | Not real auth |
| API | `/api` returns only `{ message: "Hello, world!" }` | Backend is basically empty |
| Database | Prisma exists, but schema has starter `User` and `Post`, not projects/tasks | DB is not connected to product |
| CRUD | Several create/edit/delete flows show toasts but do not persist properly | User trust dies fast |
| Dashboard | Counts are hardcoded, not derived from tasks/projects | Demo numbers can lie |
| Calendar | Starts on May 2026 and parses dates without years | Date logic is brittle |
| Timeline | `TODAY` is hardcoded to May 16, 2026 | It is correct today by accident only |
| Settings | Many settings live only in memory | Refresh loses them |
| My Tasks bulk actions | "assign/move/delete" are demo toasts | Looks functional but is not |
| Reports | Derived from separate mock data | Can disagree with other views |
| Routing | Whole app is one route | No deep links, browser back, shareable task URLs |
| Build | `npm run build` compiles, then fails on Windows because script uses Linux `cp` | Not portable on your machine |
| Lint | `npm run lint` fails | Quality gate is red |
| Type checking | `next.config.ts` has `ignoreBuildErrors: true` | Bad habit; hides future failures |

### Current Grades

| Dimension | Grade | No-BS read |
|---|---:|---|
| Visual design | A- | Strong enough to keep, but not disciplined enough yet |
| Frontend UX | B | Good demo UX, not yet a simple daily workflow |
| Backend/data | F | Basically nonexistent for the actual product |
| Architecture | C- | Modern stack, but state and components are already sprawling |
| Code quality | C | TypeScript passes, lint fails, large god components |
| Security | F | Mock auth, no real permissions, no production model |
| Testing | F | No meaningful test safety net |
| Production readiness | F | Not close; this is a prototype |

## Verification Results

Commands run on 2026-05-16:

- `npm.cmd install`: timed out after 124 seconds, but `node_modules` was created.
- `npm.cmd ls --depth=0`: exits 0, but shows several extraneous packages.
- `npx.cmd tsc --noEmit`: exits 0.
- `npm.cmd run lint`: fails with 14 errors and 3 warnings.
- `npm.cmd run build`: Next compile succeeds, then script fails because `cp` is not recognized on Windows.
- `npx.cmd next dev -p 3000`: app responds at `http://localhost:3000`.

### Lint Failures That Matter

- Root keep-alive scripts use CommonJS `require()` and fail `@typescript-eslint/no-require-imports`.
- `settings-view.tsx` creates `ThemeOption` during render.
- `team-view.tsx` creates `CustomChartTooltip` during render.
- TanStack Table warnings appear in Activity Log, My Tasks, and Project Report due React Compiler compatibility.

This is not catastrophic, but it proves the quality gate is not clean.

## File and Architecture Smell

Largest flowboard files:

| File | Lines | Problem |
|---|---:|---|
| `kanban-board.tsx` | 1342 | God component |
| `universal-drawer.tsx` | 1212 | God component |
| `activity-log.tsx` | 939 | Mock-heavy table logic |
| `project-report.tsx` | 823 | Report logic tied to fake data |
| `graph-view.tsx` | 724 | Complex interaction in one file |
| `notes-view.tsx` | 717 | Own mock notes state |
| `settings-view.tsx` | 675 | Own in-memory settings state |
| `my-tasks-view.tsx` | 636 | Table over static drawer data |

This is not maintainable if you keep building. The code is already at the point where adding features will create bugs because state is duplicated and scattered.

## Local Docs Review

### `README.md`

The README is polished, but it oversells the product as "full-featured". It does admit all data is mock/in-memory, which is honest. The problem is that the rest of the README reads like a finished app. For a planning repo, rewrite it to say:

- This is a frontend prototype.
- Data persistence is not implemented.
- Auth is mock.
- Prisma/API are placeholders.
- The next milestone is real local state and persistence.

### `worklog.md`

Useful as a short implementation log for recent UI fixes. It says a build passed in a different environment/path (`/home/z/my-project`). On this Windows workspace, `npm run build` does not fully pass because the script uses `cp`.

### `download/mockup.html`

This is a strong visual reference for a compact, less bloated UI. It is closer to your "plain/simple/fast" goal than some of the current app screens. Keep it as design reference or move it into a clearly named `research/design/` folder later.

### `download/landing.html`

The landing page positioning is good but premature. You do not need marketing until the product loop works. It says "Project management that respects your brain", which fits the product. Do not let the landing page distract from making the app real.

### Existing `AUDIT_AND_ROADMAP.md`

It had the right blunt direction, but needed updates from current checks, competitor docs, and local docs. It also recommended deleting several folders. I would not delete anything yet in planning mode. First label and archive. Delete only when you have a clean git repo and backups.

## Reddit Research Synthesis

The Reddit folder strongly validates this product direction:

- Users repeatedly ask for simple task/project management.
- Many want fast switching between table, Gantt/timeline, calendar, and board.
- Subtasks are a recurring dealbreaker.
- People hate clunky setup and heavyweight tools.
- Users want enough structure to reduce chaos, not enterprise process theater.
- Solo users care about motivation, seeing progress, and knowing what to do next.
- Small teams care about assigning work without overloading people.
- Notes plus tasks is valuable, but only if capture is low-friction.

Keyword extraction across the Reddit JSONs showed heavy emphasis on:

- Views: calendar, Gantt, timeline, board, table.
- Notes/docs/knowledge.
- Simplicity, clunkiness, learning curve.
- Subtasks/checklists/nesting.
- Team assignment/collaboration.
- Price/free/self-hosting.

The product should not become Jira. The winning lane is: Memos-speed capture + Trello-simple board + Asana-style task/subtask clarity + Plane-style open-source project structure.

## Competitor Gap Analysis

Sources checked:

- Memos features/docs: https://usememos.com/features and https://usememos.com/docs
- Memos GitHub: https://github.com/usememos/memos
- Plane docs/site/GitHub: https://docs.plane.so, https://plane.so/open-source, https://github.com/makeplane/plane
- Trello support docs: https://support.atlassian.com/trello/docs/trello-views/
- Asana help docs: https://help.asana.com/s/article/project-customization-and-views
- Jira support docs: https://support.atlassian.com/jira-software-cloud/docs/create-or-remove-dependencies-on-your-roadmap/
- Odoo Project features: https://www.odoo.com/app/project-features
- Zoho Projects features/help: https://www.zoho.com/projects/features.html and https://help.zoho.com/portal/en/kb/projects/tasks/tasks/task-dependencies
- Leantime GitHub: https://github.com/Leantime/leantime
- Vikunja GitHub/docs: https://github.com/go-vikunja/vikunja and https://vikunja.io/docs

### Memos

What they do right:

- Instant capture.
- Timeline-first home.
- Markdown-native writing.
- Self-hosted ownership.
- SQLite/Postgres/MySQL options.
- Tiny mental model: open, write, done.
- MIT license, easier to borrow from legally.

What we lack:

- No always-ready capture box.
- Notes are a separate module, not the product's heartbeat.
- No true data ownership yet.
- No simple self-host story.

What to implement:

- Global quick capture that accepts a note or task in one line.
- Markdown notes with task checkboxes that can become tasks.
- Local-first persistence before multi-user backend.

### Plane

What they do right:

- Open-source Jira/Linear/Monday/ClickUp alternative.
- Work items, cycles, modules, views, pages, analytics.
- Self-hosting is a first-class story.
- Features can be toggled off to reduce clutter.
- Board, spreadsheet/table, list, Gantt, and other views.
- Project docs/pages live beside work.

What we lack:

- No true work item model.
- No cycles/modules/milestones.
- No saved views.
- No intake/triage.
- No real self-host deployment.
- No permission model.

What to implement carefully:

- Work item model with type, status, priority, owner, dates, tags, project.
- Optional modules/milestones, not visible by default.
- Saved views once filters exist.
- Do not copy Plane's complexity. Copy its structure and progressive disclosure.

License warning: Plane is AGPL-3.0. Studying patterns is fine. Copying code into a distributed product creates obligations. Memos is safer as a base if you want permissive licensing.

### Trello

What they do right:

- Board/list/card is instantly understandable.
- Cards support checklists, labels, members, dates, attachments, custom fields, automation.
- Premium views include table, timeline, calendar, dashboard, map.
- Workspace views can show cards across boards.

What we lack:

- Our board exists, but cards are not backed by durable data.
- No real card model with attachments/comments/activity.
- No cross-project workspace table/calendar that stays consistent.

What to implement:

- Keep Kanban simple.
- Add reliable checklists/subtasks.
- Add table view with inline editing.
- Add global "All Tasks" view across projects.

### Asana

What they do right:

- Project views: List, Board, Gantt, Timeline, Workflow, Dashboard, Messages, Files, Calendar.
- Saved tabs/views.
- Strong subtasks: subtasks act like independent tasks with fields.
- Timeline handles dependencies, unscheduled tasks, drag scheduling, sorting/filtering.
- My Tasks is a serious personal work hub.

What we lack:

- My Tasks is visual only; bulk actions are fake.
- No saved views.
- No real subtask-as-task model.
- No dependency scheduling.

What to implement:

- Make My Tasks the solo user's home.
- Treat subtasks as lightweight first, but design data model so they can become full tasks later.
- Saved filters: Today, Upcoming, Overdue, Blocked, No Date, Assigned to Me.

### Jira

What they do right:

- Dependency links are explicit.
- Work item linking supports blockers and sequencing.
- Strong workflows, issue types, custom fields, filters, reports.

What we should not copy:

- Jira's process-heavy UX.
- Admin-heavy configuration.
- Enterprise vocabulary on day one.

What to implement:

- A simple "Blocked by" / "Blocking" relation.
- A clear blocked badge on cards and timeline.
- Optional workflow customization later.

### Odoo

What they do right:

- Kanban, Gantt, list, calendar-like planning, timesheets, milestones, recurring tasks, dependencies, chatter.
- Fast task creation from Kanban using text shortcuts.
- Time tracking is integrated with tasks/subtasks.

What we lack:

- No time tracking.
- No recurring tasks.
- No milestone concept.
- No inline shortcut creation.

What to implement:

- Lightweight timer per task.
- Manual time logs.
- Recurring tasks for solo routines.
- Text shortcuts in quick capture, like `#project @person !high due:tomorrow`.

### Zoho Projects

What they do right:

- Tasks, subtasks, milestones, Gantt, dependency types, timesheets, issue tracking, documents, reports.
- Dependencies can be managed from List, Gantt, and Kanban.
- Global timer widget can be accessed from anywhere.

What we lack:

- No global timer.
- No task duration.
- No dependency policy.
- No real reports.

What to implement:

- Global running timer button in header.
- Duration/start/end dates in data model.
- Dependency status: waiting for / blocking.
- Basic reports generated from real tasks only.

### Leantime

What they do right:

- Explicitly targets non-project managers.
- Built with ADHD, autism, and dyslexia in mind.
- Goal-focused project management, not enterprise ceremony.

What we lack:

- Product philosophy for overwhelmed users is not encoded in the app yet.
- No onboarding path that helps a nontechnical user create their first useful workspace.

What to implement:

- One-screen onboarding: create first project, add 3 tasks, choose default view.
- Reduce labels and jargon.
- Make "what should I do next?" obvious.

### Vikunja

What they do right:

- Open-source, self-hostable task app.
- List, Kanban, Gantt, table.
- Labels, relations, recurring tasks, API-first.
- Web/desktop/mobile direction.

What we lack:

- Local-first task engine.
- Recurring tasks.
- Task relations that work everywhere.

What to implement:

- Start with a task engine before adding more dashboards.
- Design the API/data model early, even if UI uses local storage first.

## Product Strategy

### The Product You Should Build

Build "Memos for work management":

- Fast capture first.
- Tasks and notes are connected.
- Every task can be seen as board, table, calendar, or timeline.
- Solo user first.
- Team features are optional, not everywhere.
- Self-hostable and exportable.
- No enterprise setup required.

### Product Rule

If a feature does not help one person know what to do next, capture work faster, or avoid losing context, it waits.

### Feature Priority Matrix

#### Phase 1: Perfect functioning frontend

All features should work in client state first. The goal is not backend yet. The goal is that the UI behaves like a real product during a user session and survives refresh via local persistence.

| Feature | Current status | Priority |
|---|---|---|
| Kanban board drag/drop | Exists locally | Polish after store |
| Task create/edit/delete | Partly fake/scattered | Critical |
| Project create/edit/delete | Partly fake/scattered | Critical |
| Subtasks/checklists | Exists locally | High |
| My Tasks table | Exists, actions fake | Critical |
| Calendar | Exists, date logic brittle | High |
| Timeline/Gantt | Exists, hardcoded current date | High |
| Notes/Markdown | Exists | High |
| Quick Capture | Missing | Critical |
| Inbox | Missing | Critical |
| Command palette | Exists, not real enough | High |
| Universal drawer | Exists | Keep and connect to store |
| Dark mode/themes | Exists | Keep, but not a priority |
| CSV import/export | Exists in demo form | Keep later, not P0 |

#### Phase 2: Local persistence

| Feature | Priority |
|---|---|
| Zustand store with one schema | Critical |
| localStorage or IndexedDB persistence | Critical |
| JSON workspace export/import | High |
| Reset demo/sample data | High |
| Real saved settings | Medium |
| Offline-friendly behavior | Medium |

#### Phase 3: Real backend/self-hosting

| Feature | Priority |
|---|---|
| Replace starter Prisma schema with PM schema | Critical |
| SQLite first | Critical |
| Server Actions/API CRUD | Critical |
| Real auth | High |
| Multi-user/team support | Medium |
| Docker/self-host docs | Medium |
| Backup/restore workflow | High |

## Must-Fix Product Logic

### P0: Make the demo honest and functional

1. Centralize all app data into one Zustand store.
2. Store projects, tasks, notes, members, activity, settings in one schema.
3. Every screen reads from the same store.
4. Create/edit/delete task actually changes state.
5. Create/edit/delete project actually changes state.
6. Dragging a task updates task status in the store.
7. My Tasks bulk delete actually deletes.
8. Dashboard numbers are derived from the store.
9. Calendar and timeline read the same dates from tasks.
10. Reports are generated from the same tasks.

Done means: after creating a task, it appears in Kanban, My Tasks, Calendar/Timeline if dated, Dashboard counts, and Report without duplicated code.

### P1: Persist locally

Use localStorage or IndexedDB before a real backend. For your current goal, this is enough to make the frontend feel real.

1. Persist all Zustand data.
2. Add JSON export/import for full workspace backup.
3. Add reset demo data.
4. Add sample workspace restore.
5. Keep the app usable offline.

Do this before real auth.

### P2: Build the killer workflow

1. Quick Capture bar.
2. My Day / Focus view.
3. Table view with inline editing.
4. Saved views/filters.
5. Real subtasks/checklists.
6. Basic blockers/dependencies.
7. Global search that searches tasks, projects, notes, comments.

### P3: Backend only after frontend logic is real

1. Replace starter Prisma schema with real PM schema.
2. SQLite first.
3. Server Actions or API routes for real CRUD.
4. Auth only when persistence model works.
5. Self-host Docker Compose.
6. Backup/restore docs.

## Suggested Data Model

Minimum viable data model:

```ts
Workspace
Project
Task
Subtask
Note
Member
Activity
TimeEntry
SavedView
Settings
```

Minimum task fields:

```ts
id
title
description
projectId
status
priority
assigneeId
startDate
dueDate
tags
subtasks
blockedByTaskIds
noteIds
createdAt
updatedAt
completedAt
estimateMinutes
timeSpentMinutes
```

Do not build a real backend until this model works in the frontend store.

## UI/UX Direction

### Keep

- Compact sidebar.
- Universal drawer.
- Command palette.
- Dark mode.
- Kanban.
- Calendar.
- Timeline.
- Notes with Markdown.
- Report view, but only after it is real.

### Cut or Hide for Now

- Graph View: cool, but not core. Hide behind "More" or Labs.
- Team page: not needed for solo MVP.
- Activity Log: keep only if actions are real.
- Project Report: hide until generated from real data.
- Landing page: not relevant until app works.

### Add

- Quick capture input on dashboard and command palette.
- First-run onboarding.
- My Day as default solo home.
- Empty states that help the user act.
- Inline task editing in table view.
- Real mobile task list view.

### Navigation Recommendation

Current sidebar has too many equal-weight items. For solo/small teams:

- Today
- Inbox
- Projects
- Tasks
- Notes
- Calendar
- More
- Settings

Put Graph, Activity, Reports, Team under More until they earn top-level placement.

## Cleanup Guidance

Do not delete product/project files yet. First create git, commit current state, then clean. The only files safe to delete now are the temporary split audit leftovers after this final merged report exists.

Likely cleanup later:

- Remove duplicate keep-alive scripts.
- Fix Windows-hostile shell scripts.
- Pick one package manager. I recommend npm for now because `package-lock.json` exists and the machine has npm.
- Remove unused dependencies after confirming usage.
- Move `download/` into `research/design/` or `archive/generated/`.
- Move or archive scratch design files instead of blindly deleting them.
- Fix `.env`: current DB path points to `/home/z/my-project/db/custom.db`, which is wrong on Windows.
- Set `ignoreBuildErrors: false`.
- Fix `npm run build` to be cross-platform.
- Add `.git` repo before any destructive cleanup.

Never delete `Reddit/`.

Potential cleanup candidates after git/backups:

| Candidate | Why | Safer action |
|---|---|---|
| duplicate keep-alive/server scripts | Multiple scripts solve the same dev-server problem | Keep one cross-platform command, archive the rest |
| Linux-only `.sh` scripts | Current user workspace is Windows | Replace with npm scripts or cross-platform Node scripts |
| `bun.lock` vs `package-lock.json` | Two package managers create install confusion | Pick npm unless there is a strong reason for Bun |
| unused dependencies | Bigger install and mental bloat | Remove only after `rg` confirms no usage |
| `download/` | Scratch/generated HTML references | Move to `research/design/` if still useful |
| `upload/` | Looks empty/stale | Delete only after git snapshot |
| `Caddyfile` | Deployment config not relevant yet | Archive until deployment decision |

## Open-Source Repos Worth Studying

| Repo | Why it matters | License warning |
|---|---|---|
| https://github.com/usememos/memos | Best base inspiration: quick capture, Markdown, self-host, simple mental model | MIT, safest to borrow from |
| https://github.com/makeplane/plane | Modern open-source PM: work items, cycles, modules, pages, views | AGPL-3.0, be careful copying code |
| https://github.com/Leantime/leantime | Non-project-manager focus, neurodivergent-friendly positioning | AGPL-3.0 |
| https://github.com/go-vikunja/vikunja | Self-hosted task engine with list/Kanban/Gantt/table, relations, recurring tasks | Check license before reuse |
| https://github.com/mattermost-community/focalboard | Open-source Trello/Notion/Asana alternative patterns | Check project status before relying on it |

If you literally download and use repos, do not blindly copy code. Licenses matter. Use Memos as the cleanest inspiration/base candidate because it is MIT and matches your speed/simplicity instinct.

Study order:

1. Memos: use as the product-feel reference and possible permissive base inspiration.
2. Focalboard/AppFlowy/Kanboard/Vikunja: study multi-view task models and local/self-host patterns.
3. Plane: study modern PM structure, but treat AGPL code carefully.
4. Leantime: study non-project-manager positioning and neurodivergent-friendly framing.
5. Huly/Odoo/Zoho/Jira: study feature ideas, not default UX.

Competitive positioning:

| Competitor | Their weakness for your target user | FlowBoard edge to aim for |
|---|---|---|
| Trello | Simple board, weak subtasks/multi-view depth | Trello clarity plus real subtasks, table, calendar, timeline |
| Jira | Powerful but heavy, slow, admin-minded | Useful blockers/dependencies without Jira process burden |
| Asana | Great My Tasks, but enterprise layers creep in | Asana-like personal hub with less setup |
| Notion | Flexible but setup-heavy | Works immediately without building your own system |
| ClickUp | Too much everything | Smaller tool that does core work perfectly |
| Linear | Excellent speed, developer/team bias | Simpler for nontechnical solo/small teams with calendar/timeline |
| Plane | Strong open-source PM, still concept-heavy | Solo-first, less vocabulary, fewer required concepts |
| Memos | Brilliant capture, not PM | Memos speed plus task/project structure |

Tagline directions:

- Project management that respects your time.
- Fast enough for solo, ready for small teams.
- Open, simple, and built around what matters today.
- Memos-fast work management.

## UI/UX Audit Addendum - 2026-05-16

This section is focused on the frontend experience only. The target product is not "another Jira." The target should be a fast, calm, low-learning-curve tool for one person or a small team: quick capture, visible priorities, simple organization, and zero fake confidence.

### Design Direction

Recommended aesthetic: quiet productivity OS.

That means:

- More Memos than Jira: capture-first, readable, personal, fast.
- More Trello than Odoo: obvious board mechanics, low setup.
- Use Asana-style "My Tasks" as the personal home base.
- Keep Plane/Jira/Odoo/Zoho complexity behind progressive disclosure, not in the first screen.

DFII score: 11/15.

- Aesthetic impact: 3/5. It should be calm, not flashy.
- Context fit: 5/5. Solo users and small teams need clarity more than decoration.
- Implementation feasibility: 5/5. Current stack can support this.
- Performance safety: 4/5. Less chrome and fewer fake views should make it faster.
- Consistency risk: -6. Current components already diverge in spacing, headings, and state behavior.

### Competitor and Best-Practice Research

Sources checked online on 2026-05-16:

- Memos: [Features](https://usememos.com/features)
- Jira: [Features](https://www.atlassian.com/software/jira/core/features)
- Asana: [Features](https://asana.com/en-gb/features), [Quick start guide](https://help.asana.com/s/article/quick-start-guide-to-asana), [Navigation guide](https://help.asana.com/s/article/navigating-asana?language=en_US)
- Trello: [Advanced features](https://trello.com/en-US/guide/enterprise/advanced-features), [Automation](https://trello.com/en-US/butler-automation)
- Plane: [Open source features](https://plane.so/open-source), [Docs](https://makeplane-plane.mintlify.app/)
- Odoo: [Project app](https://www.odoo.com/app/project?msockid=036731cf61ab6d251e912715603c6c81)
- Zoho Projects: [Features](https://www.zoho.com/projects/features.html), [Blueprint help](https://help.zoho.com/portal/en/kb/projects/settings-in-zoho-projects/automation/task-automation/articles/blueprint-projects)
- Baymard: [UX design principles](https://baymard.com/learn/ux-design-principles), [Button design](https://baymard.com/learn/button-design)
- Material Design: [Responsive UI](https://m1.material.io/layout/responsive-ui.html)
- Nielsen Norman Group: [Menu design checklist](https://media.nngroup.com/media/articles/attachments/PDF_Menu-Design-Checklist.pdf), [Visual design principles](https://media.nngroup.com/media/articles/attachments/Principles_Visual_Design-Letter.pdf)

What competitors do right:

| Product | What to copy | What not to copy |
|---|---|---|
| Memos | Instant capture, self-hosting, ownership, simple notes, PWA/offline direction | Turning the whole PM app into only notes |
| Trello | Board clarity, obvious drag/drop, cards as the main object, low learning curve | Board-only limits, automation UI too early |
| Asana | My Tasks, Inbox, global search, clear navigation, task comments/subtasks | Too many enterprise layers for a solo user |
| Plane | Open-source credibility, issues/cycles/modules/pages, multiple views | Developer-heavy language and too many concepts on day one |
| Jira | Blockers, dependencies, status workflows, templates | Admin-heavy setup, terminology, and configuration burden |
| Odoo | Kanban/list/gantt/calendar/time tracking under one suite | ERP sprawl and business-app heaviness |
| Zoho Projects | Work breakdown structure, universal add, multiple task views, automation blueprints | Dense enterprise settings and feature maze |

The pattern is obvious: successful tools expose one simple daily workflow, then let advanced users reveal more. FlowBoard currently exposes too much at once before the basic loop is real.

### Current UI Verdict

The UI is visually decent but strategically confused.

It has the surface of a polished SaaS dashboard, but the actual experience is demo-heavy. A nontechnical user will see many options, click around, and quickly learn that some things are fake, local-only, or inconsistent. That is worse than having fewer features.

Harsh truth: the app currently feels like a portfolio demo of project-management screens, not a trustworthy daily tool.

### Critical UX Problems

| Severity | Problem | Evidence | Fix |
|---|---|---|---|
| Critical | Too many first-level destinations | Sidebar exposed Dashboard, Projects, Timeline, Calendar, My Tasks, Notes, Graph View, Activity Log, Team, Settings | Keep primary nav to Dashboard, Projects, My Tasks, Notes, Calendar; put Timeline/Graph/Activity/Team under Advanced |
| Critical | Fake actions look real | Create/import/export/move/bulk/report actions exist before durable data | Add visible demo labels or make actions persist before polishing more |
| Critical | No trusted "capture inbox" | Memos/Trello/Asana all support fast entry; current quick create is scattered | Add global Quick Capture that creates an Inbox task/note in one input |
| High | Dashboard is not a daily cockpit | It repeats "Dashboard", shows hardcoded KPIs, and has team metrics for solo users | Replace with Today, Overdue, Inbox, Recently changed, and one primary capture input |
| High | Hidden Notes form was still exposed | Browser accessibility snapshot showed hidden Title/Tags/Body/Create/Cancel before New Note was clicked | Fixed in code: form is not rendered until opened |
| High | Mobile layout can become overwhelming | Calendar becomes a long agenda; drawer can dominate the small screen | Mobile should default to Today/My Tasks, with calendar as secondary |
| High | Navigation labels are product-generic | "Graph View" and "Activity Log" sound like tools for admins, not daily users | Rename or hide until real use cases exist |
| High | Visual hierarchy is too even | Cards, badges, icons, and headings compete; little says "do this next" | One primary action per screen; stronger distinction between primary/secondary/tertiary actions |
| Medium | Spacing is comfortable but sometimes too airy | Dashboard wastes large areas while showing dense tables elsewhere | Use compact enterprise spacing: 12/16/24 rhythm, fewer nested cards |
| Medium | Color system is too teal-dependent | Teal dominates plus many random status colors | Keep teal for selection/brand only; status colors reserved for priority/state |
| Medium | Duplicate page headings | Header H1 plus inner H2 often repeat the same title | Header should show location; content should show action/context |
| Medium | Command palette exists but is not central enough | Search is hidden on mobile and only opens a fake/search-like palette | Make command palette a real fast-create/search tool later |

### Screen-by-Screen UI/UX Audit

This section merges the useful Claude visual audit notes with the Codex browser/source audit. The point is not to make the app prettier. The point is to make it easier to understand, faster to use, and harder to mistrust.

#### Global Shell

| Issue | Severity | Fix |
|---|---|---|
| Sidebar still exposes too many concepts for a solo-first MVP | High | Primary: Home, Inbox, Projects, My Tasks, Notes, Calendar. Advanced: Timeline, Graph, Activity, Team, Reports, Settings. Current code has already started this split. |
| Header wastes daily-use space | Medium | Replace wide fake search field with compact command/search trigger plus one real `+ New` action. |
| Notification bell is fake and distracting | High | Hide it until notifications are real. Fake alerts teach users not to trust the app. |
| Theme toggle is daily chrome but not a daily workflow action | Low | Move it to Settings or keep it as a small secondary icon only after the core create/search flow is stronger. |
| Page titles are duplicated | High | Keep one page title. The content area should start with the work, not repeat the same label. |
| `Satoshi` is declared but not loaded | Medium | Either load it properly via `next/font`/font files or intentionally use Geist/Inter/system. Silent fallback makes design inconsistent. |
| Warm sidebar neutral and cool content neutral clash | Medium | Use one neutral temperature. Recommendation: keep the cool teal-based neutral across app shell and content. |

#### Dashboard / Future Home

| Issue | Severity | Fix |
|---|---|---|
| KPI numbers are hardcoded and internally inconsistent | Critical | Dashboard counts must derive from the same task/project store. |
| Team Members card does not belong in solo-first Home | High | Hide team metrics until team mode is enabled. |
| Vanity metrics dominate before actionable work | High | Replace with Today, Overdue, Inbox, Blocked, Recently changed. |
| Project progress bars are too thin | Low | Use at least 6-8px height if progress is meant to be read visually. |
| My Tasks card titles truncate too aggressively | Medium | Allow two-line titles before truncation. Scanning beats perfect card height. |
| No empty-state/onboarding path | High | First run should guide: create first project, add first task, choose default view. |

#### Projects / Kanban

| Issue | Severity | Fix |
|---|---|---|
| Board works visually but is not backed by durable data | Critical | Wire drag/create/edit/delete to one central store before more polish. |
| Project selector and board area need clearer separation | Medium | Use subtle background/border distinction so users understand selection vs work area. |
| Column menus are always visible clutter | Low | Show column menu on hover/focus only. |
| Cards show too much metadata at once | Medium | Front of card: title, priority/status, one tag, due signal if urgent. Drawer/hover: assignee, subtasks, blockers, comments. |
| `View Report` from board breaks context | Low | Put report under project details or advanced actions, not main board header. |
| No WIP limits or overload signal | Low | Add later only if useful; do not overbuild now. |

#### My Tasks / Table

| Issue | Severity | Fix |
|---|---|---|
| This is one of the strongest screens, but bulk actions are fake | Critical | Bulk complete/move/delete must actually mutate state or be disabled/labeled demo. |
| 45 flat tasks is too much for default view | Medium | Group by Today, Overdue, Upcoming, No Date, or Project. |
| No inline editing | Medium | Add lightweight inline edit for title, status, priority, due date after central state exists. |
| Too many colored elements per row | Low | Reduce badge noise; reserve color for priority/overdue/status. |
| Filter controls can look passive | Low | Use clear border/background and active filter chips when filters apply. |

#### Notes

| Issue | Severity | Fix |
|---|---|---|
| Notes are good directionally, Memos-inspired, but isolated from tasks | High | Let notes link to tasks and let checkbox lines become tasks later. |
| No notes search | High | Add local search in the notes pane. Notes without search rot fast. |
| No obvious edit mode in preview | Medium | Add Edit/Preview toggle or inline editor. |
| Note list is narrow and truncates useful titles | Medium | Use wider default panel or two-line item layout. |
| Tag chips look filterable but do not filter | Low | Either make tags filter or make them visually less interactive. |
| Hidden new-note form was exposed to accessibility tree | Fixed | Code now renders the form only when opened. |

#### Calendar

| Issue | Severity | Fix |
|---|---|---|
| Month view truncates task names too hard | High | Show at least two or three useful words before truncation. |
| No week view | Medium | Week view is more useful for actual planning than month view. |
| Empty days do not invite creation | Low | Add subtle hover/focus add affordance once create flow is real. |
| Calendar data is demo-date fragile | Critical | Dates must come from real task fields with years and real parsing. |

#### Timeline / Gantt

| Issue | Severity | Fix |
|---|---|---|
| Hardcoded today/date range makes the view brittle | Critical | Use current date and real task start/due dates. |
| No strong today marker | High | Add vertical today line and auto-scroll/anchor near it. |
| Bars are mostly same color | Medium | Color by project or status, not random decoration. |
| Task labels clip | Medium | Improve label placement or show hover/detail while preserving density. |
| Dependencies are not visually represented | Low | Add only after real blocker/dependency model exists. |

#### Settings

| Issue | Severity | Fix |
|---|---|---|
| Settings are mostly local/fake | High | Persist settings or label them as demo. |
| Save behavior is inconsistent | Medium | Pick one model: autosave with confirmation or one global Save button. |
| Some settings do not belong before core product works | Medium | Trim settings until persistence/auth/product model exists. |

### Systematic UI Rules to Apply

| Area | Rule |
|---|---|
| Spacing | Use a strict 4/8px rhythm: 4, 8, 12, 16, 24, 32, 48. No ad-hoc page gaps. |
| Cards | 16px inner padding for normal cards, 12px for dense cards, no card-inside-card layouts unless repeated item framing is required. |
| Header | Fixed 56px shell. One primary action, compact search/command trigger, no fake notification noise. |
| Sidebar | 36px nav rows, clear primary/advanced grouping, settings at bottom. |
| Typography | Body 13-14px, labels 12px, page title 18-20px, section titles 14-16px in dense product surfaces. |
| Badge size | Avoid 10px text for important information. Use 11-12px minimum. |
| Status colors | Gray = backlog/inactive, blue/teal = active/current, amber = review/warning, red = overdue/blocking, green = done. Use the same mapping everywhere. |
| Buttons | One primary action per surface. Secondary actions should not fight the primary action. Destructive actions need distinct confirmation/visual treatment. |
| Density | Default comfortable. Add compact mode later for power users; do not make the default feel like enterprise software. |

### UI/UX Fix Priority

P0 - trust and usability killers:

1. Remove duplicate page titles.
2. Fix dashboard KPI mismatches.
3. Add real Home/Today/Inbox flow.
4. Add global Quick Capture.
5. Hide fake notification bell.
6. Make fake buttons either real, disabled, or honestly marked as demo.
7. Fix font loading.
8. Unify neutral color temperature.
9. Add today marker to Timeline.
10. Fix Calendar title truncation.

P1 - polish and best practice:

1. Add global `+ New` action.
2. Add Notes search.
3. Reduce Kanban card metadata.
4. Add consistent spacing tokens/classes.
5. Add visible empty states and first-run onboarding.
6. Make filters visibly active.
7. Add Week view to Calendar.
8. Add inline editing to My Tasks after central store exists.

### Fixes Applied Now

Small code changes made during this audit:

- `src/components/flowboard/app-sidebar.tsx`
  - Split navigation into `primaryNavItems` and `advancedNavItems`.
  - Primary nav is now Dashboard, Projects, My Tasks, Notes, Calendar.
  - Timeline, Graph View, Activity Log, and Team are now grouped under Advanced.
  - This keeps the features available while reducing first-look cognitive load.

- `src/components/flowboard/notes-view.tsx`
  - The inline New Note form is now conditionally rendered only when opened.
  - Before this, hidden form controls were still present in the accessibility/page text tree.

Verification:

- `npx.cmd tsc --noEmit` passes after these changes.
- Browser snapshot confirms the Notes form no longer appears until "New Note" is clicked.
- Browser snapshot confirms sidebar primary/advanced grouping is visible.

### Recommended First-Screen Redesign

The first screen should not be a generic dashboard. It should be "Today" or "Home".

Recommended Home layout:

1. Quick Capture input at the top.
   - Placeholder: "Add a task, note, or reminder..."
   - Enter saves instantly.
   - `#tag`, `@person`, `due Friday`, and `/project` can come later.

2. Left/main column: Today.
   - Due today.
   - Overdue.
   - Inbox items not yet organized.
   - One-click complete.

3. Right column: Projects needing attention.
   - Only show blocked, overdue, recently changed, or nearing deadline.
   - Do not show vanity KPIs unless they drive action.

4. Lower section: Recent notes/activity.
   - Personal and lightweight, Memos-style.
   - Activity feed should be optional for solo mode.

What to remove from default Home:

- Team Members card.
- Hardcoded "Completed this week" vanity metric.
- Generic "Active Projects" metric unless clicking it shows the exact filtered list.
- Duplicate Dashboard heading.

### Navigation IA Recommendation

Default nav:

- Home
- Inbox
- Projects
- My Tasks
- Notes
- Calendar

Advanced/hidden until needed:

- Timeline
- Reports
- Graph
- Activity
- Team
- Settings

Why: NN/g menu guidance favors visible, clear, concise, familiar labels and current-location cues. Baymard emphasizes consistency and clear navigation paths. Your current sidebar is visible, which is good, but it exposes advanced nouns too early.

### Typography, Color, and Spacing Rules

Use these as hard rules:

- One H1 per page from the global header.
- Content section titles should usually be 14-16px, not another page title.
- Body text should stay 13-14px in dense work surfaces.
- Buttons:
  - Primary: one per screen area.
  - Secondary: outline/ghost.
  - Destructive: never hidden behind the same visual weight as safe actions.
  - Mobile tap target should be at least about 44px high or have a comparable hit area.
- Spacing:
  - 8px for tight related items.
  - 12-16px for card internals.
  - 20-24px between major groups.
  - Avoid nested cards unless the inner object is an actual repeated item.
- Color:
  - Teal = selected/current/brand.
  - Red = overdue/blocking/destructive.
  - Amber = warning/at risk.
  - Green = done/healthy.
  - Gray = inactive/low priority.
  - Avoid giving every project/status a random bright color unless it improves scanning.

### What Not To Build Yet

Do not prioritize these until the core loop is real:

- Graph View polish.
- Project Report polish.
- Team management polish.
- Advanced automation builder.
- Deep dashboards/charts.
- More landing-page visuals.
- More settings.

These are distractions for the stated goal.

### UI/UX Roadmap

#### Phase 1: Make the app feel simple

- Rename Dashboard to Home.
- Add Inbox as a first-class view.
- Add Quick Capture to Home and the header/command palette.
- Hide or demote advanced views.
- Remove duplicate titles.
- Add honest empty/demo states.

Done when:

- A new user can add one task in under 5 seconds.
- The user can see what is due today without opening Projects.
- No fake action appears real unless it actually changes state.

#### Phase 2: Make the app feel reliable

- Centralize tasks/projects/notes into one store.
- Make create/edit/move/delete update every view.
- Persist locally.
- Make dashboard numbers derived, not hardcoded.
- Make search real.

Done when:

- Create a task, refresh, it remains.
- Move a task on board, My Tasks and Calendar update.
- Search finds the new task/note/project.

#### Phase 3: Make it feel fast

- Reduce initial JS by lazy-loading advanced views.
- Keep Home, My Tasks, Projects, and Notes fast.
- Avoid heavy charts/graph/report code on first load.
- Add keyboard-first creation and navigation.

Done when:

- First useful screen feels instant locally.
- Advanced screens do not slow the daily workflow.

### Product Rule Going Forward

Every feature must answer one of these:

- Does it help me capture work faster?
- Does it help me know what matters now?
- Does it help me organize without friction?
- Does it prevent missed work?
- Does it reduce repeated manual effort?

If not, it waits.

## 4K Design Quality Plan

This is the design-quality problem in plain language: FlowBoard currently has decent components, but it does not have a premium visual system. It feels like a 144p stream because the composition, typography, spacing, screenshots, and product story are not sharp enough. Plane and Memos feel closer to 4K because every visible decision supports one clear identity.

### Why It Feels Cheap

| Problem | What the user feels | Why competitors feel better |
|---|---|---|
| Generic SaaS layout | "I have seen this template before" | Plane/Memos have a clear product personality |
| Weak product proof | "This looks like a mockup" | Competitors show real product surfaces with confidence |
| Too many equal-weight elements | "Where do I look?" | Better products create one obvious focal point |
| Fake/demo UI visible | "This is unfinished" | Mature products hide scaffolding and show trust signals |
| Typography not locked | "Something feels blurry/off" | Premium UIs use deliberate font loading, sizes, weight, and rhythm |
| Soft spacing rules | "It feels assembled" | Better UIs use consistent spacing grids |
| Mixed color temperatures | "It feels slightly mismatched" | Better UIs have one controlled color system |
| Generic icon/card styling | "This is a dashboard kit" | Premium UIs use fewer, stronger visual patterns |
| No memorable interaction | "It works like any demo" | Great tools have one signature interaction, like quick capture |

### Design Quality Bar

FlowBoard should not chase decoration. It should chase sharpness.

The target:

- Calm, fast, precise.
- More product than marketing.
- More real interface than fake illustration.
- More "open it and get work out of your head" than "enterprise project management platform".
- Sharp enough that a screenshot without the logo still feels recognizable.

The visual direction should be:

**Quiet command center for personal and small-team work.**

Not playful. Not corporate. Not futuristic. Not card-bloated. A clean working surface with one signature move: instant capture.

### Visual System Decisions

These decisions should be made before large UI rewrites:

| Area | Decision |
|---|---|
| Font | Use one properly loaded premium UI font. Recommendation: Geist or Satoshi loaded correctly. Do not declare a font that is not actually loaded. |
| Background | Use one neutral temperature. Recommendation: cool off-white/near-white with teal undertone, not mixed beige + teal. |
| Accent | Keep deep teal as brand/current/selected only. Do not splash it everywhere. |
| Radius | Use restrained 8px for most cards/buttons. Avoid random 10/12/16/2xl unless there is a reason. |
| Borders | Use crisp 1px borders with low contrast. Avoid heavy shadows except for overlays/drawers. |
| Shadows | Remove most dashboard shadows. Premium work apps use borders and spacing more than floating-card shadows. |
| Icons | Use icons sparingly. Icons support scanning; they should not decorate every metric. |
| Density | Compact but breathable. The app should feel like a tool, not a landing page. |
| Motion | Minimal. Fast fade/slide for drawer and command palette only. No decorative motion. |

### Landing Page Quality Plan

The current landing page should be treated as throwaway direction, not final brand.

New landing structure:

1. Top nav
   - Logo, Docs, GitHub, Changelog, Demo.
   - No crowded marketing nav.

2. Hero
   - H1 must be literal and strong.
   - Recommended headline: `Memos-fast project management.`
   - Supporting copy: `Capture tasks, notes, and project work in seconds. Organize later across board, table, calendar, and timeline. Self-host when ready.`
   - CTAs: `Try demo`, `View GitHub`.

3. Product frame
   - Use a real app screenshot or an actual embedded interactive app state.
   - The frame should show Quick Capture, Today, Inbox, Projects, and Notes.
   - Do not use a fake mini-dashboard with vanity KPIs.

4. Core loop section
   - Capture.
   - Organize.
   - Plan today.
   - Review progress.

5. Open/self-host section
   - Own your data.
   - Export anytime.
   - Docker/SQLite later.

6. Comparison section
   - "Not Jira. Not Notion setup. Not Trello-only."
   - Keep it short and confident.

What to avoid:

- Generic feature grids.
- Fake stats.
- Huge gradient backgrounds.
- Browser mockups that do not match the real app.
- Too many CTAs.
- Buzzwords like AI-native, productivity hub, unified workspace unless the product truly proves them.

### App UI Quality Plan

The app should get a visual rebuild in this order:

1. App shell
   - Rename Dashboard to Home.
   - Add Inbox.
   - Keep primary nav small.
   - Move advanced views into More/Advanced.
   - Remove fake notification bell.
   - Add one real `+ New` or Quick Capture action.

2. Home screen
   - Replace KPI dashboard with Today/Inbox/Overdue.
   - Put Quick Capture at the top.
   - Show real tasks, not vanity metrics.
   - Use one primary content column and one secondary context column.

3. Projects/Kanban
   - Reduce card metadata.
   - Make task cards sharper: title, priority/status, due signal, one project/tag cue.
   - Move extra information into drawer.
   - Make drag/drop feel clean, not crowded.

4. Notes
   - Make it more Memos-like.
   - Add capture-first note input.
   - Add search.
   - Improve selected-note state.
   - Connect notes to tasks later.

5. My Tasks/Table
   - Make this the power-user work surface.
   - Add grouping.
   - Add inline editing later.
   - Keep density consistent.

6. Calendar/Timeline
   - Polish only after real date data exists.
   - Add today marker and week view.
   - Do not make these the default experience.

### 4K UI Checklist

A screen is not good enough until it passes this checklist:

- One clear primary action.
- One clear focal area.
- No duplicate title.
- No fake controls.
- No random colors.
- No text smaller than it needs to be.
- No card inside a card unless the inner card is a repeated object.
- No mystery metrics.
- No truncation that hides the useful part of a task/note.
- No spacing that feels accidental.
- No loading of unused heavy views on the first screen.
- Screenshot still looks good at 50 percent zoom.
- Mobile version is not just the desktop crushed smaller.

### Taste References

Use competitors as taste references, not clone targets:

- Memos: product promise, capture-first flow, simple copy, ownership.
- Plane: serious open-source credibility, real product screenshots, modern density.
- Linear: keyboard-first sharpness and restraint.
- Notion: calm whitespace and readable docs, but avoid setup burden.
- Trello: obvious board mental model.

### Concrete Redesign Milestone

Before building more features, create one high-quality vertical slice:

1. New landing hero with real product frame.
2. New app Home screen with Quick Capture, Today, Inbox, Overdue.
3. Simplified app shell.
4. Real local state for capture/edit/complete.
5. Screenshot QA at desktop and mobile.

Done means:

- A screenshot of the Home screen can sit next to Memos/Plane without looking like a cheap template.
- A new user can understand the app in 5 seconds.
- A new user can capture a task in under 5 seconds.
- No demo/fake UI is visible in the first experience.
- The same visual rules are used across landing and app.

## Execution Plan

### Week 1: Establish the 4K design foundation

- Choose and properly load the production font.
- Unify color temperature and design tokens.
- Decide final radius, border, shadow, spacing, and type scale.
- Remove fake notification/demo chrome from first experience.
- Replace generic landing direction with product-led hero wireframe.
- Define Home/Inbox/Quick Capture layout.

Verification:

- `globals.css` has one coherent token system.
- Landing wireframe uses a real product frame, not generic feature cards.
- First app screen has one primary action and no fake notification/demo noise.

### Week 2: Build the premium first screen

- Rename Dashboard to Home.
- Add Quick Capture UI.
- Add Inbox concept.
- Replace KPI dashboard with Today, Overdue, Inbox, and recent notes/work.
- Remove duplicate titles.
- Simplify header actions.

Verification:

- User can understand what to do in 5 seconds.
- User can capture a task in under 5 seconds.
- Desktop and mobile screenshots look intentional.

### Week 3: Make the current frontend real

- Create central Zustand store.
- Move mock projects/tasks/notes/members into seed data.
- Wire Dashboard, Kanban, My Tasks, Calendar, Timeline, Notes, Drawer to the store.
- Make task create/edit/delete real.
- Make project create/edit/delete real.
- Make dashboard counts real.
- Persist to localStorage.

Verification:

- Create a task, refresh, task remains.
- Move a task, refresh, status remains.
- Edit in drawer, card updates.
- Dashboard count changes.

### Week 4: Reduce friction

- Add My Day / Today.
- Add proper empty states.
- Add saved filters: Today, Overdue, Upcoming, Blocked, No Date.
- Make command palette create and search real data.

Verification:

- Type a task in quick capture and press Enter.
- It appears in Inbox or selected project instantly.
- Search finds it.

### Week 5: Fix views

- Add real table view with inline editing.
- Make Calendar use real task dates.
- Make Timeline use real start/due dates.
- Add blocked-by relation.
- Hide Graph/Team/Report if they are still fake.

Verification:

- Date edited in table moves task in calendar/timeline.
- Blocked task shows blocked badge in Kanban, My Tasks, and Timeline.

### Week 6: Quality and packaging

- Fix lint errors.
- Fix Windows build script.
- Set `ignoreBuildErrors: false`.
- Remove or archive unused scripts.
- Add basic tests for store operations.
- Add README honesty update.
- Add screenshot/manual QA checklist.

Verification:

- `npm run lint` passes.
- `npm run build` passes on Windows.
- `npx tsc --noEmit` passes.
- README matches reality.

## Harsh Product Verdict

The current app is not bad. It is just pretending too much.

It has enough UI to impress someone for 60 seconds, but not enough product logic to survive one real user session. Your next win is not another competitor feature. Your next win is trust: when the user adds, edits, moves, filters, and refreshes, the app behaves exactly as expected.

Build that first. Then steal the best ideas:

- Memos: instant capture and self-host simplicity.
- Trello: board clarity.
- Asana: My Tasks and subtasks.
- Plane: structured work items, pages, and optional complexity.
- Odoo/Zoho: time tracking, recurring tasks, dependencies.
- Jira: blockers, only the useful part.

The north star: open the app, know what matters, capture work in seconds, and never feel punished for being nontechnical.
