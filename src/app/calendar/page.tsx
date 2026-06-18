"use client";
import { Suspense, useEffect, useState, useMemo, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar } from "@/components/lovable/page";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import type { WorkItem, Project } from "@/lib/mock-data";
import { getDatePart, localDateKey, parseLocalDate } from "@/lib/dates";
import { getServerSession } from "@/lib/server-session-client";
import { type ApiProject, type ApiWorkItem, toUiProject, toUiWorkItem } from "@/lib/server-ui-mappers";

// ── Date helpers ──────────────────────────────────────────────────────────────

function toDateKey(d: Date) {
  return localDateKey(d);
}

function parseDue(due: string): Date | null {
  return parseLocalDate(due);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function daysInMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function leadingBlanks(d: Date) {
  const day = startOfMonth(d).getDay();
  return (day + 6) % 7; // Monday = 0
}

function startOfWeek(d: Date): Date {
  const day = d.getDay();
  const diff = (day + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(d.getDate() + n);
  return result;
}

function fullDateLabel(key: string): string {
  const d = parseDue(key);
  if (!d) return key;
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ── Chip styling: project accent drives color, state layers on top ────────────

function chipStyle(accent: string): CSSProperties {
  return {
    borderLeftColor: accent,
  };
}

function TaskChip({
  item,
  accent,
  todayKey,
  onSelect,
  size = "sm",
}: {
  item: WorkItem;
  accent: string;
  todayKey: string;
  onSelect: (id: string) => void;
  size?: "sm" | "md";
}) {
  const isDone = item.status === "Done";
  const dueKey = getDatePart(item.due);
  const isOverdue = !!dueKey && dueKey < todayKey && !isDone;
  const sizing =
    size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]";
  const textTone = isDone
    ? "text-muted-foreground/70 line-through"
    : isOverdue
      ? "text-destructive"
      : "text-foreground";
  return (
    <button
      onClick={() => onSelect(item.id)}
      title={`${item.title} · ${item.status} · ${item.priority}${isOverdue ? " · OVERDUE" : ""}`}
      style={{
        ...chipStyle(accent),
        opacity: isDone ? 0.55 : 1,
      }}
      className={`flex w-full items-center gap-1 truncate rounded border border-zinc-200/40 border-l-2 bg-zinc-100 text-left font-medium transition-opacity hover:opacity-80 ${sizing} ${textTone}`}
    >
      {isOverdue && (
        <span
          aria-hidden
          className="inline-block size-1.5 shrink-0 rounded-full bg-destructive"
        />
      )}
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
    </button>
  );
}

function TaskListItem({
  item,
  accent,
  todayKey,
  onSelect,
}: {
  item: WorkItem;
  accent: string;
  todayKey: string;
  onSelect: (id: string) => void;
}) {
  const dueKey = getDatePart(item.due);
  const isDone = item.status === "Done";
  const isOverdue = !!dueKey && dueKey < todayKey && !isDone;

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      className="flex w-full min-w-0 items-start gap-2 rounded border bg-card px-2.5 py-2 text-left hover:bg-[var(--color-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden
        style={{ backgroundColor: accent }}
        className="mt-1.5 size-2 shrink-0 rounded-full"
      />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[13px] font-medium ${isDone ? "text-muted-foreground line-through" : "text-foreground"}`}>
          {item.title}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>{item.status}</span>
          <span aria-hidden>·</span>
          <span>{item.priority}</span>
          {dueKey && (
            <>
              <span aria-hidden>·</span>
              <span className={isOverdue ? "font-medium text-destructive" : ""}>
                {isOverdue ? "Overdue" : dueKey}
              </span>
            </>
          )}
        </span>
      </span>
    </button>
  );
}

// ── Overflow popover for dense days ───────────────────────────────────────────

function accentFor(item: WorkItem, projectsById: Record<string, Project>): string {
  return projectsById[item.project]?.accent ?? "var(--color-primary)";
}

function DayOverflowPopover({
  items,
  dateKey,
  todayKey,
  projectsById,
  onSelect,
  visibleCount,
}: {
  items: WorkItem[];
  dateKey: string;
  todayKey: string;
  projectsById: Record<string, Project>;
  onSelect: (id: string) => void;
  visibleCount: number;
}) {
  const [open, setOpen] = useState(false);
  const hidden = items.length - visibleCount;
  const handleSelect = (id: string) => {
    setOpen(false);
    onSelect(id);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="block w-full rounded px-1.5 py-0.5 text-left text-[10px] text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground">
          +{hidden} more
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="mb-2 flex items-baseline justify-between border-b pb-1.5">
          <span className="text-[12px] font-semibold">
            {fullDateLabel(dateKey)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {items.length} task{items.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
          {items.map((t) => (
            <TaskChip
              key={t.id}
              item={t}
              accent={accentFor(t, projectsById)}
              todayKey={todayKey}
              onSelect={handleSelect}
              size="md"
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────

const MONTH_VISIBLE = 3;
const WEEKDAY_HEADERS = [
  { short: "M", long: "Mon" },
  { short: "T", long: "Tue" },
  { short: "W", long: "Wed" },
  { short: "T", long: "Thu" },
  { short: "F", long: "Fri" },
  { short: "S", long: "Sat" },
  { short: "S", long: "Sun" },
];

function MonthView({
  cursor,
  itemsByKey,
  todayKey,
  now,
  projectsById,
  selectedDateKey,
  onSelect,
  onCreate,
  onSelectDate,
}: {
  cursor: Date;
  itemsByKey: Record<string, WorkItem[]>;
  todayKey: string;
  now: Date;
  projectsById: Record<string, Project>;
  selectedDateKey: string;
  onSelect: (id: string) => void;
  onCreate: (dateKey: string) => void;
  onSelectDate: (dateKey: string) => void;
}) {
  const isThisMonth =
    cursor.getFullYear() === now.getFullYear() &&
    cursor.getMonth() === now.getMonth();

  const cells = useMemo(() => {
    const dim = daysInMonth(cursor);
    const lead = leadingBlanks(cursor);
    const arr: { day: number | null }[] = [];
    for (let i = 0; i < lead; i++) arr.push({ day: null });
    for (let d = 1; d <= dim; d++) arr.push({ day: d });
    while (arr.length % 7) arr.push({ day: null });
    return arr;
  }, [cursor]);

  return (
    <div className="grid grid-cols-7 gap-2 text-xs">
      {WEEKDAY_HEADERS.map((d, index) => (
        <div
          key={`${d.long}-${index}`}
          className="px-2 py-1 text-center text-[9px] font-bold uppercase tracking-wider text-zinc-400"
        >
          <span className="sm:hidden">{d.short}</span>
          <span className="hidden sm:inline">{d.long}</span>
        </div>
      ))}
      {cells.map((c, idx) => {
        const day = c.day;
        const isToday = !!day && isThisMonth && day === now.getDate();
        const key = day
          ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          : "";
        const dayItems = day ? (itemsByKey[key] ?? []) : [];
        const visible = dayItems.slice(0, MONTH_VISIBLE);
        const hasOverflow = dayItems.length > MONTH_VISIBLE;
        const active = key === selectedDateKey;
        return (
          <div
            key={idx}
            className={`group/day min-h-[80px] rounded-lg border p-2 sm:min-h-24 ${day ? active ? "border-zinc-950 bg-white ring-1 ring-zinc-950" : "border-zinc-200/80 bg-white hover:border-zinc-400" : "border-transparent bg-zinc-50/50"}`}
          >
            {day && (
              <>
                <button
                  type="button"
                  onClick={() => onSelectDate(key)}
                  className={`mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 font-mono text-[10px] ${
                    isToday
                      ? "border border-zinc-950 font-bold text-zinc-950 ring-1 ring-zinc-950"
                      : "font-bold text-zinc-400"
                  }`}
                >
                  {day}
                </button>
                <div className="space-y-0.5">
                  {visible.map((t) => (
                    <TaskChip
                      key={t.id}
                      item={t}
                      accent={accentFor(t, projectsById)}
                      todayKey={todayKey}
                      onSelect={onSelect}
                    />
                  ))}
                  {hasOverflow && (
                    <DayOverflowPopover
                      items={dayItems}
                      dateKey={key}
                      todayKey={todayKey}
                      projectsById={projectsById}
                      onSelect={onSelect}
                      visibleCount={MONTH_VISIBLE}
                    />
                  )}
                  {dayItems.length === 0 && (
                    <button
                      type="button"
                      onClick={() => onCreate(key)}
                      className="flex h-6 w-full items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground opacity-0 transition-opacity hover:border-foreground/25 hover:text-foreground group-hover/day:opacity-100 focus-visible:opacity-100"
                    >
                      <Plus className="mr-1 h-3 w-3" /> Add
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Week view ─────────────────────────────────────────────────────────────────

function WeekView({
  cursor,
  itemsByKey,
  todayKey,
  projectsById,
  onSelect,
  onCreate,
}: {
  cursor: Date;
  itemsByKey: Record<string, WorkItem[]>;
  todayKey: string;
  projectsById: Record<string, Project>;
  onSelect: (id: string) => void;
  onCreate: (dateKey: string) => void;
}) {
  const monday = useMemo(() => startOfWeek(cursor), [cursor]);
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday]
  );

  return (
    <div className="grid h-full grid-cols-7 border-b border-l text-[12px]">
      {days.map((d) => {
        const key = toDateKey(d);
        const isToday = key === todayKey;
        const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
        const dayNum = d.getDate();
        const monthLabel = d.toLocaleDateString("en-US", { month: "short" });
        const dayItems = itemsByKey[key] ?? [];
        return (
          <div key={key} className="flex min-h-0 flex-col border-r border-t">
            <div
              className={`flex shrink-0 items-center gap-1.5 border-b px-2 py-2 ${isToday ? "bg-primary/5" : "bg-sidebar/50"}`}
            >
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {dayLabel}
              </span>
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[12px] font-semibold ${
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                }`}
              >
                {dayNum}
              </span>
              {isToday && (
                <span className="text-[10px] text-muted-foreground">
                  {monthLabel}
                </span>
              )}
              {dayItems.length > 0 && (
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {dayItems.length}
                </span>
              )}
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
              {dayItems.map((t) => (
                <TaskChip
                  key={t.id}
                  item={t}
                  accent={accentFor(t, projectsById)}
                  todayKey={todayKey}
                  onSelect={onSelect}
                />
              ))}
              {dayItems.length === 0 && (
                <button
                  type="button"
                  onClick={() => onCreate(key)}
                  className="mt-2 flex w-full items-center justify-center rounded border border-dashed px-2 py-1 text-[10px] text-muted-foreground hover:border-foreground/25 hover:text-foreground"
                >
                  <Plus className="mr-1 h-3 w-3" /> Add
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MobileAgenda({
  selectedDateKey,
  cursor,
  itemsByKey,
  datedItems,
  undatedItems,
  todayKey,
  projectsById,
  onSelectDate,
  onSelect,
  onCreate,
}: {
  selectedDateKey: string;
  cursor: Date;
  itemsByKey: Record<string, WorkItem[]>;
  datedItems: WorkItem[];
  undatedItems: WorkItem[];
  todayKey: string;
  projectsById: Record<string, Project>;
  onSelectDate: (dateKey: string) => void;
  onSelect: (id: string) => void;
  onCreate: (dateKey: string) => void;
}) {
  const days = useMemo(() => {
    const dim = daysInMonth(cursor);
    return Array.from({ length: dim }, (_, index) => {
      const day = index + 1;
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      return { day, key };
    });
  }, [cursor]);
  const selectedItems = itemsByKey[selectedDateKey] ?? [];
  const upcomingItems = datedItems
    .filter((item) => getDatePart(item.due) >= todayKey)
    .slice(0, 6);

  return (
    <div className="space-y-4 px-3 py-3 md:hidden">
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ day, key }) => {
          const count = itemsByKey[key]?.length ?? 0;
          const active = key === selectedDateKey;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(key)}
              className={`flex h-12 min-w-10 flex-col items-center justify-center rounded border text-[12px] ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
            >
              <span className="font-medium">{day}</span>
              <span className="text-[10px] opacity-75">{count || ""}</span>
            </button>
          );
        })}
      </div>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
            {fullDateLabel(selectedDateKey)}
          </h2>
          <button
            type="button"
            onClick={() => onCreate(selectedDateKey)}
            className="lov-btn lov-btn-ghost h-7 px-2 text-[11px]"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </div>
        {selectedItems.length > 0 ? (
          selectedItems.map((item) => (
            <TaskListItem
              key={item.id}
              item={item}
              accent={accentFor(item, projectsById)}
              todayKey={todayKey}
              onSelect={onSelect}
            />
          ))
        ) : (
          <p className="rounded border border-dashed px-3 py-4 text-[12px] text-muted-foreground">
            No dated tasks for this day.
          </p>
        )}
      </section>

      <TaskSection
        title="Upcoming"
        empty="No upcoming dated tasks."
        items={upcomingItems}
        todayKey={todayKey}
        projectsById={projectsById}
        onSelect={onSelect}
      />
      <TaskSection
        title="No date"
        empty="No tasks without a due date."
        items={undatedItems}
        todayKey={todayKey}
        projectsById={projectsById}
        onSelect={onSelect}
      />
    </div>
  );
}

function TaskSection({
  title,
  empty,
  items,
  todayKey,
  projectsById,
  onSelect,
}: {
  title: string;
  empty: string;
  items: WorkItem[];
  todayKey: string;
  projectsById: Record<string, Project>;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {items.length > 0 ? (
        items.map((item) => (
          <TaskListItem
            key={item.id}
            item={item}
            accent={accentFor(item, projectsById)}
            todayKey={todayKey}
            onSelect={onSelect}
          />
        ))
      ) : (
        <p className="rounded border border-dashed px-3 py-3 text-[12px] text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type CalView = "month" | "week";

function CalendarPageContent() {
  const params = useSearchParams();
  const routeProjectId = params.get("project");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);

  const [cursor, setCursor] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<CalView>("month");
  const [selectedDateKey, setSelectedDateKey] = useState(() => toDateKey(new Date()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusNewTask, setFocusNewTask] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const session = await getServerSession();
        if (!active) return;
        setWorkspaceId(session.workspace.id);
        setCurrentUserId(session.user.id);
        setMembers((session.members ?? []).map((member) => ({ id: member.id, name: member.name })));

        const [projectsRes, workItemsRes] = await Promise.all([
          fetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          fetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);
        if (!projectsRes.ok) throw new Error("Failed to load projects");
        if (!workItemsRes.ok) throw new Error("Failed to load calendar tasks");

        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const workItemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        if (!active) return;

        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        const mappedItems = workItemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id));
        setWorkItems(mappedItems);
        setActiveProjectId(null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load Calendar");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const scopedProjectId = routeProjectId ?? activeProjectId;
  const projectsById = useMemo(() => {
    const map: Record<string, Project> = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);

  const scopedWorkItems = useMemo(
    () =>
      scopedProjectId
        ? workItems.filter((w) => w.project === scopedProjectId)
        : workItems,
    [scopedProjectId, workItems]
  );

  const selectedItem = useMemo(
    () => (selectedId ? (workItems.find((w) => w.id === selectedId) ?? null) : null),
    [selectedId, workItems]
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const todayKey = useMemo(() => toDateKey(now), [now]);

  const itemsByKey = useMemo(() => {
    const map: Record<string, WorkItem[]> = {};
    for (const w of scopedWorkItems) {
      const d = parseDue(w.due);
      if (!d) continue;
      const key = toDateKey(d);
      (map[key] ||= []).push(w);
    }
    return map;
  }, [scopedWorkItems]);

  const datedItems = useMemo(
    () =>
      scopedWorkItems
        .filter((w) => parseDue(w.due))
        .sort((a, b) => getDatePart(a.due).localeCompare(getDatePart(b.due))),
    [scopedWorkItems]
  );

  const undatedItems = useMemo(
    () => scopedWorkItems.filter((w) => !parseDue(w.due)),
    [scopedWorkItems]
  );
  const selectedDateItems = itemsByKey[selectedDateKey] ?? [];

  const navLabel = useMemo(() => {
    if (view === "month") {
      return cursor.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    const monday = startOfWeek(cursor);
    const sunday = addDays(monday, 6);
    const sameMonth = monday.getMonth() === sunday.getMonth();
    const sameYear = monday.getFullYear() === sunday.getFullYear();
    if (sameMonth) {
      return `${monday.toLocaleDateString("en-US", { month: "long" })} ${monday.getDate()}–${sunday.getDate()}, ${sunday.getFullYear()}`;
    }
    if (sameYear) {
      return `${monday.toLocaleDateString("en-US", { month: "short" })} ${monday.getDate()} – ${sunday.toLocaleDateString("en-US", { month: "short" })} ${sunday.getDate()}, ${sunday.getFullYear()}`;
    }
    return `${monday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }, [cursor, view]);

  function prev() {
    if (view === "month") {
      const nextCursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);
      setCursor(nextCursor);
      setSelectedDateKey(toDateKey(nextCursor));
    } else {
      setCursor(addDays(cursor, -7));
    }
  }

  function next() {
    if (view === "month") {
      const nextCursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      setCursor(nextCursor);
      setSelectedDateKey(toDateKey(nextCursor));
    } else {
      setCursor(addDays(cursor, 7));
    }
  }

  function createOnDate(dateKey: string) {
    if (!workspaceId) return;
    void (async () => {
      const response = await fetch("/api/work-items", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": currentUserId ?? "",
        },
        body: JSON.stringify({
          workspaceId,
          projectId: scopedProjectId ?? projects[0]?.id ?? undefined,
          title: "Untitled task",
          status: "BACKLOG",
          priority: "MEDIUM",
          startDate: `${dateKey}T00:00:00.000Z`,
          dueDate: `${dateKey}T00:00:00.000Z`,
        }),
      });
      if (!response.ok) {
        setError("Failed to create task");
        return;
      }
      const payload = (await response.json()) as { workItem: ApiWorkItem };
      const next = toUiWorkItem(payload.workItem, currentUserId);
      setWorkItems((current) => [next, ...current]);
      setSelectedId(next.id);
      setFocusNewTask(true);
    })();
  }

  return (
    <AppShell
      title={<span className="font-medium">Calendar</span>}
      toolbar={
        <Toolbar>
          <button onClick={prev} className="lov-icon-btn">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[120px] text-center text-[12px] font-medium sm:min-w-[180px] sm:text-[13px]">
            {navLabel}
          </span>
          <button onClick={next} className="lov-icon-btn">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              const today = new Date();
              setCursor(today);
              setSelectedDateKey(toDateKey(today));
            }}
            className="lov-btn lov-btn-ghost"
          >
            Today
          </button>
          <span className="mx-1 hidden h-4 w-px bg-border sm:inline-block" />
          <div className="lov-segment-group">
            <button
              onClick={() => setView("month")}
              className={`lov-segment ${view === "month" ? "lov-segment-active" : ""}`}
            >
              Month
            </button>
            <button
              onClick={() => setView("week")}
              className={`lov-segment ${view === "week" ? "lov-segment-active" : ""}`}
            >
              Week
            </button>
          </div>
          <span className="ml-auto" />
          {undatedItems.length > 0 && (
            <span className="hidden text-[12px] text-muted-foreground lg:inline">
              {undatedItems.length} task{undatedItems.length === 1 ? "" : "s"} without a due
              date
            </span>
          )}
        </Toolbar>
      }
    >
      <div className="flex h-full min-h-0 w-full flex-col animate-fade-in lg:flex-row">
        {error && <div className="absolute left-6 right-6 top-3 z-40 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {loading && <div className="px-4 py-2 text-[12px] text-muted-foreground">Loading calendar data...</div>}
          <MobileAgenda
            selectedDateKey={selectedDateKey}
            cursor={cursor}
            itemsByKey={itemsByKey}
            datedItems={datedItems}
            undatedItems={undatedItems}
            todayKey={todayKey}
            projectsById={projectsById}
            onSelectDate={setSelectedDateKey}
            onSelect={setSelectedId}
            onCreate={createOnDate}
          />
          <div className="hidden min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-[#fafafa] md:block">
            <div className="mx-auto w-full max-w-5xl p-6 md:p-8 lg:p-12">
              <div className="mb-6">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Task timeline</p>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Calendar</h1>
                <p className="mt-0.5 text-xs font-light text-zinc-500">Dated work, without a separate events system.</p>
              </div>
              <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
                <div className="min-w-0">
                  {view === "month" ? (
                    <MonthView
                      cursor={cursor}
                      itemsByKey={itemsByKey}
                      todayKey={todayKey}
                      now={now}
                      projectsById={projectsById}
                      selectedDateKey={selectedDateKey}
                      onSelect={setSelectedId}
                      onCreate={createOnDate}
                      onSelectDate={setSelectedDateKey}
                    />
                  ) : (
                    <WeekView
                      cursor={cursor}
                      itemsByKey={itemsByKey}
                      todayKey={todayKey}
                      projectsById={projectsById}
                      onSelect={setSelectedId}
                      onCreate={createOnDate}
                    />
                  )}
                </div>
                <aside className="rounded-lg border border-zinc-200/80 bg-white p-4">
                  <div className="space-y-5">
                    <TaskSection
                      title={fullDateLabel(selectedDateKey)}
                      empty="No dated tasks for this day."
                      items={selectedDateItems}
                      todayKey={todayKey}
                      projectsById={projectsById}
                      onSelect={setSelectedId}
                    />
                    <TaskSection
                      title="No date"
                      empty="No tasks without a due date."
                      items={undatedItems}
                      todayKey={todayKey}
                      projectsById={projectsById}
                      onSelect={setSelectedId}
                    />
                  </div>
                </aside>
              </div>
            </div>
          </div>
        </div>
        <TaskDrawer
          item={selectedItem}
          focusTitle={focusNewTask}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          membersOverride={members}
          projectsOverride={projects}
          onItemPatched={(id, patch) => {
            setWorkItems((current) => current.map((workItem) => (workItem.id === id ? { ...workItem, ...patch } : workItem)));
          }}
          onItemReplaced={(next) => {
            setWorkItems((current) => current.map((workItem) => (workItem.id === next.id ? next : workItem)));
          }}
          onTitleFocused={() => setFocusNewTask(false)}
          onClose={() => {
            setSelectedId(null);
            setFocusNewTask(false);
          }}
        />
      </div>
    </AppShell>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={null}>
      <CalendarPageContent />
    </Suspense>
  );
}
