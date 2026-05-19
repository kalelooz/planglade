"use client";
import { useEffect, useState, useMemo, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar } from "@/components/lovable/page";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useStore } from "@/lib/store";
import type { WorkItem, Project } from "@/lib/mock-data";
import { localDateKey, parseLocalDate } from "@/lib/dates";

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
    background: `color-mix(in oklch, ${accent} 10%, transparent)`,
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
  const isOverdue = !!item.due && item.due < todayKey && !isDone;
  const sizing =
    size === "sm" ? "px-1.5 py-0.5 text-[11px]" : "px-2 py-1 text-[12px]";
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
      className={`flex w-full items-center gap-1 truncate rounded border-l-2 text-left transition-opacity hover:opacity-80 ${sizing} ${textTone}`}
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

function MonthView({
  cursor,
  itemsByKey,
  todayKey,
  projectsById,
  onSelect,
}: {
  cursor: Date;
  itemsByKey: Record<string, WorkItem[]>;
  todayKey: string;
  projectsById: Record<string, Project>;
  onSelect: (id: string) => void;
}) {
  const today = new Date();
  const isThisMonth =
    cursor.getFullYear() === today.getFullYear() &&
    cursor.getMonth() === today.getMonth();

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
    <div className="grid h-full grid-cols-7 border-b border-l text-[12px]">
      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
        <div
          key={d}
          className="border-r border-t bg-sidebar/50 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          {d}
        </div>
      ))}
      {cells.map((c, idx) => {
        const day = c.day;
        const isToday = !!day && isThisMonth && day === today.getDate();
        const key = day
          ? `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
          : "";
        const dayItems = day ? (itemsByKey[key] ?? []) : [];
        const visible = dayItems.slice(0, MONTH_VISIBLE);
        const hasOverflow = dayItems.length > MONTH_VISIBLE;
        return (
          <div
            key={idx}
            className={`min-h-28 border-r border-t p-1.5 ${day ? "" : "bg-sidebar/30"}`}
          >
            {day && (
              <>
                <div
                  className={`mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
                    isToday
                      ? "bg-primary font-semibold text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {day}
                </div>
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
}: {
  cursor: Date;
  itemsByKey: Record<string, WorkItem[]>;
  todayKey: string;
  projectsById: Record<string, Project>;
  onSelect: (id: string) => void;
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
                <div className="pt-3 text-center text-[11px] text-muted-foreground/30">
                  —
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type CalView = "month" | "week";

export default function CalendarPage() {
  const params = useSearchParams();
  const routeProjectId = params.get("project");
  const workItems = useStore((s) => s.workItems);
  const activeProjectId = useStore((s) => s.settings.activeProjectId);
  const projects = useStore((s) => s.projects);

  const [cursor, setCursor] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<CalView>("month");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const scopedProjectId = routeProjectId ?? activeProjectId;
  const activeProject = scopedProjectId
    ? (projects.find((p) => p.id === scopedProjectId) ?? null)
    : null;

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

  const undatedCount = useMemo(
    () => scopedWorkItems.filter((w) => !parseDue(w.due)).length,
    [scopedWorkItems]
  );

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
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1));
    } else {
      setCursor(addDays(cursor, -7));
    }
  }

  function next() {
    if (view === "month") {
      setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1));
    } else {
      setCursor(addDays(cursor, 7));
    }
  }

  return (
    <AppShell
      title={
        <span className="font-medium">
          {activeProject
            ? `${activeProject.name} / Calendar`
            : "All projects / Calendar"}
        </span>
      }
      toolbar={
        <Toolbar>
          <button onClick={prev} className="lov-icon-btn">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[180px] text-center text-[13px] font-medium">
            {navLabel}
          </span>
          <button onClick={next} className="lov-icon-btn">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="lov-btn lov-btn-ghost"
          >
            Today
          </button>
          <span className="mx-1 h-4 w-px bg-border" />
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
          {undatedCount > 0 && (
            <span className="text-[12px] text-muted-foreground">
              {undatedCount} task{undatedCount === 1 ? "" : "s"} without a due
              date
            </span>
          )}
        </Toolbar>
      }
    >
      <div className="flex h-full min-h-0 w-full">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {view === "month" ? (
            <MonthView
              cursor={cursor}
              itemsByKey={itemsByKey}
              todayKey={todayKey}
              projectsById={projectsById}
              onSelect={setSelectedId}
            />
          ) : (
            <WeekView
              cursor={cursor}
              itemsByKey={itemsByKey}
              todayKey={todayKey}
              projectsById={projectsById}
              onSelect={setSelectedId}
            />
          )}
        </div>
        <TaskDrawer item={selectedItem} onClose={() => setSelectedId(null)} />
      </div>
    </AppShell>
  );
}
