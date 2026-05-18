# Navigation Restructure & Page Consolidation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure navigation to match roadmap IA, merge redundant pages, hide non-core pages behind "More", and remove fake/premature pages.

**Architecture:** Modify the shared `AppShell` sidebar to reorganize nav hierarchy, merge `/work-items` functionality into `/my-tasks`, hide `/connections`, `/activity`, `/team`, `/report` behind a "More" collapsible section, and remove `/login`.

**Tech Stack:** Next.js App Router, React, Zustand, Lucide icons, Tailwind CSS

---

## File Map

| File | Action | Reason |
|------|--------|--------|
| `src/components/lovable/shell.tsx` | Modify | Reorganize nav: move Notes/Calendar to primary, add "More" collapsible for advanced pages |
| `src/app/my-tasks/page.tsx` | Modify | Absorb `/work-items` due-date filtering and project scoping |
| `src/app/work-items/` | Delete | Redundant with `/my-tasks` after merge |
| `src/app/login/` | Delete | No real auth, premature |
| `src/app/connections/page.tsx` | No change | Already accessible, just hidden from nav |
| `src/app/activity/page.tsx` | No change | Already accessible, just hidden from nav |
| `src/app/team/page.tsx` | No change | Already accessible, just hidden from nav |
| `src/app/report/page.tsx` | No change | Already accessible, just hidden from nav |
| `src/app/timeline/page.tsx` | No change | Moved to "More" section in nav |

---

## Chunk 1: Reorganize Sidebar Navigation

### Task 1: Restructure shell.tsx navigation

**Files:**
- Modify: `src/components/lovable/shell.tsx:64-92`

**Current nav structure:**
- `navBeforeProjects`: Today, Inbox, My Tasks
- `navAfterProjects`: (empty)
- `navAdvanced`: Notes, Calendar, Timeline, Connections, Activity, Team, Project Report

**Target nav structure:**
- `navBeforeProjects`: Today, Inbox, My Tasks
- `navAfterProjects`: Notes, Calendar
- `navMore` (new, behind collapsible "More"): Timeline, Connections, Activity, Team, Project Report

- [ ] **Step 1: Read current shell.tsx nav section**

Read lines 64-92 of `src/components/lovable/shell.tsx` to see current nav arrays.

- [ ] **Step 2: Update nav arrays in shell.tsx**

Replace the nav section (lines 64-85) with:

```tsx
const navBeforeProjects: NavItem[] = [
  { to: "/", label: "Today", icon: Home, count: todayCount },
  { to: "/inbox", label: "Inbox", icon: Inbox, count: inboxCount },
  { to: "/my-tasks", label: "My Tasks", icon: CheckSquare, count: myTasksCount },
];
const navAfterProjects: NavItem[] = [
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/calendar", label: "Calendar", icon: Calendar },
];

const navMore = [
  { to: "/timeline", label: "Timeline", icon: BarChart3 },
  { to: "/connections", label: "Connections", icon: Network },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/team", label: "Team", icon: Users },
  { to: "/report", label: "Project Report", icon: BarChart3 },
];
```

- [ ] **Step 3: Add "More" collapsible state**

Add a new state variable for the "More" section toggle, similar to how `projectsOpen` works. Add after line 58:

```tsx
const [moreOpen, setMoreOpen] = useState<boolean>(() => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("fb.sidebarMoreOpen") === "1";
});
```

Add a localStorage sync effect after the projectsOpen effect (after line 114):

```tsx
useEffect(() => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem("fb.sidebarMoreOpen", moreOpen ? "1" : "0");
  }
}, [moreOpen]);
```

- [ ] **Step 4: Update expanded sidebar nav rendering**

Replace the expanded sidebar nav section (lines 193-225). The current structure is:
```
navBeforeProjects
Projects collapsible
navAfterProjects (empty)
"Advanced" label
navAdvanced
```

Change to:
```
navBeforeProjects
Projects collapsible
navAfterProjects (Notes, Calendar)
"More" collapsible (Timeline, Connections, Activity, Team, Project Report)
```

The new expanded nav should be:

```tsx
{sidebarOpen ? (
  <>
    <SidebarSection items={navBeforeProjects} isActive={isActive} collapsed={false} />
    <ProjectsNavItem
      href="/projects"
      active={isActive("/projects")}
      open={projectsOpen}
      onToggle={() => setProjectsOpen((v) => !v)}
    />
    {projectsOpen && (
      <div className="mt-0.5 mb-1 space-y-px pl-5">
        {projects.map((p) => {
          const active = path.startsWith("/projects") && (routeProjectId ?? activeProjectId) === p.id;
          return (
            <Link key={p.id} href={`/projects?project=${p.id}`} onClick={() => updateSettings({ activeProjectId: p.id })}
              className={`lov-nav-item group gap-2 px-2 py-1 text-[12.5px] ${active ? "lov-nav-item-active font-medium" : ""}`}>
              <ProjectIcon name={p.icon} accent={p.accent} size={13} />
              <span className="truncate">{p.name}</span>
            </Link>
          );
        })}
      </div>
    )}
    <SidebarSection items={navAfterProjects} isActive={isActive} collapsed={false} />
    <SidebarCollapsible
      label="More"
      open={moreOpen}
      onToggle={() => setMoreOpen((v) => !v)}
    >
      <SidebarSection items={navMore} isActive={isActive} collapsed={false} />
    </SidebarCollapsible>
  </>
) : (
  <>
    <SidebarSection items={navMain} isActive={isActive} collapsed={true} />
    <SidebarSection items={navAfterProjects} isActive={isActive} collapsed={true} />
    <SidebarSection items={navMore} isActive={isActive} collapsed={true} />
  </>
)}
```

- [ ] **Step 5: Create SidebarCollapsible component**

Add a new component before the closing of the file (before the `ProjectsNavItem` function). This is a reusable collapsible section with a label and chevron:

```tsx
function SidebarCollapsible({ label, open, onToggle, children }: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-1">
      <div className={`group flex items-center gap-px rounded hover:bg-[var(--color-hover)]`}>
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          {label}
        </button>
      </div>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}
```

- [ ] **Step 6: Update collapsed (icon rail) nav**

When sidebar is collapsed, the icon rail should also show the "More" items. Update the collapsed branch to include `navMore` items (already done in Step 4's collapsed branch).

- [ ] **Step 7: Update mobile nav**

The mobile nav (lines 367-393) mirrors the desktop nav. Update it to match the new structure:

Replace the mobile nav section with the same hierarchy:
```
navBeforeProjects
Projects collapsible
navAfterProjects
"More" collapsible
```

Add `moreOpen` state usage for mobile (can use a separate mobileMoreOpen state or share the same one). For simplicity, share the same `moreOpen` state.

- [ ] **Step 8: Update navMain for collapsed rail**

Update `navMain` (line 71-75) to include `navAfterProjects` items so they appear in the collapsed icon rail:

```tsx
const navMain: NavItem[] = [
  ...navBeforeProjects,
  { to: "/projects", label: "Projects", icon: FolderKanban },
  ...navAfterProjects,
];
```

- [ ] **Step 9: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 10: Quick visual check**

Start dev server and verify:
- Primary nav shows: Today, Inbox, My Tasks, Projects, Notes, Calendar
- "More" section is collapsed by default, expandable
- When expanded, "More" shows: Timeline, Connections, Activity, Team, Project Report
- Collapsed icon rail shows all items as icons
- Mobile nav matches desktop structure

---

## Chunk 2: Merge /work-items into /my-tasks

### Task 2: Absorb work-items features into my-tasks

**Files:**
- Modify: `src/app/my-tasks/page.tsx`
- Delete: `src/app/work-items/`

The `/work-items` page has these unique features not in `/my-tasks`:
1. Grouped-by-status collapsible sections
2. Due-date filter (All/Today/Overdue/Upcoming/No date)
3. Inline project scoping via URL param `?project=`

`/my-tasks` already has:
1. Sortable table with scope toggle (Mine/Others/All)
2. Status/priority/project filters
3. Text search
4. Column sorting

- [ ] **Step 1: Read both pages**

Read `src/app/my-tasks/page.tsx` and `src/app/work-items/page.tsx` to understand both implementations.

- [ ] **Step 2: Add due-date filter to my-tasks**

Add a due-date filter toggle to `/my-tasks` similar to `/work-items`. Add state:

```tsx
const [dueFilter, setDueFilter] = useState<"all" | "today" | "overdue" | "upcoming" | "none">("all");
```

Add filter UI as a row of toggle buttons above the table.

- [ ] **Step 3: Add status grouping toggle**

Add a toggle to switch between "flat table" view (current my-tasks) and "grouped by status" view (from work-items). State:

```tsx
const [grouped, setGrouped] = useState(false);
```

When `grouped` is true, render collapsible status sections like `/work-items` does.

- [ ] **Step 4: Ensure project URL param works**

Verify that `?project=` URL param filtering works in my-tasks (it already has project filter, just ensure URL param sync).

- [ ] **Step 5: Update any links pointing to /work-items**

Search for references to `/work-items` in the codebase:

Run: `rg "work-items" src/`

Update any links to point to `/my-tasks` instead.

- [ ] **Step 6: Delete /work-items directory**

After verifying no remaining references:

```bash
Remove-Item -Recurse -Force "src/app/work-items"
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Chunk 3: Remove /login Page

### Task 3: Delete login page

**Files:**
- Delete: `src/app/login/`

- [ ] **Step 1: Check for login references**

Search for references to `/login`:

Run: `rg "login" src/`

If any links point to `/login`, remove or comment them out.

- [ ] **Step 2: Delete the login directory**

```bash
Remove-Item -Recurse -Force "src/app/login"
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

---

## Chunk 4: Verification & Cleanup

### Task 4: Final verification

- [ ] **Step 1: TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Dev server check**

Start dev server and verify:
- `/` loads as Today view
- `/inbox` loads
- `/my-tasks` loads with new due-date filter and grouping toggle
- `/projects` loads
- `/notes` loads
- `/calendar` loads
- `/timeline` accessible via "More" menu
- `/connections` accessible via "More" menu
- `/activity` accessible via "More" menu
- `/team` accessible via "More" menu
- `/report` accessible via "More" menu
- `/settings` loads
- `/work-items` returns 404 (deleted)
- `/login` returns 404 (deleted)
- Sidebar shows correct nav hierarchy
- "More" section expands/collapses correctly
- Mobile nav matches desktop

- [ ] **Step 3: Commit**

```bash
git add src/
git commit -m "refactor: restructure navigation, merge work-items into my-tasks, remove login

- Move Notes and Calendar to primary nav
- Add collapsible More section for Timeline, Connections, Activity, Team, Report
- Merge /work-items due-date filter and grouping into /my-tasks
- Delete /work-items route (redundant)
- Delete /login route (no real auth)"
```

---

## Summary of Changes

| Change | Impact | Risk |
|--------|--------|------|
| Shell nav restructure | All pages (shared component) | Low - nav only, no data changes |
| Merge work-items → my-tasks | Users of /work-items | Low - same data source |
| Delete /work-items | Route removed | None if no external links |
| Delete /login | Route removed | None - no real auth exists |
| Add "More" collapsible | Nav only | Low - localStorage persisted |
