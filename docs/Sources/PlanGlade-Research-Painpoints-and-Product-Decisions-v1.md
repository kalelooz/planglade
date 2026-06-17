# PlanGlade — Research Painpoints and Product Decisions v1

**Status:** Final research synthesis for the v5 build source  
**Date:** 2026-06-14  
**Purpose:** Convert the uploaded community/reddit research into clear product decisions, MVP priorities, non-goals, and build implications for PlanGlade.

---

## 0. Sources Used

- `PlanGlade-Master-Source-v4-Final.md` — prior product/design/roadmap source.
- `PlanGlade-Technical-Reference-Final.md` — prior architecture/security/testing source.
- 12 uploaded Reddit/community JSON exports covering PM + notes, solo project planning, simple PM, Gantt/timeline/calendar, family/shared tasks, time tracking, and PM tool comparisons.

### Uploaded community research corpus

|#|Source thread|Community|Date|Score|Comments|Uploaded file|
|---|---|---|---|---|---|---|
|1|I spent 15 hours watching/reading about apps that provide Project Management + Note Taking, thought i'd share my findings|r/productivity|2023-03-30|345|105|I spent 15 hours watchingreading about apps that provide Project Management + Note Taking, thought i'd share my findings.json|
|2|Looking for a solo-friendly project & task management tool with timeline and calendar features|r/ProductivityApps|2025-04-01|10|22|Looking for a solo-friendly project & task management tool with timeline and calendar features.json|
|3|Looking for the right PM tools/apps|r/projectmanagement|2023-03-12|35|89|Looking for the right PM toolsapps.json|
|4|Project Management Tool for Personal Use|r/webdev|2024-10-23|7|66|Project Management Tool for Personal Use.json|
|5|Project management tools ranked + comparison table (2026 update)|r/projectmanagement|2026-02-17|99|127|Project management tools ranked + comparison table (2026 update).json|
|6|Seeking Simple Project Management App|r/projectmanagement|2023-04-15|31|58|Seeking Simple Project Management App.json|
|7|What project management tools do you guys recommend?|r/projectmanagement|2025-04-11|86|93|What project management tools do you guys recommend.json|
|8|What task management app would you recommend for family use|r/productivity|2024-10-09|8|14|What task management app would you recommend for family use.json|
|9|What's considered the best app for task/project management?|r/productivity|2024-02-18|34|68|What's considered the best app for taskproject management.json|
|10|Which software for project management?|r/projectmanagement|2023-09-13|33|92|Which software for project management.json|
|11|Are there any task/project management app with a solid time tracker?|r/ProductivityApps|2025-08-31|3|19|Are there any taskproject management app with a solid time tracker.json|
|12|Best Task/Project Management Apps currently?|r/productivity|2025-08-18|14|33|Best TaskProject Management Apps currently.json|

---

## 1. Executive Summary

The research does **not** say “build a bigger ClickUp.” It says:

> People want one calm place where tasks, projects, notes/docs, calendar, and timeline planning use the same underlying work items — without the setup burden of Notion, the team bloat of ClickUp/Jira, or the shallow limits of Trello/Todoist.

The strongest PlanGlade opportunity is a **solo-first, low-friction, open-source planning workspace** that gives people enough structure to manage real projects, without forcing them to become a PM admin.

---

## 2. Research Signals

| Signal | Product meaning |
|---|---|
| Low-friction capture is urgent | People repeatedly want a place to dump tasks, notes, tickets, ideas, and deadlines quickly, especially users who find setup-heavy apps exhausting or who have ADHD-style capture friction. |
| One source of truth beats integrations | Users want tasks to appear in calendar/timeline without creating duplicate events or maintaining two systems. |
| Solo-first is underserved | Many tools are built for teams and include billing, time tracking, reports, chat, approvals, or admin concepts that solo academics, writers, builders, and freelancers do not need upfront. |
| Timeline/Gantt/calendar switching is a real pain | Multiple requests ask for the same work to be visible as list, board, calendar, timeline/Gantt, and project plan. |
| Tasks + notes/docs together is valuable | People want guides, SOPs, research notes, project context, and tasks together, but they do not want to build a Notion database system from scratch. |
| Subtasks, dependencies, blockers matter | Trello/Todoist-like apps feel too shallow when users need nested work, dependent tasks, or 'A before B' clarity. |
| Open-source/simple/free has a wedge | Budget constraints, distrust of pricing changes, and self-hosting/control concerns create a real opening for an honest OSS product. |
| Mobile/web access matters | Several users require Android/PC or family Apple/Android widget support. A responsive PWA should be planned before native apps. |
| Time tracking is useful but dangerous for MVP scope | Freelancers want client/month reports, but time tracking can pull PlanGlade toward heavier agency software too early. |
| Resource management/inventory is a later team feature | Non-profits and teams ask for resource tracking, but it is not core to the solo-first wedge and should not pollute MVP. |

---

## 3. What People Are Actually Asking For

### 3.1 Low-friction capture

People do not want to think before writing something down. Capture must be available from Home, Inbox, project pages, notes, and calendar.

**Product decisions:**
- `Inbox` is a first-class route.
- `Quick Capture` appears in Home and top bar.
- Captured text can remain an inbox item or become a task/note.
- Capture should require title/content only; project, due date, priority are optional.

**MVP acceptance:**
- User can capture an idea in under 5 seconds.
- User can convert an inbox item into a task without retyping it.
- User can dismiss or archive noise.

---

### 3.2 Same item across list, board, calendar, and timeline

A repeated frustration is maintaining separate calendar events, task records, Gantt rows, and note references. This is the core architecture point.

**Product decisions:**
- `Task` is the primary scheduled work object.
- Calendar is a view over tasks, not a second event system in MVP.
- Timeline is a view over tasks/projects, not a separate planning database.
- Notes/docs link to tasks and projects, but do not duplicate tasks.

**MVP acceptance:**
- One task with a due date appears in task list and calendar.
- Later, one task with start/due dates appears in timeline.
- Editing the task updates all views.

---

### 3.3 Solo-first, not team-first

Users complain that many tools are cluttered with team admin: billing, approvals, workload, capacity, chat, notification storms, complex permission layers, and reporting dashboards.

**Product decisions:**
- The first-run experience assumes a single user.
- Team/collaboration features exist only as a workspace model in the backend early.
- No Team route in MVP navigation.
- No enterprise KPI dashboard.
- No notification storm.

**MVP acceptance:**
- A solo user can start without inviting anyone.
- App navigation is: Home, Inbox, Tasks, Projects, Notes, Calendar, Settings.
- Collaboration is deferred until solo flow is excellent.

---

### 3.4 Notes/docs must be useful, not a Notion clone

People want project context, guides, SOPs, research, and notes near tasks. They do not want to build an elaborate database workspace.

**Product decisions:**
- `Notes` = fast/freeform capture and personal/project notes.
- `Docs` = structured project documentation inside projects.
- Basic editor first, not a block-based Notion clone.
- Note-to-task extraction is a high-value bridge.

**MVP acceptance:**
- User can create/search notes.
- User can associate notes with projects.
- User can create docs inside a project.
- User can create tasks from checklist lines or selected note text.

---

### 3.5 Timeline/Gantt is a differentiator, but not the first screen

Timeline appears repeatedly as a missing bridge between simple task apps and heavy PM tools. It matters, but it must be introduced carefully.

**Product decisions:**
- MVP does not block on a full timeline.
- Phase 2 should build a simple timeline using existing task fields.
- Dependencies and blockers should be data-model-ready before timeline UI.
- Timeline must not become Microsoft Project.

**Timeline v1 should include:**
- project rows or grouped tasks
- task bars from `startDate` to `dueDate`
- today line
- week/month zoom
- dependency markers
- click task bar to open task drawer

---

### 3.6 Subtasks, dependencies, and blockers are essential for “real work”

Trello-like simplicity is loved, but shallow structure is a dealbreaker when work has sequences.

**Product decisions:**
- Support subtasks in the data model from the beginning.
- Support dependencies in the data model before/with timeline.
- Blocked status should be visible in tasks and project overview.
- Keep hierarchy shallow in UI initially to avoid complexity.

**MVP acceptance:**
- User can create a subtask.
- User can mark a task as blocked.
- Project overview shows blocked/overdue/due-soon items.
- Dependencies can be added in Phase 2, not necessarily Phase 1.

---

### 3.7 Calendar must help planning, not just display dates

Users want to schedule work without duplicate calendar entries.

**Product decisions:**
- Calendar v1 displays tasks by due date.
- Calendar v1 can create a task from a date cell.
- Calendar v1 has a “no date” side list.
- Time-blocking and external calendar sync are later features.

**MVP acceptance:**
- Month view works.
- Week view can come Phase 2.
- Clicking an item opens the task drawer.

---

### 3.8 Time tracking is a later add-on, not the wedge

Some users need per-client monthly reports and “what took longest.” This is real, but building it too early will shift PlanGlade toward agency timesheet software.

**Product decisions:**
- Do not show time tracking in MVP.
- Add schema-compatible fields later only when the task model is stable.
- Phase 4 can add lightweight time entries and reports.
- Landing must not claim time tracking until built.

**Future time tracking v1:**
- Start/stop timer on task.
- Manual time entry.
- Client/project monthly summary.
- CSV export.
- No surveillance, screenshots, employee monitoring, or productivity policing.

---

### 3.9 Family/shared use is a good later niche

A family/couple shared list use case appears, especially around free shared boards and mobile widgets.

**Product decisions:**
- Workspace membership model should support future sharing.
- Do not prioritize family widgets before core web/PWA is excellent.
- Later phase can add “shared lightweight workspace” patterns.

---

## 4. Product Decisions

### Must build for MVP

1. Auth + workspace.
2. App shell.
3. Home / Today dashboard.
4. Inbox quick capture and conversion.
5. Tasks list + board toggle.
6. Projects list + project detail.
7. Notes with project association.
8. Project docs basic CRUD.
9. Calendar month view over tasks.
10. Data export.
11. Public landing page that honestly shows only built features.
12. Self-host baseline docs and Docker.

### Must design for early but can ship Phase 2

1. Start dates.
2. Dependencies.
3. Timeline/Gantt v1.
4. Week calendar.
5. Recurring tasks.
6. Task templates.
7. Better note-to-task extraction.
8. Import preview and guided import.

### Must defer

1. Native mobile apps.
2. Full external calendar sync.
3. AI features.
4. Time tracking reports.
5. Resource inventory.
6. Team workload/capacity.
7. Billing/pricing.
8. Heavy automations.
9. Real-time collaboration.
10. Enterprise dashboards.

---

## 5. MVP Product Shape

The MVP should feel like:

> “A cleaner Trello/Todoist/Amplenote hybrid for solo project planning, with project docs and calendar built in, and a path to timeline.”

It should **not** feel like:
- a Notion clone
- a ClickUp clone
- a Jira clone
- a spreadsheet builder
- a dashboard/reporting tool
- a gamified, nature-themed, camping, forest, explorer, or RPG app

### Visual decision update

SOURCE-STYLE-001 replaces the old nature-heavy direction. PlanGlade keeps its name and tagline, but the UI should look like a modern open-source productivity workspace: neutral, compact, professional, light, and aligned with the current branch style system. Do not force green/moss/sage tokens, generated landscapes, camping imagery, topographic patterns, or decorative glade styling into product workflows.

---

## 6. Updated Positioning From Research

### Primary positioning

> PlanGlade is a calm open-source workspace for solo builders, writers, researchers, and freelancers who want tasks, notes, docs, calendar, and project planning to share one source of truth.

### Painpoint headline options

1. `Tasks, notes, docs, calendar, and planning — without PM-tool bloat.`
2. `One calm place to move from idea to done.`
3. `A project workspace that does not become the project.`
4. `Plan your work without building a system first.`

### Landing message hierarchy

1. Calm project workspace.
2. Solo-first.
3. Tasks + notes/docs + calendar.
4. Timeline/planning direction.
5. Open source + self-hostable.
6. Honest roadmap.

---

## 7. Product Rules Created by the Research

1. Every object should have a clear owner/source of truth.
2. Do not duplicate tasks into events.
3. Do not require setup before value.
4. Do not force every note into a hierarchy.
5. Do not make users choose between notes and tasks.
6. Do not ship fake dashboard metrics.
7. Do not hide simple actions behind deep menus.
8. Do not force team concepts on solo users.
9. Do not let timeline/Gantt turn into MS Project complexity.
10. Do not claim mobile/native/time tracking/AI before built.

---

## 8. Feature Priority Matrix

| Feature | User demand | Build cost | MVP? | Decision |
|---|---:|---:|---:|---|
| Quick capture | High | Low | Yes | Build early |
| Inbox triage | High | Medium | Yes | Build early |
| Task list | High | Medium | Yes | Core |
| Board view | Medium | Medium | Yes | View toggle |
| Project overview | High | Medium | Yes | Core |
| Notes | High | Medium | Yes | Core |
| Project docs | Medium/High | Medium | Yes | Core differentiator |
| Calendar month | High | Medium | Yes | Task view |
| Timeline/Gantt | High | High | Phase 2 | Differentiator |
| Dependencies | High | Medium/High | Phase 2 | Model early |
| Recurring tasks | Medium/High | Medium | Phase 2 | Add after core |
| Mobile PWA polish | Medium/High | Medium | Phase 2/3 | Responsive first |
| Family sharing | Medium | High | Later | After invites |
| Time tracking | Medium | High | Later | Avoid MVP scope creep |
| Resource inventory | Low/Team-specific | High | No | Later/extension |
| AI categorization | Medium/Future | High | No | Defer |

---

## 9. Final Research-Based Decision

PlanGlade should start as:

> A low-friction solo project workspace that unifies capture, tasks, project context, notes/docs, and calendar, then earns its differentiation with a clean timeline/dependency layer after the core is stable.

This keeps the product aligned with what people asked for while avoiding the trap of becoming another bloated PM suite.
