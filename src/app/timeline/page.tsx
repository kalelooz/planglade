"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  MoveHorizontal,
  RotateCcw,
  Search,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";

import { AppShell } from "@/components/lovable/shell";
import { Avatar, PriorityIcon, StatusIcon } from "@/components/lovable/icons";
import { Chip, Toolbar } from "@/components/lovable/page";
import { byInitials, type Member, type Priority, type Project, type Status, type WorkItem } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

type Scale = "Week" | "Month" | "Quarter";
type GroupBy = "Project" | "Assignee" | "Status";
type FilterKey = "All" | "Overdue" | "Active" | "Done";
type ScopeMode = "All projects" | "Current project";

type ScheduleWindow = {
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  duration: number;
};

type TimelineItem = {
  item: WorkItem;
  project: Project | undefined;
  member: Member | undefined;
  window: ScheduleWindow | null;
  isOverdue: boolean;
};

type TimelineGroup = {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  items: TimelineItem[];
};

type ScaleConfig = {
  totalDays: number;
  columns: number;
  daysPerColumn: number;
  anchorOffsetDays: number;
  columnLabel: (date: Date) => string;
};

const SCALE: Record<Scale, ScaleConfig> = {
  Week: {
    totalDays: 21,
    columns: 21,
    daysPerColumn: 1,
    anchorOffsetDays: -5,
    columnLabel: (date) => `${date.toLocaleDateString("en-US", { weekday: "short" })} ${date.getDate()}`,
  },
  Month: {
    totalDays: 84,
    columns: 12,
    daysPerColumn: 7,
    anchorOffsetDays: -14,
    columnLabel: (date) => `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`,
  },
  Quarter: {
    totalDays: 210,
    columns: 15,
    daysPerColumn: 14,
    anchorOffsetDays: -28,
    columnLabel: (date) => `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`,
  },
};

const PRIORITY_DURATION: Record<Priority, number> = {
  High: 12,
  Medium: 8,
  Low: 5,
};

const STATUS_ACCENT: Record<Status, string> = {
  Backlog: "oklch(0.55 0.02 260)",
  "To Do": "oklch(0.55 0.02 260)",
  "In Progress": "oklch(0.52 0.09 195)",
  "In Review": "oklch(0.7 0.14 75)",
  Done: "oklch(0.6 0.14 145)",
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function diffDays(start: Date, end: Date) {
  return Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / 86_400_000);
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "No date";
  const date = typeof value === "string" ? parseDateKey(value) : value;
  if (!date) return typeof value === "string" ? value : "No date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildWindow(item: WorkItem): ScheduleWindow | null {
  const end = parseDateKey(item.due);
  if (!end) return null;
  const duration = PRIORITY_DURATION[item.priority] + (item.status === "Backlog" ? 3 : 0);
  const start = addDays(end, -duration);
  return {
    start,
    end,
    startKey: dateKey(start),
    endKey: dateKey(end),
    duration,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function statusTone(status: Status) {
  if (status === "Done") return "success" as const;
  if (status === "In Review") return "warning" as const;
  if (status === "In Progress") return "accent" as const;
  return "neutral" as const;
}

function dueTone(item: WorkItem, todayKey: string) {
  if (item.status === "Done") return "success" as const;
  if (item.due && item.due < todayKey) return "danger" as const;
  if (item.due === todayKey) return "warning" as const;
  return "neutral" as const;
}

function priorityTone(priority: Priority) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function nudgeDate(value: string, amount: number) {
  const date = parseDateKey(value);
  if (!date) return value;
  return dateKey(addDays(date, amount));
}

function SegmentButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`lov-segment ${active ? "lov-segment-active" : ""}`}
    >
      {children}
    </button>
  );
}

function ControlSelect<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-8 rounded border bg-card px-2 text-[12px] text-foreground outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function Metric({ label, value, tone = "neutral" }: { label: string; value: string | number; tone?: "neutral" | "danger" | "accent" }) {
  return (
    <div className={`rounded border px-2.5 py-1.5 ${tone === "danger" ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300" : tone === "accent" ? "border-primary/20 bg-primary/10 text-primary" : "bg-card text-foreground"}`}>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[13px] font-semibold">{value}</div>
    </div>
  );
}

function TimelineBar({
  timelineItem,
  rangeStart,
  totalDays,
  selected,
  dimmed,
  onSelect,
}: {
  timelineItem: TimelineItem;
  rangeStart: Date;
  totalDays: number;
  selected: boolean;
  dimmed: boolean;
  onSelect: (item: WorkItem) => void;
}) {
  const { item, project, member, window, isOverdue } = timelineItem;
  if (!window) {
    return (
      <button
        type="button"
        data-timeline-bar={item.id}
        onClick={() => onSelect(item)}
        className={`ml-2 inline-flex h-7 items-center gap-1.5 rounded border border-dashed bg-card px-2 text-[11px] text-muted-foreground transition-opacity ${dimmed ? "opacity-25" : ""}`}
      >
        <StatusIcon s={item.status} />
        No due date
      </button>
    );
  }

  const rawStart = diffDays(rangeStart, window.start);
  const rawEnd = diffDays(rangeStart, window.end);
  const clippedLeft = rawStart < 0;
  const clippedRight = rawEnd > totalDays;
  const leftPct = clamp((rawStart / totalDays) * 100, 0, 100);
  const rightPct = clamp((rawEnd / totalDays) * 100, 0, 100);
  const widthPct = Math.max(1.8, rightPct - leftPct);
  const accent = project?.accent ?? STATUS_ACCENT[item.status];

  const style: CSSProperties = {
    left: `${leftPct}%`,
    width: `${widthPct}%`,
    background: item.status === "Done"
      ? "color-mix(in oklch, var(--color-muted) 74%, transparent)"
      : `color-mix(in oklch, ${accent} 18%, var(--color-card))`,
    borderColor: selected ? "var(--color-primary)" : `color-mix(in oklch, ${accent} 45%, var(--color-border))`,
    boxShadow: selected ? "0 0 0 3px color-mix(in oklch, var(--color-primary) 18%, transparent)" : undefined,
  };

  return (
    <button
      type="button"
      data-timeline-bar={item.id}
      onClick={() => onSelect(item)}
      title={`${item.title} / ${formatDate(window.start)} to ${formatDate(window.end)}`}
      style={style}
      className={`group absolute top-1/2 flex h-8 min-w-[5.75rem] -translate-y-1/2 items-center gap-1.5 overflow-hidden rounded-md border px-2 text-[11px] transition-[opacity,box-shadow,transform] hover:-translate-y-[54%] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        dimmed ? "opacity-20" : "opacity-100"
      } ${isOverdue ? "ring-1 ring-red-500/35" : ""}`}
    >
      {clippedLeft && <ChevronLeft className="h-3 w-3 shrink-0 text-muted-foreground" />}
      <span className="h-full w-1 shrink-0 rounded-full" style={{ background: accent }} />
      <span className={`min-w-0 flex-1 truncate text-left font-medium ${item.status === "Done" ? "text-muted-foreground line-through" : ""}`}>
        {item.title}
      </span>
      {clippedRight && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
    </button>
  );
}

function InspectorRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 py-1.5 text-[12px]">
      <div className="text-muted-foreground">{label}</div>
      <div className="min-w-0">{value}</div>
    </div>
  );
}

export default function TimelinePage() {
  const projects = useStore((state) => state.projects);
  const workItems = useStore((state) => state.workItems);
  const members = useStore((state) => state.members);
  const activeProjectId = useStore((state) => state.settings.activeProjectId);
  const updateWorkItem = useStore((state) => state.updateWorkItem);

  const [scale, setScale] = useState<Scale>("Month");
  const [groupBy, setGroupBy] = useState<GroupBy>("Project");
  const [filter, setFilter] = useState<FilterKey>("Active");
  const [query, setQuery] = useState("");
  const [anchorShift, setAnchorShift] = useState(0);
  const [scopeMode, setScopeMode] = useState<ScopeMode>("All projects");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const focusMode = true;

  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = useMemo(() => dateKey(today), [today]);
  const cfg = SCALE[scale];
  const activeProject = activeProjectId ? projects.find((project) => project.id === activeProjectId) ?? null : null;
  const useProjectScope = scopeMode === "Current project" && activeProjectId != null;

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const rangeStart = useMemo(
    () => addDays(today, cfg.anchorOffsetDays + anchorShift * cfg.daysPerColumn),
    [anchorShift, cfg.anchorOffsetDays, cfg.daysPerColumn, today]
  );

  const columnDates = useMemo(
    () => Array.from({ length: cfg.columns }, (_, index) => addDays(rangeStart, index * cfg.daysPerColumn)),
    [cfg.columns, cfg.daysPerColumn, rangeStart]
  );

  const rangeEnd = useMemo(() => addDays(rangeStart, cfg.totalDays), [cfg.totalDays, rangeStart]);
  const todayPct = (diffDays(rangeStart, today) / cfg.totalDays) * 100;
  const todayVisible = todayPct >= 0 && todayPct <= 100;

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const queryText = query.trim().toLowerCase();
    return workItems
      .filter((item) => !useProjectScope || item.project === activeProjectId)
      .filter((item) => {
        if (!queryText) return true;
        const project = projectById.get(item.project);
        const member = memberById.get(item.assignee);
        return [item.title, item.id, item.label, item.status, item.priority, project?.name, member?.name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(queryText));
      })
      .filter((item) => {
        if (filter === "All") return true;
        if (filter === "Done") return item.status === "Done";
        if (filter === "Overdue") return item.status !== "Done" && !!item.due && item.due < todayKey;
        return item.status !== "Done";
      })
      .map((item) => {
        const project = projectById.get(item.project);
        const member = memberById.get(item.assignee);
        return {
          item,
          project,
          member,
          window: buildWindow(item),
          isOverdue: item.status !== "Done" && !!item.due && item.due < todayKey,
        };
      })
      .sort((a, b) => {
        const aDate = a.window?.endKey ?? "9999-12-31";
        const bDate = b.window?.endKey ?? "9999-12-31";
        return aDate.localeCompare(bDate) || a.item.priority.localeCompare(b.item.priority);
      });
  }, [activeProjectId, filter, memberById, projectById, query, todayKey, useProjectScope, workItems]);

  const groups = useMemo<TimelineGroup[]>(() => {
    const map = new Map<string, TimelineGroup>();

    const ensure = (item: TimelineItem) => {
      if (groupBy === "Project") {
        const project = item.project;
        const id = project?.id ?? "unknown";
        if (!map.has(id)) {
          map.set(id, {
            id,
            title: project?.name ?? "Unknown project",
            subtitle: `${project?.status ?? "No status"} / due ${formatDate(project?.due)}`,
            accent: project?.accent ?? "var(--color-muted-foreground)",
            items: [],
          });
        }
        return map.get(id)!;
      }

      if (groupBy === "Assignee") {
        const member = item.member ?? byInitials(item.item.assignee);
        if (!map.has(member.id)) {
          map.set(member.id, {
            id: member.id,
            title: member.name,
            subtitle: member.role,
            accent: member.color,
            items: [],
          });
        }
        return map.get(member.id)!;
      }

      const id = item.item.status;
      if (!map.has(id)) {
        map.set(id, {
          id,
          title: id,
          subtitle: "Status lane",
          accent: STATUS_ACCENT[item.item.status],
          items: [],
        });
      }
      return map.get(id)!;
    };

    timelineItems.forEach((item) => ensure(item).items.push(item));
    return Array.from(map.values()).filter((group) => group.items.length > 0);
  }, [groupBy, timelineItems]);

  const selected = selectedId ? timelineItems.find((entry) => entry.item.id === selectedId) ?? null : null;
  const selectedGroupId = selected
    ? groupBy === "Project"
      ? selected.item.project
      : groupBy === "Assignee"
        ? selected.item.assignee
        : selected.item.status
    : null;

  const rangeLabel = `${formatDate(rangeStart)} - ${rangeEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const overdueCount = timelineItems.filter((entry) => entry.isOverdue).length;
  const visibleCount = timelineItems.length;
  const doneCount = timelineItems.filter((entry) => entry.item.status === "Done").length;

  const selectItem = (item: WorkItem) => {
    setSelectedId(item.id);
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      const row = document.querySelector<HTMLElement>(`[data-timeline-row="${item.id}"]`);
      const bar = document.querySelector<HTMLElement>(`[data-timeline-bar="${item.id}"]`);
      if (!scroller || !row) return;
      row.scrollIntoView({ block: "center", behavior: "smooth" });
      if (bar) {
        const barRect = bar.getBoundingClientRect();
        const scrollerRect = scroller.getBoundingClientRect();
        const delta = barRect.left + barRect.width / 2 - (scrollerRect.left + scrollerRect.width / 2);
        scroller.scrollTo({ left: scroller.scrollLeft + delta, behavior: "smooth" });
      }
    });
  };

  const nudgeSelectedDue = (days: number) => {
    if (!selected) return;
    updateWorkItem(selected.item.id, { due: nudgeDate(selected.item.due, days) });
  };

  return (
    <AppShell
      title={<span className="font-medium">{useProjectScope && activeProject ? `${activeProject.name} / Timeline` : "Workspace Timeline"}</span>}
      toolbar={
        <Toolbar>
          <button type="button" onClick={() => setAnchorShift((value) => value - 1)} className="lov-icon-btn" aria-label="Shift earlier">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-44 text-center text-[12px] font-medium">{rangeLabel}</span>
          <button type="button" onClick={() => setAnchorShift((value) => value + 1)} className="lov-icon-btn" aria-label="Shift later">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setAnchorShift(0)} className="lov-btn lov-btn-ghost h-7">
            <RotateCcw className="h-3.5 w-3.5" />
            Today
          </button>
          <span className="h-4 w-px bg-border" />
          <div className="lov-segment-group">
            {(["Week", "Month", "Quarter"] as const).map((option) => (
              <SegmentButton
                key={option}
                active={scale === option}
                onClick={() => {
                  setScale(option);
                  setAnchorShift(0);
                }}
              >
                {option}
              </SegmentButton>
            ))}
          </div>
          <span className="ml-auto" />
        </Toolbar>
      }
    >
      <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_22rem] overflow-hidden lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-[auto_minmax(0,1fr)]">
        <div className="border-b bg-background px-3 py-2 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search timeline"
                className="h-8 w-full rounded border bg-card pl-8 pr-2 text-[12px] outline-none focus:border-primary"
              />
            </div>
            <ControlSelect
              label="Scope"
              value={scopeMode}
              options={["All projects", "Current project"] as const}
              onChange={setScopeMode}
            />
            <ControlSelect
              label="Group"
              value={groupBy}
              options={["Project", "Assignee", "Status"] as const}
              onChange={setGroupBy}
            />
            <ControlSelect
              label="Show"
              value={filter}
              options={["Active", "Overdue", "Done", "All"] as const}
              onChange={setFilter}
            />
            <div className="ml-auto text-[12px] text-muted-foreground">
              <span className="font-medium text-foreground">{visibleCount}</span> visible
              <span className="mx-1.5">/</span>
              <span className={overdueCount ? "font-medium text-red-600" : "font-medium text-foreground"}>{overdueCount}</span> overdue
              <span className="mx-1.5">/</span>
              <span className="font-medium text-foreground">{doneCount}</span> done
            </div>
          </div>
        </div>

        <div ref={scrollRef} className="min-h-0 overflow-auto">
          <div className="min-w-[1040px]">
            <div className="sticky top-0 z-30 grid grid-cols-[17rem_1fr] border-b bg-background">
              <div className="flex items-center gap-2 border-r px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {groupBy} / Work item
              </div>
              <div className="relative">
                <div className="flex h-full">
                  {columnDates.map((date, index) => {
                    const columnStart = index * cfg.daysPerColumn;
                    const isToday = todayVisible && diffDays(rangeStart, today) >= columnStart && diffDays(rangeStart, today) < columnStart + cfg.daysPerColumn;
                    return (
                      <div
                        key={dateKey(date)}
                        className={`flex-1 border-r px-1 py-2 text-center text-[11px] ${isToday ? "bg-primary/8 font-semibold text-primary" : "text-muted-foreground"}`}
                      >
                        {cfg.columnLabel(date)}
                      </div>
                    );
                  })}
                </div>
                {todayVisible && (
                  <div
                    className="pointer-events-none absolute bottom-0 z-40 -translate-x-1/2 translate-y-1/2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm"
                    style={{ left: `${todayPct}%` }}
                  >
                    Today
                  </div>
                )}
              </div>
            </div>

            <div ref={timelineRef}>
              {groups.length === 0 ? (
                <div className="px-6 py-14 text-center text-[13px] text-muted-foreground">No scheduled work matches this view.</div>
              ) : (
                groups.map((group) => {
                  const groupDimmed = focusMode && selectedGroupId != null && selectedGroupId !== group.id;
                  return (
                    <section key={group.id} className={`border-b ${groupDimmed ? "opacity-35" : ""}`}>
                      <div className="grid grid-cols-[17rem_1fr] bg-sidebar/60">
                        <button
                          type="button"
                          onClick={() => {
                            const first = group.items[0]?.item;
                            if (first) selectItem(first);
                          }}
                          className="flex min-w-0 items-center gap-2 border-r px-3 py-2 text-left hover:bg-[var(--color-hover)]"
                        >
                          <span className="h-7 w-1.5 shrink-0 rounded-full" style={{ background: group.accent }} />
                          {groupBy === "Assignee" ? <Avatar id={group.id} name={group.title} size={20} /> : groupBy === "Project" ? <FolderKanban className="h-4 w-4 text-muted-foreground" /> : <StatusIcon s={group.id as Status} />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold">{group.title}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{group.subtitle}</span>
                          </span>
                          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{group.items.length}</span>
                        </button>
                        <div className="relative h-11">
                          {todayVisible && <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-600" style={{ left: `${todayPct}%` }} />}
                        </div>
                      </div>

                      {group.items.map((entry) => {
                        const dimmed = focusMode && selectedId != null && selectedGroupId != null && selectedGroupId !== group.id;
                        return (
                          <div
                            key={entry.item.id}
                            data-timeline-row={entry.item.id}
                            className={`grid grid-cols-[17rem_1fr] border-t hover:bg-[var(--color-hover)]/45 ${selectedId === entry.item.id ? "bg-primary/5" : ""}`}
                          >
                            <button
                              type="button"
                              onClick={() => selectItem(entry.item)}
                              className="flex min-w-0 items-center gap-2 border-r px-3 py-2 text-left text-[12px]"
                            >
                              <StatusIcon s={entry.item.status} />
                              <PriorityIcon p={entry.item.priority} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{entry.item.title}</span>
                                <span className="block truncate text-[10.5px] text-muted-foreground">{entry.item.id} / {entry.project?.name ?? entry.item.project}</span>
                              </span>
                            </button>
                            <div className="relative h-11">
                              <div className="absolute inset-0 flex">
                                {columnDates.map((date, index) => (
                                  <div
                                    key={`${entry.item.id}-${dateKey(date)}`}
                                    className={`flex-1 border-r ${index % 2 === 0 ? "bg-muted/10" : ""}`}
                                  />
                                ))}
                              </div>
                              <TimelineBar
                                timelineItem={entry}
                                rangeStart={rangeStart}
                                totalDays={cfg.totalDays}
                                selected={selectedId === entry.item.id}
                                dimmed={dimmed}
                                onSelect={selectItem}
                              />
                              {todayVisible && <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-600" style={{ left: `${todayPct}%` }} />}
                            </div>
                          </div>
                        );
                      })}
                    </section>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <aside className="min-h-0 overflow-y-auto border-t bg-background lg:border-l lg:border-t-0">
          <div className="border-b px-4 py-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarClock className="h-3.5 w-3.5" />
                {selected ? "Schedule detail" : "Timeline map"}
              </div>
              {selected && (
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="lov-icon-btn h-7 w-7"
                  aria-label="Close timeline detail"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <h2 className="truncate text-[16px] font-semibold tracking-tight">
              {selected?.item.title ?? "Planning overview"}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {selected ? `${selected.item.id} / ${selected.project?.name ?? selected.item.project}` : "Click a bar or lane to focus related work in the timeline."}
            </p>
          </div>

          <div className="space-y-5 px-4 py-4">
            {!selected ? (
              <>
                <section className="grid grid-cols-3 gap-2">
                  <Metric label="Groups" value={groups.length} />
                  <Metric label="Visible" value={visibleCount} />
                  <Metric label="Overdue" value={overdueCount} tone={overdueCount ? "danger" : "neutral"} />
                </section>
                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Interaction</div>
                  <div className="space-y-2 text-[12px] text-muted-foreground">
                    <p>Click a lane to jump to its first item. Click a bar to center that schedule window and show the item inspector.</p>
                    <p>Use grouping to change the timeline story: project planning, owner workload, or status flow.</p>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip tone={statusTone(selected.item.status)}>{selected.item.status}</Chip>
                    <Chip tone={priorityTone(selected.item.priority)}>{selected.item.priority}</Chip>
                    <Chip tone={dueTone(selected.item, todayKey)}>{formatDate(selected.item.due)}</Chip>
                  </div>
                </section>

                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Schedule</div>
                  <div className="space-y-1">
                    <InspectorRow label="Window" value={`${formatDate(selected.window?.start)} - ${formatDate(selected.window?.end)}`} />
                    <InspectorRow label="Duration" value={selected.window ? `${selected.window.duration} days` : "No due date"} />
                    <InspectorRow label="Assignee" value={<span className="inline-flex items-center gap-2"><Avatar id={selected.item.assignee} name={selected.member?.name} size={18} />{selected.member?.name ?? selected.item.assignee}</span>} />
                    <InspectorRow label="Project" value={selected.project?.name ?? selected.item.project} />
                    <InspectorRow label="Label" value={selected.item.label} />
                  </div>
                </section>

                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Adjust Due Date</div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      ["-7d", -7],
                      ["-1d", -1],
                      ["+1d", 1],
                      ["+7d", 7],
                    ].map(([label, days]) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => nudgeSelectedDue(days as number)}
                        className="lov-btn lov-btn-ghost justify-center"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded border bg-card px-2 py-1.5 text-[12px]">
                    <MoveHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="date"
                      value={selected.item.due}
                      onChange={(event) => updateWorkItem(selected.item.id, { due: event.target.value })}
                      className="min-w-0 flex-1 bg-transparent outline-none"
                    />
                  </div>
                </section>

                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</div>
                  <textarea
                    value={selected.item.description ?? ""}
                    onChange={(event) => updateWorkItem(selected.item.id, { description: event.target.value })}
                    placeholder="Add planning context."
                    rows={4}
                    className="w-full resize-y rounded border bg-card px-3 py-2 text-[12px] outline-none placeholder:text-muted-foreground/60 focus:border-primary"
                  />
                </section>
              </>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
