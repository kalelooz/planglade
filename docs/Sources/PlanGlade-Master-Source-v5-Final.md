# PlanGlade — Master Project Source v5

**Status:** Final research-aligned greenfield build guide  
**Date:** 2026-06-14  
**Visual direction update:** 2026-06-17, SOURCE-STYLE-001. The current branch's neutral minimalist app style replaces the old green/nature-heavy visual direction.  
**Replaces:** PlanGlade Master Project Source v4 for future planning/build prompts  
**Companion files:**
- `PlanGlade-Technical-Reference-v2-Final.md`
- `PlanGlade-Research-Painpoints-and-Product-Decisions-v1.md`
- `PlanGlade-Build-Roadmap-and-Codex-Tickets-v1.md`
- `PlanGlade-Codex-Greenfield-Start-Prompt-v1.md`

---

## 0. How to Use This Document

This is the master source for PlanGlade after adding the uploaded community painpoint research.

Use it as the product/design/build authority for:
- PlanGlade identity and positioning
- Target users
- MVP scope
- App navigation
- Feature priorities
- Technical model assumptions
- Public launch strategy
- Codex/Doer workflow

**Source hierarchy:**
1. This v5 document = product, scope, and design truth. Its SOURCE-STYLE-001 updates are the current visual source of truth.
2. Technical Reference v2 = technical/security/deployment truth.
3. Build Roadmap and Codex Tickets = execution order.
4. Live repository = current code truth.
5. If code conflicts with this document, create a scoped ticket to reconcile it.

**Core operating rule:**
> Keep PlanGlade calm, low-friction, solo-first, open-source, and honest. Build one scoped slice at a time.

---

## 1. Project Identity

**Brand name:** PlanGlade  
**Domain:** planglade.com  
**Package / org slug:** planglade  
**Tagline:** A calm clearing for your projects.

**Product category:**
Open-source solo-first project workspace.

**One-sentence promise:**
> PlanGlade helps solo users and small groups turn scattered work into a clear path from idea to done.

**Research-aligned promise:**
> PlanGlade gives people one calm source of truth for tasks, projects, notes/docs, calendar, and planning views — without forcing them to build a productivity system first.

---

## 2. Product North Star

PlanGlade is:

> A calm, light-first, open-source project workspace for solo builders, freelancers, writers, researchers, students, and small project owners who want tasks, notes, docs, calendar, and planning to work together without enterprise PM bloat.

The product must feel useful within five minutes:
1. Create workspace.
2. Capture something.
3. Turn it into a task.
4. Put it in a project.
5. See it on Home and Calendar.
6. Add a note/doc for context.

---

## 3. Market and Painpoint Thesis

The uploaded research shows a clear gap:

### People like simple tools, but simple tools become shallow

Trello/Todoist-style tools are easy, but users hit limits around subtasks, dependencies, timeline, docs, and project context.

### People like powerful tools, but powerful tools become work

Notion/ClickUp/Coda/Jira-style tools can do almost anything, but users complain about setup, noise, complexity, team clutter, and maintenance.

### PlanGlade's wedge

> Be the calm middle: simple enough to start immediately, structured enough for real solo projects, open enough to trust, and integrated enough that users do not maintain tasks, notes, calendar, and timeline separately.

---

## 4. Target Users

### Primary users — build for these first

1. Solo builders and indie developers.
2. Freelancers.
3. Students and researchers.
4. Writers and creators.
5. Personal productivity users.
6. Open-source maintainers.
7. Small project owners.
8. People tired of Trello, Notion, Todoist, ClickUp, Excel, or scattered notes.

### Secondary users — later

1. Couples and families sharing lists.
2. Small teams and agencies.
3. Non-profits needing lightweight coordination.
4. Open-source communities.

**Rule:** The first-run experience must never require a team. Team features must not pollute solo usage.

---

## 5. Product Differentiation

PlanGlade wins by being:

1. **Low-friction:** capture before categorize.
2. **Unified:** tasks, notes/docs, calendar, and planning share one source of truth.
3. **Structured but not heavy:** subtasks, blockers, start/due dates, dependencies later.
4. **Open-source/self-hostable:** trust and control are part of the product.
5. **Calm and focused:** no enterprise dashboard noise.
6. **Honest:** no fake AI, fake metrics, fake pricing, or placeholder features.

### Competitor weaknesses PlanGlade avoids

| Competitor pattern | Avoid this |
|---|---|
| Notion / Coda | Too much setup; system-building becomes procrastination |
| ClickUp | Feature bloat, noisy notifications, team-first clutter |
| Jira | Process-heavy, developer/team-first assumptions |
| Linear | Excellent but dev-team-specific, not broad solo planning |
| Trello | Simple but weak on subtasks, docs, dependencies, timeline |
| Todoist / TickTick | Great tasks but weaker project docs and timeline planning |
| Obsidian | Great notes but weak project execution |
| Excel / Sheets | Manual consolidation and no shared project source of truth |

---

## 6. Product Principles

1. **Capture first, organize second.**
2. **One task, many views.** A task appears in list/board/calendar/timeline without duplication.
3. **Solo first, collaboration later.**
4. **Notes and tasks must connect.**
5. **Docs belong near projects.**
6. **Calendar is a planning view, not a separate event database in MVP.**
7. **Timeline is valuable, but should be built after core task/project data is stable.**
8. **Avoid fake precision.** No vanity metrics, fake productivity scores, fake time tracking.
9. **Use normal product terms inside the app.**
10. **Brand can be calm; workflows must be practical.**

---

## 7. Visual Identity

### 7.1 Core feeling

PlanGlade is a modern, minimalist, light productivity workspace. The "Glade" name is a light metaphor for clarity and calm; it is not a mandatory forest, camping, explorer, or nature visual theme.

**Target feeling:**
> Professional enough to trust, calm enough to focus, simple enough to understand in five seconds.

**Rule:** 100% product clarity. Use brand warmth through copy and restraint, not decorative nature styling.

### 7.2 Visual style

Use:
- Modern minimalist light UI.
- Neutral professional productivity-app surfaces.
- Compact rows, lists, controls, and information-dense layouts where useful.
- shadcn/Radix primitives and established interaction patterns.
- Lucide icons.
- Restrained borders and dividers.
- Neutral backgrounds and panels.
- Color for status, priority, meaning, and feedback, not theme decoration.
- Clean UI typography.
- Quiet empty states.

Avoid:
- Cute camping UI.
- Game mechanics.
- Forest/tent/campfire/mountain hero art.
- Explorer, trail, map, RPG, or nature art as product UI direction.
- Topographic/map patterns as a required brand layer.
- Heavy dark theme as default.
- Forced green/moss/sage branding.
- Excessive cards, boxed panels, and decorative borders.
- Decorative nature clutter inside productivity surfaces.

### 7.3 Color tokens

The current branch style system is the reference:

| Token direction | Use |
|---|---|
| Near-white background | App and landing background |
| White/neutral card surface | Drawers, popovers, repeated items, focused panels |
| Soft neutral sidebar/surface | Navigation and secondary areas |
| Neutral border/divider | Structure without visual clutter |
| High-contrast neutral text | Headings/body |
| Muted neutral text | Labels, helper text, secondary metadata |
| Neutral primary action | Default action/button emphasis |
| Semantic colors | Priority, status, overdue, warning, success, destructive states |

Accents may use neutral, slate, blue, violet, amber, red, or green when they carry meaning. Do not lock PlanGlade to a green/moss/sage brand palette.

### 7.4 Object colors

| Object | Color direction |
|---|---|
| Project | Neutral/slate with optional user color |
| Task | Neutral/slate |
| Subtask | Same family as task, lighter emphasis |
| Note | Blue or neutral |
| Doc | Violet or neutral |
| Dependency | Blue/violet |
| Blocked | Amber |
| Overdue | Red |
| Done | Green |

Use these as chips/icons/small accents. Never rely on color alone.

---

## 8. Navigation and Routes

### 8.1 MVP sidebar

Build exactly:

1. Home
2. Inbox
3. Tasks
4. Projects
5. Notes
6. Calendar
7. Settings

### 8.2 Hidden/not primary in MVP

- Board: view toggle inside Tasks.
- Timeline: phase 2 route, hidden until usable.
- Work Map / Connections: later.
- Reports: later.
- Team: later.
- Activity: later.

### 8.3 Route structure

| Route | Purpose |
|---|---|
| `/` | Marketing landing page |
| `/login` | Authentication |
| `/onboarding` | First workspace setup |
| `/app` | Authenticated Home |
| `/app/inbox` | Inbox |
| `/app/tasks` | Tasks hub |
| `/app/projects` | Projects list |
| `/app/projects/[projectId]` | Project detail |
| `/app/notes` | Notes |
| `/app/calendar` | Calendar |
| `/app/settings` | Settings |
| `/app/timeline` | Hidden until Phase 2 |

---

## 9. Core Product Objects

### Workspace

A workspace is the container for all user data. In MVP, each user gets one default workspace, but the model supports future sharing.

### Project

A project groups tasks, notes, docs, and planning.

Minimum fields:
- name
- description
- status: active / paused / done / archived
- color
- startDate optional
- dueDate optional

### Task

A task is the primary work object and the source for list, board, calendar, and timeline views.

Minimum fields:
- title
- description
- status: backlog / todo / in_progress / blocked / done / cancelled
- priority: low / medium / high / urgent
- type: task / subtask / milestone
- startDate optional
- dueDate optional
- projectId optional
- parentId optional for subtasks
- assigneeId optional
- completedAt optional

### Dependency

Phase 2 but data-model-ready early.

- blockerTaskId
- blockedTaskId
- type: finish_to_start initially

### InboxItem

A captured raw idea/task/note that has not been triaged.

Fields:
- content
- status: pending / converted / dismissed
- source: manual / note / calendar / import
- convertedTaskId optional
- convertedNoteId optional

### Note

Freeform notes, fast and searchable.

Fields:
- title
- content
- projectId optional
- authorId
- linked tasks optional/later

### Doc

Structured project documentation.

Fields:
- title
- content
- status: active / archived
- projectId required

### Calendar

Calendar is not a separate core entity in MVP. It is a view over tasks with due dates and later scheduled blocks.

---

## 10. Application Pages

### 10.1 Home

Home is the solo command center.

**Home answers:**
- What needs attention today?
- What is overdue?
- What did I capture?
- What project should I continue?
- What notes/docs were recent?

**Sections:**
- Quick capture.
- Today tasks.
- Overdue.
- Inbox summary.
- Next up.
- Recent notes/docs.
- Project focus card.

**Do not show:**
- fake productivity scores
- fake time tracking
- enterprise KPI cards
- team workload charts

---

### 10.2 Inbox

Inbox is for low-friction capture and triage.

**Must allow:**
- create inbox item with text only
- optional project/due date/priority
- convert to task
- convert to note later
- dismiss
- batch actions later

**UX rule:** capture should feel faster than opening a form.

---

### 10.3 Tasks

Tasks is the main work hub.

**Views:**
- List view default.
- Board view toggle.

**Filters:**
- all
- mine
- today
- upcoming
- overdue
- no date
- blocked
- completed
- by project
- by priority

**Task drawer:**
- title
- description
- status
- priority
- project
- start/due dates
- subtasks
- dependencies later
- linked notes/docs later

**Rules:**
- My Tasks is a filter, not a route.
- Board is a view, not a primary nav item.
- No fake automation buttons.

---

### 10.4 Projects

Projects list should be clean and information-dense without feeling like a dashboard.

Each project shows:
- name
- status
- progress
- next task
- open task count
- blocked/overdue signal
- linked notes/docs count
- last active date

---

### 10.5 Project Detail

Project detail is the main “project home.”

Tabs:
- Overview
- Tasks
- Docs
- Calendar
- Timeline later

Overview shows:
- description/context
- next task
- overdue or blocked task signal
- progress
- linked notes/docs
- quick add task
- quick add doc/note

Do not show empty activity feeds or team-heavy fields in solo mode.

---

### 10.6 Notes

Notes are quick and useful, not a Notion clone.

Must support:
- create note
- edit note
- search notes
- project association
- basic editor
- note-to-task extraction from checklist lines or selected text

---

### 10.7 Docs

Docs are structured project documents inside a project.

MVP:
- list docs in project
- create/edit/archive/delete
- basic editor
- project required
- workspace permission checks

---

### 10.8 Calendar

Calendar is a view over tasks.

MVP:
- month view
- task appears on due date
- click task opens drawer
- create task from date
- side list for tasks without due date

Phase 2:
- week view
- time blocks
- recurring tasks
- external calendar sync later

---

### 10.9 Timeline

Timeline is the first major post-MVP differentiator.

Phase 2:
- task bars from startDate to dueDate
- project grouping
- today line
- dependency indicators
- week/month zoom
- click task opens drawer

No critical path calculations in v1.

---

### 10.10 Settings

MVP:
- workspace name
- appearance
- data export
- guided import later
- account/logout

Rules:
- no dangerous reset visible to normal users
- destructive actions require confirmation
- no dev tools in production

---

## 11. MVP Scope

### Build in MVP

1. Auth and onboarding.
2. Workspace model.
3. App shell.
4. Home.
5. Inbox.
6. Tasks list + board.
7. Projects + project detail.
8. Notes.
9. Project docs.
10. Calendar month view.
11. Settings data export.
12. Landing page.
13. Self-host basics.

### Phase 2 after MVP

1. Timeline v1.
2. Dependencies.
3. Recurring tasks.
4. Week calendar.
5. Task templates.
6. Guided import.
7. Mobile/PWA polish.

### Defer

1. Native mobile apps.
2. AI.
3. Time tracking.
4. Resource inventory.
5. Team capacity/workload.
6. Billing/pricing.
7. Real-time collaboration.
8. Full external calendar sync.
9. Heavy automations.

---

## 12. Landing Page

### 12.1 Direction

Landing is product-first, image-light or image-free, and aligned with the current app style.

Do not use generated landscapes, campsite art, tents, campfires, mountains, forest scenes, characters, RPG styling, or a green-heavy design system.

Use:
- Real product screenshots/assets only when they exist.
- Modern minimalist light layout.
- Neutral surfaces and restrained dividers.
- Honest product copy tied to built features.
- Current app style as the visual reference.

### 12.2 Structure

1. Header.
2. Hero.
3. Painpoint/solution strip.
4. Feature strip.
5. Self-host/privacy section.
6. Roadmap honesty section.
7. FAQ.
8. Final CTA.
9. Footer.

### 12.3 Hero

Trust badges:
- Open source
- Self-hostable
- Solo-first

Headline:
> A calm clearing for your projects.

Supporting copy:
> PlanGlade brings tasks, notes, docs, calendar, and simple planning into one focused workspace — without the clutter of enterprise PM tools.

Alternative research-aligned copy:
> Capture ideas fast, turn them into tasks, keep notes and docs nearby, and plan your work across calendar and timeline views — all from one open-source workspace.

CTAs:
- Get Started
- View on GitHub

### 12.4 Feature cards

1. **Capture without friction**  
   Turn scattered thoughts into inbox items, tasks, or notes before they disappear.

2. **Plan with clarity**  
   Organize projects, priorities, subtasks, and due dates without enterprise ceremony.

3. **Write where work happens**  
   Keep notes and docs beside the projects they support.

4. **See work across views**  
   Use list, board, calendar, and later timeline views from the same task source.

5. **Own your workspace**  
   Open source, self-hostable, transparent, and built for control.

### 12.5 Honest roadmap block

Show:
- Available now / in MVP.
- Next: Timeline, dependencies, recurring tasks.
- Later: mobile polish, sharing, time tracking.

Do not imply unbuilt features are ready.

---

## 13. Open Source and Self-Hosting

PlanGlade should be:
- free self-hosted
- open-source
- transparent roadmap
- honest about maturity

Before claiming “self-hostable,” ship:
1. Dockerfile.
2. docker-compose.yml.
3. `.env.example`.
4. SELF_HOSTING.md.
5. backup/restore guidance.
6. migrations that work cleanly.
7. basic health check.

License decision before public launch:
- AGPL-3.0 if clone protection matters.
- Apache-2.0 if adoption/business friendliness matters.
- MIT if maximum permissiveness matters.

No pricing page until hosted cloud is real.

---

## 14. Monetization

Now:
- free and open source
- optional donation link later

Later:
- hosted cloud after auth/security/backups/billing/privacy are ready
- self-host remains free

Do not cripple the open-source version.

---

## 15. Security Rules

Hard rules:
- no fake auth
- no hardcoded admin users
- no secrets in client code
- no `.env` commits
- no workspace data access without membership check
- no client-provided user/workspace ID as source of truth
- no raw HTML without sanitization
- no stack traces to users
- no unreviewed packages
- no debug tools in production

Every workspace route must verify:
1. authenticated user
2. workspace membership
3. entity belongs to workspace
4. role permits operation

---

## 16. Development Workflow

### Architect role

- decides product direction
- reviews output
- writes scoped prompts
- protects scope/security/design

### Codex/Doer role

- implements one ticket
- touches only allowed files
- validates before reporting
- does not change product direction independently

### Build rules

1. One ticket at a time.
2. No broad rewrites.
3. No unrelated cleanup.
4. No fake features.
5. Validate lint/type/test/browser smoke.
6. Update docs after each feature.
7. Start new Codex chat for auth/database/security or major new feature areas.

---

## 17. Fast Track to Public MVP

The fast track is **not** every feature. It is enough working product to publish honestly and attract the right users.

### Public MVP must prove

1. Capture is fast.
2. Tasks are real.
3. Projects are useful.
4. Notes/docs are connected.
5. Calendar uses the same tasks.
6. App is calm and simple.
7. Self-host story is credible.
8. Landing page is honest.

### Public MVP does not need

1. Timeline if clearly marked “next.”
2. Time tracking.
3. Native mobile.
4. AI.
5. Full collaboration.
6. Resource management.

---

## 18. What to Avoid

- Building ClickUp.
- Building Notion.
- Building Jira.
- Building MS Project.
- Building a productivity game.
- Making the app cute.
- Adding team/admin clutter early.
- Splitting tasks and calendar into separate records.
- Showing unbuilt features in UI/landing.
- Shipping a complex empty dashboard.
- Making users configure a system before capturing their first task.
- Hiding simple actions.
- Adding pricing before product maturity.

---

## 19. Final Product Shape

PlanGlade should become:

> A calm open-source project workspace where solo users can capture work quickly, organize real projects, write notes and docs, schedule tasks on a calendar, and later visualize dependencies on a timeline — all without PM-tool bloat.

That is the product.

---

## 20. Current Branch Status Note

ALIGN-001 was completed on the current branch:
- `/` is now a simple honest PlanGlade landing page.
- `/app` remains the app Home.
- `/onboarding` no longer 404s.
- Active shell branding says PlanGlade.
- Advanced top-level routes redirect back to MVP surfaces.
- Validation passed: lint, typecheck, tests, Prisma validate, and build.
- `prisma generate` still has a local Windows EPERM DLL lock risk.
