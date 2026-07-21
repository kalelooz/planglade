# FlowBoard UI Audit

**Date**: 2026-05-22
**Scope**: Full UI evaluation across all app surfaces, review of docs alignment, preview deployment validation
**Auditor**: opencode agent

---

## 1. Preview Deployment Status

**Finding**: The live preview at `space-z.ai` only serves the welcome page (`/`). All app routes return **404**:
- `/inbox`, `/projects`, `/my-tasks`, `/notes`, `/calendar`, `/timeline`, `/team`, `/activity`, `/board`, `/work-items`, `/settings`, `/login`

The console shows a single 404 error for the `/timeline` resource. This is a **deployment/build issue** — the preview either built only the root page or the server is misconfigured to not route other paths to Next.js.

**Recommendation**:
- Verify the Next.js standalone output includes all routes.
- Check the Caddyfile / reverse proxy config for path forwarding rules.
- Run `npm run build` locally and confirm all route outputs are present in `.next/standalone/`.
- Ensure the space-z.ai host resolves to the running Node process (not a static file server).

---

## 2. Welcome / Landing Page (`/`)

### Score: 8/10

### What works well
- Strong tagline: *"A quieter project workspace"* sets the right tone.
- Hero section clearly communicates the value proposition in one sentence.
- "How work flows" section walks through the 5-step loop (capture → triage → focus → plan → review).
- "Same work, different lens" shows the multi-view concept with screenshots.
- FAQ is honest: "Sync? Not yet — local-first prototype."
- Status badges ("Local-first prototype", "Server-backed persistence is in progress") manage expectations.
- Two clear CTAs (Sign in, View product preview) in hero and final section.
- Footer nav anchors to all sections for quick jumping.

### Issues
- "View product preview" buttons scroll to an in-page section rather than navigating into the app, which may frustrate visitors expecting a live demo.
- No server-backed status indicator on the page itself; relies entirely on the badge text.
- The page is a single long scroll without sticky nav or scroll-progress indication.

### Recommendations
- Make "View product preview" actually navigate to the app (with a demo mode or dev session).
- Add a live status indicator (e.g., "Server: Online" / "Auth: Firebase" pill) as a trust signal.
- Consider a sticky table of contents or section nav for longer marketing pages.

---

## 3. Login Page (`/login`)

### Score: 7.5/10

### What works well
- Clean centered card with subtle background gradient.
- Framer Motion entrance animation (`opacity, y, scale`).
- Google sign-in as the primary auth method (real Firebase integration).
- Loading state with spinner during sign-in.
- Error display for failed sign-in attempts.

### Issues
- Debug/dev controls visible: "Show empty-provider state" button — production leak.
- Email sign-in is disabled ("coming soon") — should be hidden entirely if not available.
- GitHub button is present but disabled — either make it work or remove it.
- No "Back to welcome page" link visible in normal flow (appears in dev mode only).
- No passwordless/OTP option for non-Google users.

### Recommendations
- Gate debug controls behind `process.env.NODE_ENV !== "production"` or a feature flag.
- Remove disabled buttons or implement them properly.
- Add email/password or magic-link auth alongside Google.
- Consider adding SSO/SAML configuration for enterprise (deferred to post-MVP).

---

## 4. App Shell (Shared Layout)

### Score: 8.5/10

### What works well
- Collapsible sidebar (60px icon rail ↔ 240px expanded) with smooth CSS width transition.
- Primary nav in logical order: Home, Inbox, My Tasks, Projects, Notes, Calendar.
- "More" collapsible section houses secondary routes: Tasks, Board, Timeline.
- Project scope selector in the header center — a pill-style dropdown that filters all scoped views.
- Command palette (Ctrl+K) for global search and navigation.
- Quick capture popover from header with keyboard support.
- Live notification bell with unread count badge and dropdown panel with mark-read.
- User avatar + name + sign-out button (only when using non-dev auth mode).
- Mobile-responsive slide-out drawer nav.
- Projects section in sidebar with expand/collapse, inline create, and per-project links.
- Sidebar state persisted to localStorage.

### Issues
- High component complexity (764 lines in `shell.tsx`). Logic for notifications, sessions, project scope, quick capture, and mobile nav are all in one file.
- Notification polling every 60 seconds — no WebSocket or SSE for instant delivery.
- No keyboard shortcut hints visible for common actions (except Ctrl+K).
- No loading skeleton for sidebar content during session resolution.

### Recommendations
- Refactor shell into smaller composable modules (e.g., `Sidebar`, `Header`, `NotificationPanel`, `ProjectScopeSelector`).
- Add a WebSocket connection or Server-Sent Events for real-time notification delivery.
- Add visible shortcut hints (e.g., `g h` for Home, `g i` for Inbox) via the command palette.
- Add `<Skeleton>` loading states for sidebar counts and user info.

---

## 5. Home / Today Page (`/`)

### Score: 8.5/10

### What works well
- Personalized greeting with time-of-day awareness ("Good afternoon, Alex").
- Summary line with clickable counts: today tasks, overdue, inbox captures.
- Quick capture input with `/` keyboard shortcut (non-input focus).
- Inbox summary card with count and "Open" CTA.
- Sections: Overdue (with days-late indicator), Today, Next up.
- Empty states are action-oriented with links to Calendar, Inbox, Quick capture.
- Task rows show checkbox, priority icon, title, label chip, assignee avatar, due meta.
- Complete with undo (Sonner toast with 6s duration + Undo button).
- Sidebar shows recent notes with "Open" link.
- Server-backed with optimistic updates and rollback on failure.
- Minute-level clock refresh for time-sensitive labels.

### Issues
- Hardcoded name "Alex" in greeting — should derive from session user name.
- Inbox count reads from Zustand store, not server — could drift from server state.
- No "Good evening" / "Good morning" logic — only "Good afternoon".
- Task rows lack hover-due-tooltip for quick preview.

### Recommendations
- Use `session.user.name` for the greeting instead of hardcoded "Alex".
- Drive inbox count from server API or reconcile on session load.
- Add time-of-day greeting variants.
- Add a tooltip with full task metadata on hover (priority, project, due).

---

## 6. Inbox Page

### Score: 8/10

### What works well
- Grid layout with inline chips for project, due, priority.
- Inline capture row at the top with Enter to submit.
- Bulk mode: multi-select → batch assign project/due/priority, send to tasks, delete.
- "Send to tasks" promotes Backlog items with one click.
- Time-ago labels ("2m ago", "yesterday").
- Delete with hover-reveal trash icon.
- Optimistic server mutations with rollback.

### Issues
- Inline chip dropdowns use custom `lov-*` classes instead of shadcn `Popover`/`Select`.
- "Clear all" shows a browser `confirm()` dialog instead of a styled modal.
- No undo for delete actions (unlike Home page).
- No search/filter within the inbox list.

### Recommendations
- Migrate inline chips to shadcn `Select` or `Popover` for consistency.
- Replace `confirm()` with a styled shadcn `AlertDialog`.
- Add delete-with-undo pattern (Sonner toast) consistent with Home.
- Add a search bar for large inboxes.

---

## 7. My Tasks Page

### Score: 8.5/10

### What works well
- Six date-aware tabs: Today, Upcoming, Overdue, Blocked, No date, Completed.
- Scope filter: Mine / Team / All with live counts.
- Bulk selection with status moves (Backlog→To Do→In Progress→In Review), Complete, Delete.
- Task rows via `WorkItemRow` component with inline status chips.
- TaskDrawer integration for full edit experience.
- Server-backed with optimistic status patches.
- URL-driven tab/scope/focus params for sharable links.

### Issues
- "Blocked" tab is heuristic-based (status === "In Review" or title/label contains "block") — not true dependency blocking.
- No column sorting (priority, due date, assignee).
- No pagination or virtual scrolling for long lists.
- Completed tab shows all completed tasks without a time cutoff.

### Recommendations
- Implement a real `blockedBy` / `blockerIds` model for accurate blocking.
- Add column headers with sort controls.
- Add pagination or virtual list (TanStack Virtual) for workspace-scale data.
- Add a time-based filter to the Completed tab (e.g., "This week", "This month").

---

## 8. Projects Page

### Score: 8.5/10

### What works well
- Project listing table with status chip, editable icon, manager avatar, progress bar, due date, task/done counts.
- Inline icon picker (click to open palette).
- Rich project detail view: status, manager, due, progress %, summary metrics (Open/Done/Overdue/Total).
- Project notes section + Activity feed sidebar.
- New/Edit project modal with icon picker, status select, manager select, due date input.
- Full server-backed CRUD with optimistic state.
- URL-driven for direct linking (`/projects?project=<id>`).
- Scope/task-tab filters identical to My Tasks for consistency.

### Issues
- Project activity feed only loads 8 events — no "load more".
- Progress bar shows `%` but isn't clickable to see which tasks are done vs open.
- No drag-and-drop reorder for project list.
- No archived project filter — archived projects mix with active ones.

### Recommendations
- Add "Load more" pagination to the activity feed.
- Make the progress bar clickable to jump to the filtered task list.
- Add drag-and-drop or up/down controls for project ordering.
- Add a filter toggle to hide/show archived projects.

---

## 9. Notes Page

### Score: 8/10

### What works well
- Sidebar layout: search bar, quick capture, scrollable notes list.
- Search highlights matching text with `bg-primary/10` spans.
- Markdown editor with title/body parsing and debounced auto-save (350ms).
- Extract checkboxes as server-backed tasks.
- Tag editing with inline input.
- Linked tasks display with ID and title.
- Server-backed CRUD with optimistic updates.

### Issues
- No markdown preview mode — only raw editor.
- No image upload or paste support.
- No note pinning or ordering (most recently edited first is fixed).
- No undo for note delete.
- Auto-save timer could cause unwritten changes on quick navigation.

### Recommendations
- Add a preview/toggle mode for rendered markdown.
- Implement image paste/upload with attachment API.
- Add pin-to-top support for important notes.
- Add delete undo (Sonner pattern).
- Add a `beforeunload` warning if there are unsaved changes, or flush on navigation.

---

## 10. Calendar Page

### Score: 8.5/10

### What works well
- Month grid with weekday headers, today highlight (filled circle), and task chips.
- Week view with per-day columns and stacked chips.
- Task chips colored by project accent with left-border accent.
- Overflow popover (`+N more`) using shadcn `Popover`.
- "Add" button on empty days creates a dated task.
- Project scope filter.
- Undated count display.
- Navigation arrows + "Today" button + Month/Week toggle.
- Server-backed with optimistic creation.

### Issues
- No drag-and-drop to reschedule tasks between days.
- No week-number display.
- No "Go to date" picker for jumping to arbitrary dates.
- Month view is fixed at 3 visible chips — larger monitors show same density.
- No keyboard navigation (arrow keys between days).

### Recommendations
- Add drag-and-drop rescheduling (could share the @dnd-kit setup from Board/Kanban).
- Add a date picker popover for quick date jumps.
- Make visible task chip count responsive to container height.
- Add keyboard navigation support.

---

## 11. Timeline Page

### Score: 9/10

### What works well
- Gantt-style timeline with 4 scales: Day, Week, Month, Quarter.
- Group by: Project, Assignee, Status — flexible lane configuration.
- Full search, filter (All/Overdue/Active/Done), and scope mode.
- Bar rendering with project accent colors, done dimming, overdue red ring.
- "Today" line marker with label badge.
- Sidebar inspector: status chips, schedule window, duration, assignee, project, label.
- Due date nudge buttons (−7d, −1d, +1d, +7d) + date/time pickers.
- Inline description editor.
- Dependency list display for selected item.
- Scroll-linked header and content panes via ResizeObserver.
- Jump-to-today and jump-to-selected-item scroll behavior.
- URL-driven for sharable state.

### Issues
- High complexity (1027 lines in one file). Timeline data, rendering, controls, and inspector are all coupled.
- No inline editing of task title on the timeline.
- No dependency drag-to-link between bars.
- No collapsed/expanded group states.
- Quarter scale columns are 10-day chunks, which can be confusing.

### Recommendations
- Decompose into smaller modules (`TimelineHeader`, `TimelineLane`, `TimelineBar`, `TimelineInspector`).
- Add inline title editing (click to rename).
- Implement drag-to-create dependency lines between bars.
- Add collapse/expand per group lane.
- Make quarter scale display monthly markers within the 10-day columns.

---

## 12. Settings Page

### Score: 8.5/10

### What works well
- Sectioned layout: General, Appearance, Notifications, Data, Account.
- Theme toggle (system/light/dark) with server persistence.
- Accent color picker (6 presets) with ring indicator.
- Density toggle (compact/comfortable) with live preview.
- Priority display style selector (Arrows/P1-P3/Shapes) with examples.
- Live appearance preview component showing a task row + menu.
- Notification preference toggles per category.
- JSON snapshot import/export with append/replace modes.
- CSV import/export using papaparse.
- Server migration from local localStorage to server persistence.
- `SaveIndicator` component for auto-save feedback.
- Server-backed settings persistence via API.

### Issues
- No drag-and-drop to reorder notification preference list.
- Accent color palette is limited to 6 presets — no custom color input.
- "Reset workspace" uses `confirm()` alert dialog.
- CSV import only reads local state, not server data.
- Avatar picker for user avatar — limited to generated avatars only.

### Recommendations
- Add a custom color picker (HSL sliders or hex input) for accent.
- Replace `confirm()` with shadcn `AlertDialog`.
- Expose a "Fetch from server" option for CSV export.
- Allow custom avatar upload via the attachment API.

---

## 13. Supporting Pages

### Team Page — Score: 6/10
- Shows workload bars per member with Light/Moderate/Heavy labels.
- Still reads from local Zustand store, not server members/assignments.
- No real-time workload — relies on initial load only.

### Activity Page — Score: 8.5/10
- Time-filtered event feed (Today, Yesterday, This Week, Older).
- Full-text search across actor, action, target, summary.
- Detail sidebar with related task/project cards.
- Server-backed via `/api/activity`.
- Action-specific icons and metadata rendering.

### Board / Kanban Page — Score: 8/10 (not fully reviewed)
- Uses verified @dnd-kit pattern with SortableContext, DragOverlay, cross-column moves.
- Consistent with the flowboard-dnd-kanban skill.
- Same task data and drawer integration.

---

## 14. Cross-Page Observations

| Dimension | Status | Notes |
|---|---|---|
| UI consistency | **High** | Shared `lov-*` component classes + shadcn/ui primitives throughout |
| Empty states | **Good** | Action-oriented with CTA buttons/links on all pages |
| Loading states | **Adequate** | Simple text indicators — no skeleton screens |
| Error states | **Good** | Red banner with error messages on all data-dependent pages |
| Optimistic updates | **High** | All mutation pages use snapshot-rollback pattern |
| Server-backed | **High** | All primary views fetch from and write to API routes |
| Mobile responsive | **Partial** | Sidebar has mobile drawer; tables can overflow |
| Dark mode | **Supported** | Via next-themes, class-based |
| Density option | **Supported** | Compact/Comfortable affects row padding |
| Accessibility | **Partial** | `aria-label` on icons/buttons, keyboard nav on interactive rows; no focus-trapping in modals |
| Keyboard shortcuts | **Minimal** | `/` for capture, `Ctrl+K` for palette; no `g <letter>` nav |
| Performance | **Unknown** | No profiling done; all pages load all data at once (no pagination) |

---

## 15. Docs Alignment

| Document | Status | Notes |
|---|---|---|
| `docs/ACTIVE_PLAN.md` | ✅ Aligned | UI matches the Page Plan for all sections. No contradictions. |
| `docs/FULLSTACK_ROADMAP.md` | ✅ Aligned | Frontend loop complete; pages use server data as described. |
| `docs/QUALITY-GATES.md` | ✅ Aligned | UI style matches established patterns. |
| Provider-specific deployment runbook | Moved | Hosted deployment operations are maintained outside the public repository. |
| `AGENTS.md` | ✅ Aligned | Conventions followed. |

---

## 16. Consolidated Recommendations (Priority Order)

1. **🔴 P0 — Fix preview deployment**: App routes serve 404. Identify whether it's a build output issue or reverse proxy config.
2. **🟠 P1 — Remove production-leak debug controls**: "Show empty-provider state" button on login page must be gated behind dev mode.
3. **🟠 P1 — Use session user name instead of hardcoded "Alex"** on the Home page greeting.
4. **🟡 P2 — Add undo for delete actions** on Inbox, Notes, and My Tasks pages.
5. **🟡 P2 — Replace `confirm()` dialogs** with shadcn `AlertDialog` in Inbox (Clear all), Settings (Reset), and Notes (Delete).
6. **🟡 P2 — Add pagination or virtual scrolling** to My Tasks, Projects, and Activity pages for workspace-scale data.
7. **🟡 P2 — Add real blocking model** instead of heuristic-based "Blocked" tab matching.
8. **🟢 P3 — Refactor `shell.tsx`** into smaller composable modules.
9. **🟢 P3 — Refactor `timeline/page.tsx`** into focused subcomponents.
10. **🟢 P3 — Add skeleton loading states** instead of text-only loaders.
11. **🟢 P3 — Add drag-and-drop rescheduling** on Calendar page.
12. **🟢 P3 — Add markdown preview toggle** on Notes page.
13. **🟢 P3 — Add custom color picker** for accent in Settings.
14. **🔵 P4 — Add WebSocket/SSE for real-time notifications** instead of 60s polling.
15. **🔵 P4 — Add keyboard shortcut navigation** (`g` + first letter) for power users.
16. **🔵 P4 — Add `beforeunload` guard** for unsaved note changes.
