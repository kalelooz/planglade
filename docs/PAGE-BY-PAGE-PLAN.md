# FlowBoard Page-by-Page Plan

## Goal

Turn the current prototype into a reliable frontend product one page at a time. Each page should become simpler, more honest, and more useful before moving to the next.

## Working Rules

- Start each work session with a short TODO list.
- Finish and validate one slice before starting the next.
- Prefer existing shadcn/Radix/Tailwind/Lucide/TanStack/Zustand patterns.
- Do not add backend, auth, or database depth unless it is required to validate a frontend slice.
- Do not polish fake actions. Make them real, disable them, or clearly remove them.
- Do not delete `Reddit/`.

## Page Order

### 1. App Shell

Purpose: make the app feel calm, focused, and trustworthy before page work begins.

- [ ] Rename the default experience from Dashboard to Home where appropriate.
- [ ] Keep primary navigation small: Home, Inbox, Projects, My Tasks, Notes, Calendar.
- [ ] Move Graph, Activity, Team, Reports, and other low-priority screens behind Advanced/More.
- [ ] Remove or hide fake notification chrome.
- [ ] Keep one primary action in the header: Quick Capture or `+ New`.
- [ ] Remove duplicate page titles between header and content.

Verify:

- [ ] Sidebar has clear primary and advanced grouping.
- [ ] Header does not show fake notifications or decorative controls.
- [ ] The current location is obvious.
- [ ] Desktop and mobile screenshots do not show overlapping text or crushed controls.

### 2. Home

Purpose: replace the generic dashboard with the daily cockpit.

- [ ] Add Quick Capture at the top.
- [ ] Show Today, Overdue, Inbox, and Recently Changed/Recent Notes.
- [ ] Remove vanity KPIs unless clicking them reveals the exact underlying work.
- [ ] Make empty states action-oriented.
- [ ] Keep team or reporting content off the first screen unless the data is real.

Verify:

- [ ] A new user can understand the screen in about 5 seconds.
- [ ] A task can be captured in under 5 seconds.
- [ ] No first-screen action pretends to persist if it does not.
- [ ] The first screen has one clear focal area and one primary action.

### 3. Projects / Kanban

Purpose: keep the board simple and connect it to trustworthy task state.

- [ ] Reduce card metadata to what helps scanning: title, status/priority cue, due signal, and one project/tag cue.
- [ ] Move extra information into the drawer.
- [ ] Make create/edit/delete/move actions mutate shared state or clearly mark them as unavailable.
- [ ] Keep the inner project list compact and keyboard/mouse usable.
- [ ] Avoid project/report shortcuts that imply real reporting before reports are real.

Verify:

- [ ] Moving a task changes its status in every view that reads task state.
- [ ] Creating a task makes it visible in Projects and My Tasks.
- [ ] Deleting a task removes it from all task-driven views.
- [ ] Board density remains readable on desktop and usable on mobile.

### 4. My Tasks

Purpose: make the personal work list reliable.

- [ ] Replace fake bulk actions with real mutations or disable them.
- [ ] Add useful filters: Today, Overdue, Upcoming, Blocked, No Date.
- [ ] Keep table/list density compact but readable.
- [ ] Add inline editing only after the shared store exists.
- [ ] Ensure rows open the same universal drawer as other views.

Verify:

- [ ] Bulk complete/delete/move changes real task state.
- [ ] Filters visibly affect the row set and expose active filter state.
- [ ] Editing a task updates Kanban, Home, Calendar, and Timeline where applicable.
- [ ] Empty states tell the user what to do next.

### 5. Notes

Purpose: make notes fast to capture and easy to find.

- [ ] Add notes search.
- [ ] Make capture/edit mode obvious.
- [ ] Improve selected-note state and list readability.
- [ ] Keep Markdown support.
- [ ] Prepare for task links and checkbox-to-task conversion without overbuilding it yet.

Verify:

- [ ] Search finds note titles, body text, and tags.
- [ ] Creating a note updates the note list immediately.
- [ ] The editor/preview state is clear.
- [ ] Notes do not rely on hidden inaccessible controls.

### 6. Calendar

Purpose: make dated work visible and actionable.

- [ ] Drive calendar items from real task dates.
- [ ] Fix date parsing so years are explicit and stable.
- [ ] Show useful task text before truncation.
- [ ] Add creation affordance on empty days only after create flow is real.
- [ ] Consider week view after month view is trustworthy.

Verify:

- [ ] Changing a task due date moves it on the calendar.
- [ ] Undated tasks do not appear in misleading dates.
- [ ] Month view remains readable on desktop and mobile.
- [ ] Calendar data agrees with My Tasks and Home.

### 7. Timeline / Gantt

Purpose: make planning dates visible without adding fragile complexity.

- [ ] Use the current date, not a hardcoded `TODAY`.
- [ ] Drive bars from real start and due dates.
- [ ] Add a clear today marker.
- [ ] Keep dependencies hidden until blocker/dependency state exists.
- [ ] Color bars by consistent status/project rules, not decoration.

Verify:

- [ ] Today's marker matches the actual current date.
- [ ] Editing start/due dates updates the timeline.
- [ ] Overdue work is visually distinct.
- [ ] Timeline agrees with Calendar and My Tasks.

### 8. Advanced Views

Purpose: keep advanced screens from damaging trust.

- [ ] Hide Graph until relationships are real.
- [ ] Hide or demote Activity until actions generate real activity.
- [ ] Hide Team for solo-first MVP unless assignment/workload data is real.
- [ ] Hide Reports until reports derive from the same task/project state.

Verify:

- [ ] Advanced screens are not part of the primary first-run path.
- [ ] Any visible advanced screen clearly uses real data.
- [ ] No advanced screen contradicts task/project state shown elsewhere.

## Cross-Page Done Criteria

- [ ] One source of truth for tasks, projects, notes, members, activity, and settings.
- [ ] Create/edit/delete/move actions update all affected views.
- [ ] Refresh does not lose core user-created work once local persistence is introduced.
- [ ] Browser screenshots pass desktop and mobile sanity checks for changed pages.
- [ ] `README.md`, `AUDIT_AND_ROADMAP.md`, and this plan do not contradict the implementation state.
