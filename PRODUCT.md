# PlanGlade — Product Source

**Status:** v6.3 - consolidated, audited, updated for public website + SaaS launch planning, and aligned with repo-level `AGENTS.md`
**Supersedes:** Master Project Source v5, Research Painpoints and Product Decisions v1
**Companion documents:** `TECHNICAL.md` (architecture/security/deployment truth), `EXECUTION.md` (roadmap/tickets/agent workflow), `SAAS-LAUNCH.md` (website/cloud/demo/business plan), `AGENTS.md` (repo-level agent rules), `AGENT-BOOTSTRAP.md` (session-start prompt)

---

## 0. How These Documents Work Together

Six files, six jobs. Don't duplicate content across them - cross-reference instead.

| Document | Owns |
|---|---|
| `PRODUCT.md` (this file) | Identity, positioning, scope, design direction, page-level product spec |
| `TECHNICAL.md` | Architecture, stack, data model, security, deployment, **and current implementation drift** |
| `EXECUTION.md` | Phases, tickets, build rules, Architect/Agent roles, current project state |
| `SAAS-LAUNCH.md` | Public website launch, SaaS/cloud direction, demo plan, pricing, tooling, and business boundaries |
| `AGENTS.md` | Repo-level rules that Codex loads automatically before work |
| `AGENT-BOOTSTRAP.md` | The literal prompt pasted into a fresh agent session |

**Source hierarchy:** if the live repository conflicts with what's written here, the repository doesn't automatically win — see `TECHNICAL.md §3` for how drift is tracked and resolved. Open a scoped ticket to reconcile it either way.

**Core operating rule:** keep PlanGlade calm, low-friction, solo-first, open-source, and honest. Keep public copy short and human. Build one scoped slice at a time.

---

## 1. Identity

**Brand name:** PlanGlade
**Domain:** planglade.com
**Tagline:** A calm clearing for your projects.
**Category:** Open-source, solo-first project workspace.
**Public launch line:** Self-host now. Cloud soon.
**Demo line:** Try demo. Demo mode. Changes are disabled.

**One-sentence promise:**
> PlanGlade gives people one calm place to capture, plan, and finish work.

**Research-aligned promise:**
> PlanGlade gives people one calm source of truth for tasks, projects, notes/docs, calendar, and planning views — without forcing them to build a productivity system first.

---

## 2. North Star

> A calm, light-first, open-source project workspace for solo builders, freelancers, writers, researchers, students, and small project owners who want tasks, notes, docs, calendar, and planning to work together without enterprise PM bloat.

The product should feel useful within five minutes: create a workspace, capture something, turn it into a task, put it in a project, see it on Home and Calendar, add a note for context.

---

## 3. Why PlanGlade — Market Thesis

Twelve community research threads (r/productivity, r/projectmanagement, r/ProductivityApps, r/webdev — full corpus in §15) point at the same gap from different angles:

- **Simple tools become shallow.** Trello/Todoist-style tools are easy to start with, but users hit a wall on subtasks, dependencies, timeline, and project docs.
- **Powerful tools become work.** Notion/ClickUp/Coda/Jira can do almost anything, but setup, noise, and team-admin clutter cost more than they're worth for a solo user.
- **People want one source of truth.** The most repeated frustration is maintaining the same work in separate places — a task list *and* a calendar *and* a Gantt chart *and* a notes app — and keeping them in sync by hand.

**PlanGlade's wedge:** be the calm middle. Simple enough to start immediately, structured enough for real solo projects, open enough to trust, integrated enough that one task is the only record that exists.

### Signals → Product Decisions

| Research signal | What it means for PlanGlade |
|---|---|
| Low-friction capture is urgent, especially for ADHD-style capture friction | Inbox is first-class; quick capture lives on Home and the top bar; capturing requires only text |
| One source of truth beats integrations | Task is the only scheduled-work object; calendar and timeline are *views*, never duplicate records |
| Solo-first is underserved | No team route, no billing, no admin clutter in the first-run experience |
| Timeline/Gantt switching is a real pain point | Phase 2 differentiator, built on existing task fields rather than a parallel planning database |
| Tasks + notes/docs together is valuable, but people don't want to build a Notion database | Notes are freeform and fast; Docs are structured and project-scoped; neither is a block-based system |
| Subtasks, dependencies, blockers matter once work gets real | Modeled early even where the UI ships later |
| Open-source/self-hosted has a real wedge | Budget pressure and distrust of pricing changes make "free, transparent, your data" a genuine differentiator |
| Time tracking is wanted but dangerous for MVP scope | Deferred — it pulls the product toward agency software too early |
| Resource/inventory management is a later, team-specific ask | Out of scope; not part of the solo-first wedge |

---

## 4. Target Users

**Primary — build for these first:** solo builders and indie developers, freelancers, students and researchers, writers and creators, personal-productivity users, open-source maintainers, small project owners, and people tired of Trello/Notion/Todoist/ClickUp/Excel/scattered notes.

**Secondary — later:** couples and families sharing lists, small teams and agencies, non-profits needing lightweight coordination, open-source communities.

**Rule:** the first-run experience must never require a team. Team features must not pollute solo usage.

---

## 5. Differentiation

PlanGlade wins by being low-friction (capture before categorize), unified (tasks/notes/docs/calendar/planning share one source of truth), structured but not heavy, open-source and self-hostable, calm, and honest — no fake AI, fake metrics, fake pricing, or placeholder features.

| Competitor pattern | What PlanGlade avoids |
|---|---|
| Notion / Coda | Heavy setup; system-building becomes procrastination |
| ClickUp | Feature bloat, notification noise, team-first clutter |
| Jira | Process-heavy, developer/team-first assumptions |
| Linear | Excellent, but dev-team-specific rather than broad solo planning |
| Trello | Simple, but weak on subtasks, docs, dependencies, timeline |
| Todoist / TickTick | Strong tasks, weaker project docs and timeline planning |
| Obsidian | Strong notes, weak project execution |
| Excel / Sheets | Manual consolidation, no shared source of truth |

---

## 6. Product Principles

1. Capture first, organize second.
2. One task, many views — list, board, calendar, timeline, no duplication.
3. Solo first, collaboration later.
4. Notes and tasks must connect.
5. Docs belong near projects.
6. Calendar is a planning view, not a separate event database, in MVP.
7. Timeline matters, but ships after core task/project data is stable.
8. Avoid fake precision — no vanity metrics, fake productivity scores, fake time tracking.
9. Use normal product terms inside the app.
10. Brand can be calm; workflows must be practical.

---

## 7. Visual Identity

**Target feeling:** professional enough to trust, calm enough to focus, simple enough to understand in five seconds. The "Glade" name is a light metaphor for clarity, not a mandate for forest/camping/nature visuals.

**Use:** modern minimalist light UI, neutral professional surfaces, compact information-dense layouts, shadcn/Radix primitives, Lucide icons, restrained borders, color reserved for status/priority/meaning.

**Avoid:** cute camping UI, game mechanics, forest/tent/campfire/mountain hero art, explorer/trail/map/RPG styling, topographic patterns as a brand layer, dark theme as default, forced green/moss/sage branding, decorative clutter inside productivity surfaces.

### Color tokens

| Token direction | Use |
|---|---|
| Near-white background | App and landing background |
| White/neutral card surface | Drawers, popovers, focused panels |
| Soft neutral sidebar | Navigation and secondary areas |
| Neutral border/divider | Structure without clutter |
| High-contrast neutral text | Headings/body |
| Muted neutral text | Labels, helper text, metadata |
| Neutral primary action | Default button emphasis |
| Semantic colors | Priority, status, overdue, warning, success, destructive only |

Accents may use slate, blue, violet, amber, red, or green when they carry meaning. PlanGlade is not locked to a green/moss/sage palette.

### Object colors

Project: neutral/slate, optional user color · Task: neutral/slate · Subtask: same family, lighter emphasis · Note: blue or neutral · Doc: violet or neutral · Dependency: blue/violet · Blocked: amber · Overdue: red · Done: green. Use as chips/icons/small accents — never color alone.

---

## 8. Navigation and Routes

**MVP sidebar, exactly:** Home, Inbox, Tasks, Projects, Notes, Calendar, Settings.

**Hidden / not primary in MVP:** Board (a view toggle inside Tasks, not a route), Timeline (Phase 2, hidden until usable), Work Map/Connections, Reports, Team, Activity (all later).

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

Purpose-level only — field-by-field schema is canonical in `TECHNICAL.md §4`. Don't maintain field lists in two places.

- **Workspace** — container for all user data. One default workspace per user in MVP; the model supports future sharing.
- **Project** — groups tasks, notes, docs, and planning for a body of work.
- **Task** — the primary work object and the single source for list, board, calendar, and timeline views.
- **Dependency** — a "blocker → blocked" relationship between tasks. Phase 2 UI, but the model should exist early.
- **InboxItem** — a captured raw idea/task/note that hasn't been triaged yet.
- **Note** — freeform, fast, searchable; optionally linked to a project.
- **Doc** — structured project documentation; always project-scoped.
- **Calendar** — not a stored entity. A view over tasks with due dates, later extended to scheduled blocks.
- **Attachment** — file attached to a task or note, via local or Firebase-backed signed URLs. Backend is fully built and tested but has no UI yet and is feature-flagged off by default — see `TECHNICAL.md §3.3` before assuming this is a live product surface.
- **WorkspaceInvite / WorkspaceMember roles** — invite and membership model supporting future collaboration. Only invite *acceptance* is currently reachable through the UI; sending invites and managing members has no UI yet. Same caveat as Attachment: built, tested, dormant.

---

## 10. Application Pages

### Home
The solo command center. Answers: what needs attention today, what's overdue, what did I capture, what project should I continue, what notes/docs were recent. Sections: quick capture, today's tasks, overdue, inbox summary, next up, recent notes/docs, project focus card. **Never show:** fake productivity scores, fake time tracking, enterprise KPI cards, team workload charts.

### Inbox
Low-friction capture and triage. Create an item with text only; project/due date/priority are optional. Convert to task, convert to note (later), dismiss, batch actions (later). Capture should feel faster than opening a form.

### Tasks
The main work hub. List view by default, board view as a toggle (not a separate nav item). Filters: all, mine, today, upcoming, overdue, no date, blocked, completed, by project, by priority. Task drawer covers title, description, status, priority, project, dates, subtasks, and later dependencies/linked notes. "My Tasks" is a filter, not a route. No fake automation buttons.

### Projects
Clean and information-dense without becoming a dashboard. Each project shows name, status, progress, next task, open count, blocked/overdue signal, linked notes/docs count, last active date.

### Project Detail
The project's "home." Tabs: Overview, Tasks, Notes, Calendar, Timeline (later) — **no Docs tab and no board toggle**. Notes now carries project context directly; an earlier version of this page had a separate Docs tab, but it looked indistinguishable from Notes in practice, so Docs was demoted to an advanced, default-off project feature rather than a primary surface (backend/data model unchanged — see `TECHNICAL.md §8`). Overview shows description/context, next task, overdue/blocked signal, progress, linked notes, and quick-add for tasks. No empty activity feeds or team-heavy fields in solo mode.

### Notes
Quick and useful, not a Notion clone. Create, edit, search, project association, basic editor, note-to-task extraction from checklist lines or selected text.

### Docs
Structured project documents. List, create/edit/archive/delete, basic editor, project required, workspace permission checks.

### Calendar
A view over tasks. MVP: month view, tasks appear on due date, click opens drawer, create task from a date cell, side list for tasks without a date. Phase 2: week view, time blocks, recurring tasks; external sync stays deferred.

### Timeline
The first major post-MVP differentiator. Phase 2: task bars from start to due date, project grouping, today line, dependency indicators, week/month zoom, click opens drawer. No critical-path calculations in v1.

### Settings
MVP: workspace name, appearance (including priority display style — Text, Dots, Badge, or Arrows, applied consistently across Home, Tasks, Board, drawer, and Project Detail), data export, guided import (later), account/logout. No dangerous reset visible to normal users; destructive actions require confirmation; no dev tools in production.

---

## 11. MVP Scope

### Build in MVP
Auth and onboarding · workspace model · app shell · Home · Inbox · Tasks (list + board) · Projects + project detail · Notes/project context · Calendar month view · Settings data export · landing page · self-host basics.

### Phase 2, after MVP
Timeline v1 · dependencies · recurring tasks · week calendar · task templates · guided import · mobile/PWA polish.

### Deferred
Native mobile apps · AI · time tracking · resource inventory · team capacity/workload · billing/pricing · real-time collaboration · full external calendar sync · heavy automations.

### Feature priority (research-weighted)

| Feature | Demand | Cost | MVP? |
|---|---|---|---|
| Quick capture | High | Low | Yes — build early |
| Inbox triage | High | Medium | Yes — build early |
| Task list | High | Medium | Core |
| Board view | Medium | Medium | View toggle |
| Project overview | High | Medium | Core |
| Notes | High | Medium | Core |
| Project docs | Med/High | Medium | Advanced/default-off; backend exists, not a core MVP tab |
| Calendar month | High | Medium | Task view |
| Timeline/Gantt | High | High | Phase 2 |
| Dependencies | High | Med/High | Phase 2, model early |
| Recurring tasks | Med/High | Medium | Phase 2 |
| Mobile PWA polish | Med/High | Medium | Phase 2/3 |
| Family sharing | Medium | High | Later |
| Time tracking | Medium | High | Later — avoid scope creep |
| Resource inventory | Low, team-specific | High | No |
| AI categorization | Future | High | No |

Ticket-level breakdown of all of the above lives in `EXECUTION.md`.

---

## 12. Landing Page Direction

Product-first, image-light, aligned with the current app style. No generated landscapes, campsite art, tents, campfires, mountains, forest scenes, characters, or a green-heavy design system.

**Public copy rule:** talk like a normal product website. Short, human, clear. No scary internal wording.

**Approved phrases:** Self-host now · Cloud soon · Try demo · Demo mode · Changes are disabled · Free to self-host · Paid cloud coming · Run PlanGlade yourself · A calmer way to manage projects.

**Avoid on public pages:** technical users · production hardening · currently planned · being prepared · not currently available · active development · future cloud foundation · operational maturity. These may appear in internal planning docs when needed, not in marketing copy.

**First live website structure:** header → hero → product preview/feature strip → available/coming-soon status → simple pricing teaser → FAQ → final CTA → footer.

**Hero headline:** "A calm clearing for your projects."
**Supporting copy:** "Open-source workspace for tasks, projects, notes, calendar planning, and getting work out of your head."
**Status line:** "Self-host now. Cloud soon."
**CTAs:** View on GitHub · Self-host PlanGlade · Try demo.

**Feature labels:** Tasks · Projects · Notes · Inbox · Calendar.

**Status block:**
- Available now: Self-host.
- Coming soon: Cloud.
- Available now: Demo mode.

**Demo rule:** public demo is read-only. Visitors may browse, open, filter, and navigate. They may not create, edit, delete, upload, invite, export, change settings, trigger emails, or change workspace data. Blocked actions use: "Demo mode — changes are disabled."

**Demo data direction:** use broad sample projects, not PlanGlade's own work: Small bakery launch, Student thesis plan, Home renovation, Freelance client website, Community event, and Open-source release.

**Simple pricing copy for first website:**
- Self-hosted: Free.
- Cloud: Paid plan coming soon.

Do not add checkout, fake testimonials, fake user counts, fake analytics, or a full SaaS pricing page until `SAAS-LAUNCH.md` exit criteria are met. Demo must stay read-only.

Full SaaS/website plan lives in `SAAS-LAUNCH.md`.

## 13. Open Source, Self-Hosting, and Monetization

PlanGlade is free, self-hosted, and open-source. The first public website should say this simply: **Self-host now. Cloud soon.**

**License:** AGPL-3.0 — decided (chosen for clone protection over Apache-2.0/MIT permissiveness; confirmed live in the public package as `AGPL-3.0-only`). This is settled, not an open comparison anymore.

**Self-host boundary:** the open-source/self-hosted version should include the core app features people need to actually use PlanGlade: tasks, projects, inbox, notes/docs, calendar, settings/export, auth needed for self-hosting, migrations, Docker/self-host docs, backup/restore docs, and health checks as they mature.

**Private SaaS/business boundary:** the public repo does not need to include the hosted-cloud billing setup, private customer analytics dashboards, payment-provider secrets, internal deployment runbooks, private marketing experiments, private support tooling, or business-only infrastructure settings.

**Monetization direction:** self-host is free. Hosted cloud will be paid. Internal target for later pricing is **$9/month or $90/year** for the first simple hosted plan, but the first website should only say **Paid cloud coming** until checkout, support, privacy, backup, and billing paths are real.

**Open tension worth tracking:** PlanGlade's auth/storage layer supports Firebase as well as self-hosted NextAuth (see `TECHNICAL.md §3.2`). Whether leaning on a proprietary Google service as one of two first-class paths sits comfortably next to an AGPL, self-host-first pitch is an open positioning question, not yet resolved — logged in `EXECUTION.md §6`.

Full launch/business detail lives in `SAAS-LAUNCH.md`.

## 14. What to Avoid

Building ClickUp. Building Notion. Building Jira. Building MS Project. Making the app cute. Adding team/admin clutter early. Splitting tasks and calendar into separate records. Showing unbuilt features in UI or landing. Shipping a complex empty dashboard. Requiring system configuration before the first capture. Hiding simple actions behind deep menus. Adding checkout before cloud is real. Using long internal-risk wording on public pages.

---

## 15. Research Appendix

Twelve community threads were used to ground the decisions above (full signal mapping in §3):

| # | Thread | Community | Date | Score |
|---|---|---|---|---|
| 1 | PM + note-taking apps — 15hr research share | r/productivity | 2023-03 | 345 |
| 2 | Solo-friendly PM tool with timeline + calendar | r/ProductivityApps | 2025-04 | 10 |
| 3 | Looking for the right PM tools/apps | r/projectmanagement | 2023-03 | 35 |
| 4 | PM tool for personal use | r/webdev | 2024-10 | 7 |
| 5 | PM tools ranked + comparison (2026 update) | r/projectmanagement | 2026-02 | 99 |
| 6 | Seeking simple PM app | r/projectmanagement | 2023-04 | 31 |
| 7 | What PM tools do you recommend? | r/projectmanagement | 2025-04 | 86 |
| 8 | Task app for family use | r/productivity | 2024-10 | 8 |
| 9 | Best app for task/PM? | r/productivity | 2024-02 | 34 |
| 10 | Which software for PM? | r/projectmanagement | 2023-09 | 33 |
| 11 | Task/PM app with a solid time tracker | r/ProductivityApps | 2025-08 | 3 |
| 12 | Best task/PM apps currently? | r/productivity | 2025-08 | 14 |

**Bottom line from the corpus:** people don't want a bigger ClickUp. They want one calm place where tasks, projects, notes/docs, calendar, and timeline planning use the same underlying work item — without Notion's setup burden, ClickUp/Jira's team bloat, or Trello/Todoist's shallow limits.
