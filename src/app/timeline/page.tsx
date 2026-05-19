"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "next/navigation";
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

type Scale = "Day" | "Week" | "Month" | "Quarter";
type GroupBy = "Project" | "Assignee" | "Status";
type FilterKey = "All" | "Overdue" | "Active" | "Done";
type ScopeMode = "All projects" | "Current project";

type ScheduleWindow = {
  start: Date;
  end: Date;
  startKey: string;
  endKey: string;
  durationHours: number;
  dueTimeLabel: string;
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
  totalHours: number;
  columns: number;
  hoursPerColumn: number;
  columnLabel: (date: Date) => string;
};

const SCALE: Record<Scale, ScaleConfig> = {
  Day: {
    totalHours: 24,
    columns: 24,
    hoursPerColumn: 1,
    columnLabel: (date) => date.toLocaleTimeString("en-US", { hour: "numeric", hour12: true }).replace(" ", ""),
  },
  Week: {
    totalHours: 24 * 7,
    columns: 7,
    hoursPerColumn: 24,
    columnLabel: (date) => `${date.toLocaleDateString("en-US", { weekday: "short" })} ${date.getDate()}`,
  },
  Month: {
    totalHours: 24 * 30,
    columns: 10,
    hoursPerColumn: 24 * 3,
    columnLabel: (date) => `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`,
  },
  Quarter: {
    totalHours: 24 * 90,
    columns: 9,
    hoursPerColumn: 24 * 10,
    columnLabel: (date) => `${date.toLocaleDateString("en-US", { month: "short" })} ${date.getDate()}`,
  },
};

const PRIORITY_DURATION_HOURS: Record<Priority, number> = {
  High: 36,
  Medium: 24,
  Low: 12,
};

const STATUS_ACCENT: Record<Status, string> = {
  Backlog: "oklch(0.55 0.02 260)",
  "To Do": "oklch(0.55 0.02 260)",
  "In Progress": "oklch(0.52 0.09 195)",
  "In Review": "oklch(0.7 0.14 75)",
  Done: "oklch(0.6 0.14 145)",
};

const LEFT_COLUMN_WIDTH = 272;

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

function addHours(date: Date, amount: number) {
  return new Date(date.getTime() + amount * 3_600_000);
}

function diffHours(start: Date, end: Date) {
  return (end.getTime() - start.getTime()) / 3_600_000;
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function stableWorkHour(item: WorkItem) {
  const seed = Array.from(item.id).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const priorityOffset = item.priority === "High" ? 0 : item.priority === "Medium" ? 2 : 4;
  return 9 + ((seed + priorityOffset) % 9);
}

function parseDueDateTime(item: WorkItem) {
  if (!item.due) return null;
  if (item.due.includes("T")) {
    const date = new Date(item.due);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = parseDateKey(item.due);
  if (!date) return null;
  date.setHours(stableWorkHour(item), 0, 0, 0);
  return date;
}

function formatDate(value: string | Date | null | undefined) {
  if (!value) return "No date";
  const date = typeof value === "string" ? parseDateKey(value) : value;
  if (!date) return typeof value === "string" ? value : "No date";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "No date";
  return `${formatDate(value)} ${value.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

function formatDuration(hours: number) {
  if (hours < 24) return `${hours} hours`;
  const days = hours / 24;
  return Number.isInteger(days) ? `${days} days` : `${days.toFixed(1)} days`;
}

function toDateInputValue(date: Date | null | undefined) {
  return date ? dateKey(date) : "";
}

function toTimeInputValue(date: Date | null | undefined) {
  if (!date) return "17:00";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function toStoredDue(dateValue: string, timeValue: string) {
  if (!dateValue) return "";
  if (!timeValue) return dateValue;
  return `${dateValue}T${timeValue}`;
}

function buildWindow(item: WorkItem): ScheduleWindow | null {
  const end = parseDueDateTime(item);
  if (!end) return null;
  const durationHours = PRIORITY_DURATION_HOURS[item.priority] + (item.status === "Backlog" ? 12 : 0);
  const start = addHours(end, -durationHours);
  return {
    start,
    end,
    startKey: dateKey(start),
    endKey: dateKey(end),
    durationHours,
    dueTimeLabel: end.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
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
  const due = parseDueDateTime(item);
  const dueKey = due ? dateKey(due) : item.due;
  if (item.status === "Done") return "success" as const;
  if (dueKey && dueKey < todayKey) return "danger" as const;
  if (dueKey === todayKey) return "warning" as const;
  return "neutral" as const;
}

function priorityTone(priority: Priority) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function nudgeDate(value: string, amount: number, item?: WorkItem) {
  const date = item ? parseDueDateTime(item) : parseDateKey(value);
  if (!date) return value;
  const next = addDays(date, amount);
  return value.includes("T") ? toStoredDue(dateKey(next), toTimeInputValue(next)) : dateKey(next);
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
  totalHours,
  selected,
  onSelect,
}: {
  timelineItem: TimelineItem;
  rangeStart: Date;
  totalHours: number;
  selected: boolean;
  onSelect: (item: WorkItem) => void;
}) {
  const { item, project, window, isOverdue } = timelineItem;
  if (!window) {
    return (
      <button
        type="button"
        data-timeline-bar={item.id}
        onClick={() => onSelect(item)}
        className="absolute left-3 top-1/2 h-2.5 w-12 -translate-y-1/2 rounded-full border border-dashed border-muted-foreground/45 bg-card"
      title={`${item.title} / no due date`}
      >
        <span className="sr-only">{item.title} has no due date</span>
      </button>
    );
  }

  const rawStart = diffHours(rangeStart, window.start);
  const rawEnd = diffHours(rangeStart, window.end);
  if (rawStart >= totalHours || rawEnd <= 0) return null;
  const leftPct = clamp((rawStart / totalHours) * 100, 0, 100);
  const rightPct = clamp((rawEnd / totalHours) * 100, 0, 100);
  const naturalWidthPct = Math.max(2.75, rightPct - leftPct);
  const visibleWidthPct = 100 - leftPct;
  const isEdgeMarker = visibleWidthPct < 1.2;
  const widthPct = Math.min(naturalWidthPct, Math.max(0.4, visibleWidthPct));
  const accent = project?.accent ?? STATUS_ACCENT[item.status];

  const style: CSSProperties = {
    left: isEdgeMarker ? "calc(100% - 0.5rem)" : `${leftPct}%`,
    width: isEdgeMarker ? "0.5rem" : `${widthPct}%`,
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
      title={`${item.title} / ${formatDateTime(window.start)} to ${formatDateTime(window.end)}`}
      style={style}
      className={`group absolute top-1/2 box-border flex h-7 min-w-0 -translate-y-1/2 items-center overflow-hidden rounded-md border text-[11px] transition-[box-shadow,transform] hover:-translate-y-[54%] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        isEdgeMarker ? "justify-center px-0" : "gap-1.5 px-2"
      } ${
        isOverdue ? "ring-1 ring-red-500/35" : ""
      }`}
    >
      <span className={isEdgeMarker ? "h-full w-full" : "h-full w-1.5 shrink-0"} style={{ background: accent }} />
      {!isEdgeMarker && (
        <>
          <span className={`min-w-0 flex-1 truncate text-left font-medium ${item.status === "Done" ? "text-muted-foreground line-through" : ""}`}>
            {item.title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {window.dueTimeLabel}
          </span>
        </>
      )}
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
  const params = useSearchParams();
  const routeProjectId = params.get("project");
  const projects = useStore((state) => state.projects);
  const workItems = useStore((state) => state.workItems);
  const members = useStore((state) => state.members);
  const activeProjectId = useStore((state) => state.settings.activeProjectId);
  const updateWorkItem = useStore((state) => state.updateWorkItem);

  const [scale, setScale] = useState<Scale>("Month");
  const [groupBy, setGroupBy] = useState<GroupBy>("Project");
  const [filter, setFilter] = useState<FilterKey>("Active");
  const [query, setQuery] = useState("");
  const [scopeMode, setScopeMode] = useState<ScopeMode>("All projects");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const timelineRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerTimelineRef = useRef<HTMLDivElement>(null);
  const [timelineMetrics, setTimelineMetrics] = useState({ left: LEFT_COLUMN_WIDTH, width: 768 });

  const [now, setNow] = useState(() => new Date());
  const today = useMemo(() => startOfDay(now), [now]);
  const todayKey = useMemo(() => dateKey(today), [today]);
  const cfg = SCALE[scale];
  const scopedProjectId = routeProjectId ?? activeProjectId;
  const activeProject = scopedProjectId ? projects.find((project) => project.id === scopedProjectId) ?? null : null;
  const useProjectScope = scopeMode === "Current project" && scopedProjectId != null;

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  const rangeStart = useMemo(
    () => startOfDay(anchorDate),
    [anchorDate]
  );

  const columnDates = useMemo(
    () => Array.from({ length: cfg.columns }, (_, index) => addHours(rangeStart, index * cfg.hoursPerColumn)),
    [cfg.columns, cfg.hoursPerColumn, rangeStart]
  );

  const rangeEnd = useMemo(() => addHours(rangeStart, cfg.totalHours), [cfg.totalHours, rangeStart]);
  const todayPct = (diffHours(rangeStart, now) / cfg.totalHours) * 100;
  const todayVisible = todayPct >= 0 && todayPct <= 100;
  const todayLineLeft = timelineMetrics.left + timelineMetrics.width * (todayPct / 100);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const content = contentRef.current;
    const headerTimeline = headerTimelineRef.current;
    if (!content || !headerTimeline) return;
    const update = () => {
      const contentRect = content.getBoundingClientRect();
      const headerRect = headerTimeline.getBoundingClientRect();
      setTimelineMetrics({
        left: headerRect.left - contentRect.left,
        width: headerRect.width,
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    observer.observe(headerTimeline);
    return () => observer.disconnect();
  }, []);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const queryText = query.trim().toLowerCase();
    return workItems
      .filter((item) => !useProjectScope || item.project === scopedProjectId)
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
          isOverdue: item.status !== "Done" && !!parseDueDateTime(item) && dateKey(parseDueDateTime(item)!) < todayKey,
        };
      })
      .filter((entry) => !entry.window || (entry.window.start < rangeEnd && entry.window.end > rangeStart))
      .sort((a, b) => {
        const aDate = a.window?.endKey ?? "9999-12-31";
        const bDate = b.window?.endKey ?? "9999-12-31";
        return aDate.localeCompare(bDate) || a.item.priority.localeCompare(b.item.priority);
      });
  }, [filter, memberById, projectById, query, rangeEnd, rangeStart, scopedProjectId, todayKey, useProjectScope, workItems]);

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

  const rangeLabel = scale === "Day"
    ? `${rangeStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} / 24 hours`
    : `${formatDate(rangeStart)} - ${rangeEnd.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  const overdueCount = timelineItems.filter((entry) => entry.isOverdue).length;
  const visibleCount = timelineItems.length;
  const doneCount = timelineItems.filter((entry) => entry.item.status === "Done").length;

  const jumpToToday = useCallback(() => {
    setAnchorDate(now);
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      const content = contentRef.current;
      if (!scroller || !content) return;
      const resetTodayPct = (diffHours(today, now) / cfg.totalHours) * 100;
      const resetTodayLeft = timelineMetrics.left + timelineMetrics.width * (resetTodayPct / 100);
      const nextLeft = clamp(resetTodayLeft - scroller.clientWidth / 2, 0, content.scrollWidth - scroller.clientWidth);
      scroller.scrollTo({ left: nextLeft, behavior: "smooth" });
    });
  }, [cfg.totalHours, now, timelineMetrics.left, timelineMetrics.width, today]);

  const selectItem = (item: WorkItem) => {
    setSelectedId(item.id);
    const dueDate = parseDueDateTime(item);
    if (dueDate) setAnchorDate(dueDate);
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
    updateWorkItem(selected.item.id, { due: nudgeDate(selected.item.due, days, selected.item) });
  };

  return (
    <AppShell
      title={<span className="font-medium">{useProjectScope && activeProject ? `${activeProject.name} / Timeline` : "Workspace Timeline"}</span>}
      toolbar={
        <Toolbar>
          <button type="button" onClick={() => setAnchorDate((value) => addHours(value, -cfg.totalHours))} className="lov-icon-btn" aria-label="Shift earlier">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span suppressHydrationWarning className="min-w-44 text-center text-[12px] font-medium">{rangeLabel}</span>
          <button type="button" onClick={() => setAnchorDate((value) => addHours(value, cfg.totalHours))} className="lov-icon-btn" aria-label="Shift later">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={jumpToToday} className="lov-btn lov-btn-ghost h-7" title="Jump to today and center the current date">
            <RotateCcw className="h-3.5 w-3.5" />
            Today
          </button>
          <span className="h-4 w-px bg-border" />
          <div className="lov-segment-group">
            {(["Day", "Week", "Month", "Quarter"] as const).map((option) => (
              <SegmentButton
                key={option}
                active={scale === option}
                onClick={() => {
                  setScale(option);
                  if (selected?.window?.end) setAnchorDate(selected.window.end);
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

        <div ref={scrollRef} data-timeline-scroll className="min-h-0 overflow-auto">
          <div ref={contentRef} data-timeline-content className="min-w-[1040px]">
            <div className="sticky top-0 z-30 grid grid-cols-[17rem_1fr] border-b bg-background">
              <div className="flex items-center gap-2 border-r px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {groupBy} / Work item
              </div>
              <div ref={headerTimelineRef} data-timeline-pane className="relative">
                <div className="flex h-full">
                  {columnDates.map((date, index) => {
                    const columnStart = index * cfg.hoursPerColumn;
                    const currentHour = diffHours(rangeStart, now);
                    const isToday = todayVisible && currentHour >= columnStart && currentHour < columnStart + cfg.hoursPerColumn;
                    return (
                      <div
                        key={`${dateKey(date)}-${index}`}
                        className={`flex h-9 flex-1 items-center justify-center whitespace-nowrap border-r px-1 text-center text-[11px] leading-none tabular-nums ${isToday ? "bg-primary/8 font-semibold text-primary" : "text-muted-foreground"}`}
                      >
                        {cfg.columnLabel(date)}
                      </div>
                    );
                  })}
                </div>
                {todayVisible && (
                  <div
                    suppressHydrationWarning
                    className="pointer-events-none absolute bottom-0 z-40 -translate-x-1/2 translate-y-1/2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm"
                    style={{ left: `${todayPct}%` }}
                  >
                    Today
                  </div>
                )}
              </div>
            </div>

            <div ref={timelineRef} className="relative">
              {todayVisible && (
                <div
                  suppressHydrationWarning
                  aria-hidden
                  className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-primary"
                  style={{ left: todayLineLeft }}
                />
              )}
              {groups.length === 0 ? (
                <div className="px-6 py-14 text-center text-[13px] text-muted-foreground">No scheduled work matches this view.</div>
              ) : (
                groups.map((group) => {
                  return (
                    <section key={group.id} className="border-b">
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
                        <div className="relative h-11" />
                      </div>

                      {group.items.map((entry) => {
                        return (
                          <div
                            key={entry.item.id}
                            data-timeline-row={entry.item.id}
                            className={`grid grid-cols-[17rem_1fr] border-t hover:bg-[var(--color-hover)]/45 ${selectedId === entry.item.id ? "bg-primary/8 shadow-[inset_2px_0_0_var(--color-primary)]" : ""}`}
                          >
                            <button
                              type="button"
                              onClick={() => selectItem(entry.item)}
                              className="flex h-12 min-w-0 items-center gap-2 border-r px-3 text-left text-[12px]"
                            >
                              <StatusIcon s={entry.item.status} />
                              <PriorityIcon p={entry.item.priority} />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium">{entry.item.title}</span>
                                <span className="block truncate text-[10.5px] text-muted-foreground">{entry.item.id} / {entry.project?.name ?? entry.item.project}</span>
                              </span>
                            </button>
                            <div className="relative h-12">
                              <div className="absolute inset-0 flex">
                                {columnDates.map((date, index) => (
                                  <div
                                    key={`${entry.item.id}-${dateKey(date)}-${index}`}
                                    className="flex-1 border-r border-border/30"
                                  />
                                ))}
                              </div>
                              <TimelineBar
                                timelineItem={entry}
                                rangeStart={rangeStart}
                                totalHours={cfg.totalHours}
                                selected={selectedId === entry.item.id}
                                onSelect={selectItem}
                              />
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
                    <Chip tone={dueTone(selected.item, todayKey)}>{formatDateTime(selected.window?.end)}</Chip>
                  </div>
                </section>

                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Schedule</div>
                  <div className="space-y-1">
                    <InspectorRow label="Window" value={`${formatDateTime(selected.window?.start)} - ${formatDateTime(selected.window?.end)}`} />
                    <InspectorRow label="Duration" value={selected.window ? formatDuration(selected.window.durationHours) : "No due date"} />
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
                      value={toDateInputValue(selected.window?.end)}
                      onChange={(event) => updateWorkItem(selected.item.id, { due: toStoredDue(event.target.value, toTimeInputValue(selected.window?.end)) })}
                      className="min-w-0 flex-1 bg-transparent outline-none"
                    />
                    <input
                      type="time"
                      value={toTimeInputValue(selected.window?.end)}
                      onChange={(event) => updateWorkItem(selected.item.id, { due: toStoredDue(toDateInputValue(selected.window?.end), event.target.value) })}
                      className="w-[5.5rem] bg-transparent outline-none"
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
