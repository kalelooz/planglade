import type { ReactNode } from "react";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  FileText,
  FolderKanban,
  Home,
  Inbox,
  ListTodo,
  PanelLeft,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { PlanGladeMark } from "@/components/brand/plan-glade-mark";

const SHOWCASE_NAV = [
  "Home",
  "Inbox",
  "Tasks",
  "Projects",
  "Notes",
  "Calendar",
  "Settings",
] as const;

const sidebarProjects = [
  "PlanGlade Public Launch",
  "General",
  "Self-hosting Docs",
  "Landing Page Polish",
] as const;

const todayTasks = [
  {
    title: "Capture clean app screenshots",
    project: "PlanGlade Public Launch",
    priority: "P1",
    meta: "Today",
  },
  {
    title: "Review README setup flow",
    project: "Self-hosting Docs",
    priority: "P2",
    meta: "Today",
  },
  {
    title: "Confirm no fake hosted-cloud claims",
    project: "Landing Page Polish",
    priority: "P2",
    meta: "Today",
  },
] as const;

const attentionTasks = [
  {
    title: "Validate public repo hygiene files",
    project: "PlanGlade Public Launch",
    priority: "P1",
    meta: "Overdue",
  },
  {
    title: "Write screenshot review notes",
    project: "Landing Page Polish",
    priority: "P2",
    meta: "Yesterday",
  },
] as const;

const capturedTasks = [
  {
    title: "Review self-host setup",
    project: "Inbox",
    priority: "P2",
    meta: "Captured",
  },
  {
    title: "Draft launch notes",
    project: "Inbox",
    priority: "P3",
    meta: "Captured",
  },
  {
    title: "Triage beta feedback",
    project: "Inbox",
    priority: "P3",
    meta: "Captured",
  },
] as const;

const projectFocus = [
  {
    name: "PlanGlade Public Launch",
    state: "2 overdue",
    next: "Next / Capture clean app screenshots",
    progress: 72,
    danger: true,
  },
  {
    name: "Self-hosting Docs",
    state: "5 open",
    next: "Next / Review README setup flow",
    progress: 54,
    danger: false,
  },
  {
    name: "Landing Page Polish",
    state: "3 open",
    next: "Next / Confirm no fake hosted-cloud claims",
    progress: 64,
    danger: false,
  },
] as const;

const nextUpTasks = [
  {
    title: "Review self-host setup",
    project: "Self-hosting Docs",
    priority: "P2",
    meta: "Tomorrow",
  },
  {
    title: "Draft launch notes",
    project: "PlanGlade Public Launch",
    priority: "P3",
    meta: "Friday",
  },
] as const;

const recentContext = [
  {
    title: "Public launch checklist",
    kind: "Note",
    meta: "Today",
  },
  {
    title: "Self-hosting gaps",
    kind: "Note",
    meta: "Today",
  },
  {
    title: "Screenshot review notes",
    kind: "Note",
    meta: "Yesterday",
  },
  {
    title: "Security baseline reminders",
    kind: "Note",
    meta: "Jun 26",
  },
] as const;

type TaskLike = {
  title: string;
  project: string;
  priority: string;
  meta: string;
};

export function ProductShowcase() {
  return (
    <section
      id="product-showcase"
      aria-label="PlanGlade product preview"
      className="relative isolate scroll-mt-16 overflow-hidden border-b border-zinc-200 bg-zinc-50"
    >
      <ShowcaseBackdrop />
      <div className="relative z-10 mx-auto w-[min(1180px,calc(100vw-48px))] max-w-[1180px] pb-16 pt-12 sm:pb-20 sm:pt-16">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
              Product preview
            </p>
            <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-zinc-900 sm:text-[26px]">
              A static Home screen replica.
            </h2>
          </div>
          <p className="text-[12px] text-zinc-500">
            Static mock - not real data.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_24px_80px_rgb(39_39_42_/_0.14)]">
          <div className="flex min-h-[660px] bg-white text-zinc-900">
            <ShowcaseSidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <ShowcaseTopbar />
              <main className="min-w-0 flex-1 overflow-hidden bg-white">
                <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
                  <div className="space-y-8">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Overview Dashboard
                      </p>
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-[22px] font-semibold tracking-tight text-zinc-950">
                            Good morning, Alex
                          </h3>
                          <p className="mt-1 text-[11px] text-zinc-500">
                            Saturday, June 27. <span className="underline decoration-dotted underline-offset-2">3 today</span>,{" "}
                            <span className="font-medium text-red-600 underline decoration-dotted underline-offset-2">2 overdue</span>,{" "}
                            <span className="underline decoration-dotted underline-offset-2">3 captured</span>.
                          </p>
                        </div>
                        <span className="font-mono text-[10px] text-zinc-400">
                          PlanGlade Public Launch
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                      <div className="min-w-0 space-y-8 lg:col-span-8">
                        <section>
                          <SectionHeader title="Today's Focus" count={todayTasks.length} />
                          <TaskPanel>
                            {todayTasks.map((task) => (
                              <TaskRow key={task.title} task={task} />
                            ))}
                          </TaskPanel>
                        </section>

                        <section>
                          <SectionHeader
                            title="Attention Required"
                            count={attentionTasks.length}
                            icon={<AlertCircle className="h-3.5 w-3.5" />}
                          />
                          <div className="rounded-xl border border-red-100/80 bg-red-50/30 p-1 shadow-xs">
                            <div className="divide-y divide-red-100/70 rounded-lg bg-white/70">
                              {attentionTasks.map((task) => (
                                <TaskRow key={task.title} task={task} danger />
                              ))}
                            </div>
                          </div>
                        </section>

                        <section>
                          <SectionHeader
                            title="Recently Captured"
                            count={capturedTasks.length}
                            icon={<Inbox className="h-3.5 w-3.5" />}
                            action="Open Inbox"
                          />
                          <TaskPanel>
                            {capturedTasks.map((task) => (
                              <TaskRow key={task.title} task={task} />
                            ))}
                          </TaskPanel>
                        </section>
                      </div>

                      <aside className="min-w-0 space-y-8 lg:col-span-4">
                        <section>
                          <SectionHeader
                            title="Project Focus"
                            count={projectFocus.length}
                            icon={<FolderKanban className="h-3.5 w-3.5" />}
                          />
                          <div className="rounded-lg border border-zinc-200/80 bg-white shadow-xs">
                            <div className="divide-y divide-zinc-100">
                              {projectFocus.map((project) => (
                                <ProjectFocusRow key={project.name} project={project} />
                              ))}
                            </div>
                          </div>
                        </section>

                        <section>
                          <SectionHeader
                            title="Next Up"
                            count={nextUpTasks.length}
                            icon={<CalendarDays className="h-3.5 w-3.5" />}
                            action="Calendar"
                          />
                          <TaskPanel compact>
                            {nextUpTasks.map((task) => (
                              <TaskRow key={task.title} task={task} compact />
                            ))}
                          </TaskPanel>
                        </section>

                        <section>
                          <SectionHeader
                            title="Recent Context"
                            count={recentContext.length}
                            icon={<FileText className="h-3.5 w-3.5" />}
                            action="Notes"
                          />
                          <div className="rounded-lg border border-zinc-200/80 bg-white shadow-xs">
                            <div className="divide-y divide-zinc-100">
                              {recentContext.map((row) => (
                                <ContextRow key={row.title} row={row} />
                              ))}
                            </div>
                          </div>
                        </section>
                      </aside>
                    </div>
                  </div>
                </div>
              </main>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ShowcaseBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-showcase-geometric-background="visible-neutral-layers"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      <div
        className="absolute inset-0 opacity-90"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(212 212 216 / 0.8) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />
      <div
        className="absolute inset-x-0 top-[-80px] h-[420px]"
        style={{
          background:
            "radial-gradient(70% 70% at 50% 34%, rgb(228 228 231 / 0.9) 0%, rgb(244 244 245 / 0.45) 42%, rgb(250 250 250 / 0) 78%)",
        }}
      />
      <svg
        className="absolute left-1/2 top-8 h-[520px] w-[1040px] -translate-x-1/2 opacity-70"
        viewBox="0 0 1040 520"
        fill="none"
        preserveAspectRatio="none"
      >
        {Array.from({ length: 13 }).map((_, index) => (
          <line
            key={`mesh-a-${index}`}
            x1={index * 88}
            y1="520"
            x2={220 + index * 88}
            y2="0"
            stroke="rgb(212 212 216)"
            strokeOpacity="0.58"
          />
        ))}
        {Array.from({ length: 9 }).map((_, index) => (
          <line
            key={`mesh-b-${index}`}
            x1={-160 + index * 150}
            y1="0"
            x2={120 + index * 150}
            y2="520"
            stroke="rgb(228 228 231)"
            strokeOpacity="0.72"
          />
        ))}
      </svg>
    </div>
  );
}

function ShowcaseSidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50/90 md:flex">
      <div className="flex h-12 items-center justify-between border-b border-zinc-200 px-3">
        <div className="flex min-w-0 items-center gap-2">
          <PlanGladeMark />
          <span className="truncate text-[15px] font-semibold tracking-tight text-zinc-950">
            PlanGlade
          </span>
        </div>
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-500">
          <PanelLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>

      <nav aria-label="Preview sidebar" className="flex-1 overflow-hidden px-2 py-3">
        <div className="space-y-px">
          {SHOWCASE_NAV.slice(0, 3).map((item) => (
            <SidebarNavItem key={item} item={item} active={item === "Home"} />
          ))}
        </div>
        <div className="mt-1">
          <SidebarNavItem item="Projects" />
          <div className="mb-1 mt-0.5 space-y-px pl-5">
            {sidebarProjects.map((project) => (
              <div
                key={project}
                className="flex min-w-0 items-center gap-2 rounded px-2 py-1 text-[12.5px] text-zinc-500"
              >
                <span className="h-2 w-2 shrink-0 rounded-sm border border-zinc-300 bg-white" />
                <span className="truncate">{project}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-px">
          {SHOWCASE_NAV.slice(4, 6).map((item) => (
            <SidebarNavItem key={item} item={item} />
          ))}
        </div>
      </nav>

      <div className="border-t border-zinc-200 p-3">
        <SidebarNavItem item="Settings" />
      </div>
    </aside>
  );
}

function SidebarNavItem({
  item,
  active = false,
}: {
  item: (typeof SHOWCASE_NAV)[number];
  active?: boolean;
}) {
  const Icon =
    item === "Home"
      ? Home
      : item === "Inbox"
        ? Inbox
        : item === "Tasks"
          ? ListTodo
          : item === "Projects"
            ? FolderKanban
            : item === "Notes"
              ? FileText
              : item === "Calendar"
                ? CalendarDays
                : Settings;

  return (
    <div
      className={`flex items-center gap-2 rounded px-2 py-1 text-[13px] ${
        active ? "bg-zinc-100 text-zinc-950" : "text-zinc-500"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="flex-1 truncate">{item}</span>
      {item === "Home" ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-200 px-1.5 text-[10px] font-semibold tabular-nums text-zinc-700">
          3
        </span>
      ) : null}
      {item === "Inbox" ? (
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-zinc-200 px-1.5 text-[10px] font-semibold tabular-nums text-zinc-700">
          3
        </span>
      ) : null}
    </div>
  );
}

function ShowcaseTopbar() {
  return (
    <header className="relative z-10 flex h-12 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/95 px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2 text-[13px]">
        <Home className="h-4 w-4 text-zinc-500 md:hidden" aria-hidden="true" />
        <span className="font-medium text-zinc-900">Home</span>
      </div>
      <div className="flex-1" />
      <div className="hidden min-w-[220px] max-w-[360px] flex-[0_1_28vw] items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] shadow-xs lg:flex">
        <FolderKanban className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate font-semibold text-zinc-900">
          All projects
        </span>
      </div>
      <div className="hidden w-56 min-w-0 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-[12px] text-zinc-500 md:flex">
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">Search or jump...</span>
        <kbd className="rounded border border-zinc-200 bg-white px-1 font-mono text-[10px] text-zinc-400">
          Ctrl K
        </kbd>
      </div>
      <div className="hidden h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-[13px] font-medium text-zinc-700 sm:flex">
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Quick capture</span>
      </div>
      <div
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-zinc-100 text-[11px] font-semibold text-zinc-700">
        A
      </div>
    </header>
  );
}

function SectionHeader({
  title,
  count,
  icon,
  action,
}: {
  title: string;
  count: number;
  icon?: ReactNode;
  action?: string;
}) {
  return (
    <div className="mb-3 flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-zinc-400">{icon}</span> : null}
        <h4 className="truncate text-[10.5px] font-semibold uppercase tracking-wide text-zinc-950">
          {title}
        </h4>
        <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-zinc-200/80 bg-zinc-50 px-2 font-mono text-[10px] font-medium leading-none text-zinc-500">
          {count}
        </span>
      </div>
      {action ? (
        <span className="font-mono text-[10px] text-zinc-500">{action}</span>
      ) : null}
    </div>
  );
}

function TaskPanel({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`divide-y divide-zinc-100 rounded-lg border border-zinc-200/80 bg-white shadow-xs ${
        compact ? "text-[13px]" : ""
      }`}
    >
      {children}
    </div>
  );
}

function TaskRow({
  task,
  danger = false,
  compact = false,
}: {
  task: TaskLike;
  danger?: boolean;
  compact?: boolean;
}) {
  return (
    <div
      className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 rounded-md px-3 py-2.5 ${
        compact ? "text-[13px]" : "text-[13px] sm:grid-cols-[auto_minmax(0,1fr)_auto]"
      }`}
    >
      <span
        aria-hidden="true"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-zinc-300 bg-white"
      />
      <span className="min-w-0 rounded px-1 py-1 text-left">
        <span className="block min-w-0 truncate font-medium text-zinc-900">
          {task.title}
        </span>
      </span>
      <span
        className={`col-start-2 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-zinc-500 ${
          compact
            ? "text-[10.5px]"
            : "text-[12px] sm:col-start-auto sm:min-w-max sm:flex-nowrap sm:justify-end sm:whitespace-nowrap"
        }`}
      >
        <span className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
          <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-zinc-600">
            {task.priority}
          </span>
        </span>
        <span className="hidden min-w-0 max-w-36 truncate text-zinc-500 sm:inline">
          {task.project}
        </span>
        <span
          className={`shrink-0 whitespace-nowrap rounded border border-transparent bg-transparent px-1.5 py-0.5 font-mono text-[10px] ${
            danger ? "font-medium text-red-600" : "text-zinc-500"
          }`}
        >
          {task.meta}
        </span>
      </span>
    </div>
  );
}

function ProjectFocusRow({
  project,
}: {
  project: (typeof projectFocus)[number];
}) {
  return (
    <div className="block px-3 py-2.5">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-xs font-medium text-zinc-950">
          {project.name}
        </span>
        <span
          className={`shrink-0 font-mono text-[10px] ${
            project.danger ? "text-red-600" : "text-zinc-400"
          }`}
        >
          {project.state}
        </span>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full bg-zinc-900"
          style={{ width: `${project.progress}%` }}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[10px] text-zinc-500">
        <span className="min-w-0 truncate">{project.next}</span>
        <span>{project.progress}%</span>
      </div>
    </div>
  );
}

function ContextRow({
  row,
}: {
  row: (typeof recentContext)[number];
}) {
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-md px-3 py-2.5 text-xs">
      <span className="min-w-0 truncate font-medium text-zinc-900">
        {row.title}
      </span>
      <span className="font-mono text-[10px] text-zinc-400">{row.kind}</span>
      <span className="font-mono text-[10px] text-zinc-500">{row.meta}</span>
    </div>
  );
}

export const landingShowcaseRegressionContent = {
  defaultHome: [
    "Overview Dashboard",
    "Today's Focus",
    "Attention Required",
    "Recently Captured",
    "Project Focus",
    "Next Up",
    "Recent Context",
  ],
  mockProjects: [...sidebarProjects],
  mockTasks: [
    ...todayTasks.map((task) => task.title),
    ...attentionTasks.map((task) => task.title),
    ...capturedTasks.map((task) => task.title),
    ...nextUpTasks.map((task) => task.title),
  ],
  mockNotes: recentContext.map((row) => row.title),
  sidebar: SHOWCASE_NAV,
};
