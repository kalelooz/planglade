"use client";
import { Suspense, useEffect, useState, useMemo, type CSSProperties, type MouseEvent } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/lovable/shell";
import { Chip, Toolbar } from "@/components/lovable/page";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { WorkItem, Project } from "@/lib/mock-data";
import { formatDueLabel, getDatePart, localDateKey, parseLocalDate } from "@/lib/dates";
import { apiFetch, buildSessionAuthHeaders, getServerSession } from "@/lib/server-session-client";
import { type ApiProject, type ApiWorkItem, toUiProject, toUiWorkItem } from "@/lib/server-ui-mappers";
import { applyWorkItemDependencyRelations, isBlockedByOpenTask, type WorkItemDependencyRelation } from "@/lib/work-item-dependencies";
import { getDemoFixtures } from "@/lib/demo-data";
import { blockReadOnlyMutation, handleDemoReadOnlyResponse } from "@/lib/demo-readonly";

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

// ── Chip styling: neutral cards with restrained state rails ───────────────────

type CalendarTaskState = "done" | "overdue" | "blocked" | "today" | "upcoming";

const TASK_RAIL_COLOR: Record<CalendarTaskState, string> = {
  done: "oklch(0.705 0.015 286)",
  overdue: "rgb(185 28 28)",
  blocked: "rgb(180 83 9)",
  today: "oklch(0.442 0.017 286)",
  upcoming: "oklch(0.705 0.015 286)",
};

function taskState(item: WorkItem, todayKey: string, allItems: WorkItem[] = []): CalendarTaskState {
  if (item.status === "Done") return "done";
  const dueKey = getDatePart(item.due);
  if (dueKey && dueKey < todayKey) return "overdue";
  if (allItems.length > 0 ? isBlockedByOpenTask(item, allItems) : (item.blockerIds?.length ?? 0) > 0) return "blocked";
  if (dueKey === todayKey) return "today";
  return "upcoming";
}

function taskStateLabel(item: WorkItem, todayKey: string, allItems: WorkItem[] = []): string {
  const state = taskState(item, todayKey, allItems);
  if (state === "done") return "Done";
  if (state === "overdue") return "Overdue";
  if (state === "blocked") return "Blocked";
  if (state === "today") return "Today";
  return "Upcoming";
}

function chipStyle(state: CalendarTaskState, isSelected = false): CSSProperties {
  return {
    borderLeftColor: isSelected ? "rgb(63 63 70)" : TASK_RAIL_COLOR[state],
  };
}

function taskTone(state: CalendarTaskState, isSelected = false): string {
  if (isSelected) return "border-ring bg-hover text-foreground ring-1 ring-ring hover:bg-hover shadow-[inset_3px_0_0_var(--color-ring)]";
  if (state === "done") return "border-border/50 bg-surface/50 text-muted-foreground hover:bg-hover/60";
  return "border-border/70 bg-surface/80 text-foreground hover:bg-hover/70";
}

function inspectorRowTone(state: CalendarTaskState, isSelected = false): string {
  if (isSelected) return "border-ring bg-hover text-foreground ring-1 ring-ring hover:bg-hover";
  if (state === "done") return "border-border/50 bg-surface/50 text-muted-foreground hover:bg-hover/60";
  return "border-border/70 bg-surface/80 text-foreground hover:bg-hover/70";
}

function titleTone(state: CalendarTaskState, isSelected = false): string {
  if (isSelected && state === "done") return "text-muted-foreground line-through";
  if (isSelected && state !== "overdue") return "text-foreground";
  if (state === "done") return "text-muted-foreground line-through";
  if (state === "overdue") return "text-red-700 dark:text-red-300";
  return "text-foreground";
}

function dueTone(state: CalendarTaskState): string {
  if (state === "overdue") return "font-medium text-red-700 dark:text-red-300";
  if (state === "blocked") return "font-medium text-amber-700 dark:text-amber-300";
  return "text-muted-foreground";
}

function projectNameFor(item: WorkItem, projectsById: Record<string, Project>) {
  return projectsById[item.project]?.name ?? "No project";
}

function MonthTaskCard({
  item,
  allItems,
  projectName,
  todayKey,
  isSelected,
  className = "",
  onSelect,
}: {
  item: WorkItem;
  allItems: WorkItem[];
  projectName: string;
  todayKey: string;
  isSelected: boolean;
  className?: string;
  onSelect: (id: string) => void;
}) {
  const state = taskState(item, todayKey, allItems);
  const isDone = state === "done";
  const stateLabel = taskStateLabel(item, todayKey, allItems);
  return (
    <button
      type="button"
      data-calendar-task-card="month"
      data-selected={isSelected ? "true" : "false"}
      aria-current={isSelected ? "true" : undefined}
      onClick={() => onSelect(item.id)}
      title={`${item.title} / ${projectName} / ${stateLabel} / ${item.priority}`}
      style={chipStyle(state, isSelected)}
      className={`grid w-full min-w-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-1 rounded border border-l-2 px-1.5 py-1 text-left text-[10px] leading-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${taskTone(state, isSelected)} ${isDone ? "opacity-80" : ""} ${className}`}
    >
      <span className={`min-w-0 truncate font-medium ${isSelected && !isDone ? "font-semibold" : ""} ${titleTone(state, isSelected)}`}>{item.title}</span>
      <span className="hidden shrink-0 items-center gap-1 text-muted-foreground sm:inline-flex">
        <PriorityIcon p={item.priority} className="!border-border/70 !bg-background !text-muted-foreground" />
      </span>
      <span className="sr-only">{projectName} / {stateLabel}</span>
      {isSelected && <span className="sr-only">Selected</span>}
      <span className="col-span-2 hidden min-w-0 truncate text-[10px] text-muted-foreground lg:block">{projectName}</span>
    </button>
  );
}

// ── Overflow popover for dense days ───────────────────────────────────────────

function DayOverflowButton({
  total,
  dateKey,
  onInspect,
}: {
  total: number;
  dateKey: string;
  onInspect: (dateKey: string) => void;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onInspect(dateKey);
  };

  return (
    <button
      type="button"
      aria-label={`View all ${total} tasks for ${fullDateLabel(dateKey)}`}
      onClick={handleClick}
      className="inline-flex shrink-0 items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
    >
      <span className="truncate">View all {total}</span>
      <span className="sr-only"> tasks</span>
    </button>
  );
}

// ── Month view ────────────────────────────────────────────────────────────────

const MONTH_VISIBLE = 2;
const WEEKDAY_HEADERS = [
  { short: "M", long: "Mon" },
  { short: "T", long: "Tue" },
  { short: "W", long: "Wed" },
  { short: "T", long: "Thu" },
  { short: "F", long: "Fri" },
  { short: "S", long: "Sat" },
  { short: "S", long: "Sun" },
];

function CalendarDayAddButton({
  dateKey,
  onCreate,
  className = "",
}: {
  dateKey: string;
  onCreate: (dateKey: string) => void;
  className?: string;
}) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onCreate(dateKey);
  };

  return (
    <button
      type="button"
      data-calendar-add="day"
      aria-label={`Add task for ${fullDateLabel(dateKey)}`}
      onClick={handleClick}
      className={`flex h-6 w-full items-center justify-center rounded border border-dashed border-border/50 bg-transparent text-[10px] text-muted-foreground transition-colors hover:border-border/80 hover:bg-hover/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background ${className}`}
    >
      <Plus className="mr-1 h-3 w-3" /> Add
    </button>
  );
}

function TaskChip({
  item,
  allItems,
  members,
  projectName,
  todayKey,
  isSelected,
  onSelect,
}: {
  item: WorkItem;
  allItems: WorkItem[];
  members: Array<{ id: string; name: string }>;
  projectName: string;
  todayKey: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const state = taskState(item, todayKey, allItems);
  const stateLabel = taskStateLabel(item, todayKey, allItems);
  const isDone = state === "done";
  const member = members.find((candidate) => candidate.id === item.assignee) ?? { id: "unassigned", name: "Unassigned" };
  const displayLabel = item.label?.trim() || item.status;
  const dueLabel = item.due ? formatDueLabel(item.due) : "No date";

  return (
    <button
      type="button"
      data-selected={isSelected ? "true" : "false"}
      aria-current={isSelected ? "true" : undefined}
      onClick={() => onSelect(item.id)}
      title={`${item.title} / ${projectName} / ${stateLabel} / ${item.priority}`}
      style={chipStyle(state, isSelected)}
      className={`grid min-h-14 w-full min-w-0 grid-cols-[minmax(0,1fr)] items-start gap-x-4 gap-y-1 rounded border border-l-2 px-3 py-2.5 text-left text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background sm:grid-cols-[minmax(0,1fr)_104px_minmax(5rem,7rem)] sm:items-center ${inspectorRowTone(state, isSelected)} ${isDone ? "opacity-80" : ""}`}
    >
      <span className="min-w-0">
        <span className={`block min-w-0 truncate text-[13px] font-medium ${isSelected && !isDone ? "font-semibold text-foreground" : titleTone(state, isSelected)}`}>{item.title}</span>
        <span className="mt-0.5 block min-w-0 truncate text-[11px] text-muted-foreground">{projectName}</span>
      </span>
      <span className="inline-flex min-w-0 items-center gap-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
        <PriorityIcon p={item.priority} className="!border-border/70 !bg-background !text-muted-foreground" />
        <span className="truncate">{item.priority}</span>
      </span>
      <span className={`min-w-0 truncate text-[11px] ${dueTone(state)}`}>{stateLabel}</span>
      <span className="sr-only">
        <Avatar id={member.id} name={member.name} size={16} />
        <Chip>{displayLabel}</Chip>
        {dueLabel}
      </span>
      {isSelected && <span className="sr-only">Selected</span>}
    </button>
  );
}

function DayOverflowPopover(props: {
  total: number;
  dateKey: string;
  onInspect: (dateKey: string) => void;
}) {
  return <DayOverflowButton {...props} />;
}

function DayInspector({
  dateKey,
  items,
  allItems,
  todayKey,
  members,
  projectsById,
  selectedId,
  onClose,
  onSelect,
  onCreate,
}: {
  dateKey: string | null;
  items: WorkItem[];
  allItems: WorkItem[];
  todayKey: string;
  members: Array<{ id: string; name: string }>;
  projectsById: Record<string, Project>;
  selectedId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCreate: (dateKey: string) => void;
}) {
  const open = Boolean(dateKey);
  const dateLabel = dateKey ? fullDateLabel(dateKey) : "";
  const handleAdd = () => {
    if (dateKey) onCreate(dateKey);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] w-[calc(100vw-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:w-full sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border/70 px-4 pb-3 pt-4 pr-10 text-left">
          <DialogTitle className="truncate text-[16px]">{dateLabel}</DialogTitle>
          <DialogDescription className="mt-1 text-[12px]">
            {items.length} task{items.length === 1 ? "" : "s"} scheduled
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(32rem,calc(100vh-11rem))] min-w-0 space-y-1 overflow-y-auto px-3 py-3 [scrollbar-width:thin]">
          {items.map((item) => (
            <TaskChip
              key={item.id}
              item={item}
              allItems={allItems}
              members={members}
              projectName={projectNameFor(item, projectsById)}
              todayKey={todayKey}
              isSelected={item.id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
        {dateKey && (
          <div className="shrink-0 border-t border-border/70 bg-surface/70 px-4 py-3">
            <button
              type="button"
              aria-label={`Add task for ${fullDateLabel(dateKey)}`}
              onClick={handleAdd}
              className="inline-flex h-8 w-full items-center justify-center rounded border border-border/70 bg-background px-3 text-[12px] font-medium text-foreground transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background sm:w-auto"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add task for this day
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MonthView({
  cursor,
  itemsByKey,
  allItems,
  todayKey,
  now,
  projectsById,
  selectedId,
  onSelect,
  onCreate,
  onInspect,
}: {
  cursor: Date;
  itemsByKey: Record<string, WorkItem[]>;
  allItems: WorkItem[];
  todayKey: string;
  now: Date;
  projectsById: Record<string, Project>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: (dateKey: string) => void;
  onInspect: (dateKey: string) => void;
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
    <div className="grid h-full min-w-0 grid-cols-7 border-b border-l text-[12px]">
      {WEEKDAY_HEADERS.map((d, index) => (
        <div
          key={`${d.long}-${index}`}
          className="border-r border-t border-border/70 bg-surface/40 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
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
        return (
          <div
            key={idx}
            className={`group/day min-h-28 border-r border-t border-border/70 p-1.5 sm:min-h-32 lg:min-h-36 ${day ? "" : "bg-muted/20"}`}
          >
            {day && (
              <>
                <div className="mb-1 flex min-w-0 items-center justify-between gap-1">
                  <span
                    className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
                      isToday
                        ? "bg-primary font-semibold text-primary-foreground"
                        : "text-muted-foreground"
                    }`}
                  >
                    {day}
                  </span>
                  {dayItems.length > 0 && (
                    hasOverflow ? (
                      <DayOverflowPopover
                        total={dayItems.length}
                        dateKey={key}
                        onInspect={onInspect}
                      />
                    ) : (
                      <span className="shrink-0 rounded border border-border bg-muted px-1 text-[10px] text-muted-foreground">
                        {dayItems.length}
                      </span>
                    )
                  )}
                </div>
                <div className="max-h-[5.75rem] space-y-0.5 overflow-hidden">
                  {visible.map((t) => (
                    <MonthTaskCard
                      key={t.id}
                      item={t}
                      allItems={allItems}
                      projectName={projectNameFor(t, projectsById)}
                      todayKey={todayKey}
                      isSelected={t.id === selectedId}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
                <CalendarDayAddButton
                  dateKey={key}
                  onCreate={onCreate}
                  className="mt-1"
                />
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
  allItems,
  todayKey,
  projectsById,
  selectedId,
  onSelect,
  onCreate,
}: {
  cursor: Date;
  itemsByKey: Record<string, WorkItem[]>;
  allItems: WorkItem[];
  todayKey: string;
  projectsById: Record<string, Project>;
  selectedId: string | null;
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
          <div key={key} className="flex min-h-0 flex-col border-r border-t border-border/70">
            <div
              className={`flex shrink-0 items-center gap-1.5 border-b border-border/60 px-2 py-2 ${isToday ? "bg-primary/[0.08]" : "bg-surface/40"}`}
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
                <MonthTaskCard
                  key={t.id}
                  item={t}
                  allItems={allItems}
                  projectName={projectNameFor(t, projectsById)}
                  todayKey={todayKey}
                  isSelected={t.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
              <CalendarDayAddButton dateKey={key} onCreate={onCreate} className="mt-2 px-2 py-1" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function NoDateTask({
  item,
  projectsById,
  members,
  isSelected,
  onSelect,
}: {
  item: WorkItem;
  projectsById: Record<string, Project>;
  members: Array<{ id: string; name: string }>;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const member = members.find((candidate) => candidate.id === item.assignee) ?? { id: "unassigned", name: "Unassigned" };
  const displayLabel = item.status;
  const dueLabel = "No date";

  return (
    <button
      type="button"
      data-selected={isSelected ? "true" : "false"}
      aria-current={isSelected ? "true" : undefined}
      onClick={() => onSelect(item.id)}
      className={`grid min-h-11 w-full min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-t px-4 py-2 text-left text-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background md:grid-cols-[minmax(18rem,1fr)_minmax(10rem,16rem)_96px_minmax(8rem,12rem)_96px_88px] ${isSelected ? "border-ring bg-muted ring-1 ring-ring shadow-[inset_3px_0_0_var(--color-ring)] hover:bg-muted" : "border-border/60 hover:bg-hover"}`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-medium ${isSelected ? "font-semibold text-foreground" : ""}`}>{item.title}</span>
        {isSelected && <span className="sr-only">Selected</span>}
        <span className="block truncate text-[11px] text-muted-foreground md:hidden">
          {projectNameFor(item, projectsById)} / {item.status} / No date
        </span>
      </span>
      <span className="hidden min-w-0 truncate text-[11px] text-muted-foreground md:block">
        {projectNameFor(item, projectsById)}
      </span>
      <span className="hidden min-w-0 items-center gap-1 text-muted-foreground md:inline-flex">
        <PriorityIcon p={item.priority} className="!border-border/70 !bg-background !text-muted-foreground" />
        <span className="truncate">{item.priority}</span>
      </span>
      <span className="hidden min-w-0 items-center gap-1 text-foreground/75 md:inline-flex">
        <Avatar id={member.id} name={member.name} size={16} />
        <span className="truncate">{member.name}</span>
      </span>
      <span className="hidden min-w-0 max-w-full overflow-hidden md:inline-flex [&_*]:min-w-0 [&_*]:truncate"><Chip>{displayLabel}</Chip></span>
      <span className="hidden shrink-0 text-muted-foreground md:block">
        {dueLabel}
      </span>
    </button>
  );
}

type CalView = "month" | "week";

function CalendarPageContent({ basePath }: { basePath: "/app" | "/demo" }) {
  const params = useSearchParams();
  const routeProjectId = params.get("project");
  const isDemoMode = basePath === "/demo";
  const demoData = isDemoMode ? getDemoFixtures() : null;
  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(isDemoMode ? "demo-workspace" : null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(isDemoMode ? "demo-user" : null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>(() => isDemoMode ? [{ id: "demo-user", name: "Demo User" }] : []);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>(() => demoData
    ? demoData.apiProjects.map((project) => toUiProject(project, "demo-user"))
    : []);
  const [workItems, setWorkItems] = useState<WorkItem[]>(() => demoData
    ? applyWorkItemDependencyRelations(demoData.apiTasks.map((item) => toUiWorkItem(item, "demo-user")), demoData.demoRelations)
    : []);

  const [cursor, setCursor] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [view, setView] = useState<CalView>("month");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusNewTask, setFocusNewTask] = useState(false);
  const [inspectedDateKey, setInspectedDateKey] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) return;
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
        const sessionHeaders = await buildSessionAuthHeaders();
        const actorHeaders = {
          ...sessionHeaders,
          "x-flowboard-user-id": session.user.id,
        };

        const [projectsRes, workItemsRes, relationsRes] = await Promise.all([
          apiFetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, {
            cache: "no-store",
            headers: actorHeaders,
          }),
          apiFetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, {
            cache: "no-store",
            headers: actorHeaders,
          }),
          apiFetch(`/api/work-item-relations?workspaceId=${encodeURIComponent(session.workspace.id)}`, {
            cache: "no-store",
            headers: actorHeaders,
          }),
        ]);
        if (!projectsRes.ok) throw new Error("Failed to load projects");
        if (!workItemsRes.ok) throw new Error("Failed to load calendar tasks");
        if (!relationsRes.ok) throw new Error("Failed to load task dependencies");

        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const workItemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        const relationsPayload = (await relationsRes.json()) as { relations: WorkItemDependencyRelation[] };
        if (!active) return;

        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        const mappedItems = workItemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id));
        setWorkItems(applyWorkItemDependencyRelations(mappedItems, relationsPayload.relations));
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
  }, [isDemoMode]);

  const scopedProjectId = routeProjectId ?? activeProjectId;
  const projectsById = useMemo(() => {
    const map: Record<string, Project> = {};
    for (const p of projects) map[p.id] = p;
    return map;
  }, [projects]);
  const projectFilterValue = scopedProjectId ?? "all";
  const selectedProjectName =
    scopedProjectId ? projectsById[scopedProjectId]?.name ?? "Selected project" : "All projects";

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
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => {
        const aDone = a.status === "Done" ? 1 : 0;
        const bDone = b.status === "Done" ? 1 : 0;
        if (aDone !== bDone) return aDone - bDone;
        return a.title.localeCompare(b.title);
      });
    }
    return map;
  }, [scopedWorkItems]);

  const noDateTasks = useMemo(
    () =>
      scopedWorkItems
        .filter((w) => !parseDue(w.due))
        .sort((a, b) => {
          const aDone = a.status === "Done" ? 1 : 0;
          const bDone = b.status === "Done" ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          return a.title.localeCompare(b.title);
        }),
    [scopedWorkItems]
  );
  const undatedCount = noDateTasks.length;
  const inspectedDateItems = inspectedDateKey ? (itemsByKey[inspectedDateKey] ?? []) : [];

  const dueSummary = useMemo(() => {
    return scopedWorkItems.reduce(
      (summary, item) => {
        const dueKey = getDatePart(item.due);
        if (!dueKey) return summary;
        if (item.status === "Done") summary.done += 1;
        else if (dueKey < todayKey) summary.overdue += 1;
        else if (dueKey === todayKey) summary.today += 1;
        else summary.upcoming += 1;
        return summary;
      },
      { overdue: 0, today: 0, upcoming: 0, done: 0 }
    );
  }, [scopedWorkItems, todayKey]);

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

  function createOnDate(dateKey: string) {
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (!workspaceId) return;
    void (async () => {
      const sessionHeaders = await buildSessionAuthHeaders();
      const response = await apiFetch("/api/work-items", {
        method: "POST",
        headers: {
          ...sessionHeaders,
          "content-type": "application/json",
          "x-flowboard-user-id": currentUserId ?? "",
        },
        body: JSON.stringify({
          workspaceId,
          projectId: scopedProjectId ?? projects[0]?.id ?? undefined,
          title: "New task",
          status: "BACKLOG",
          priority: "MEDIUM",
          startDate: `${dateKey}T00:00:00.000Z`,
          dueDate: `${dateKey}T00:00:00.000Z`,
        }),
      });
      if (!response.ok) {
        if (handleDemoReadOnlyResponse(response)) return;
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
          <button onClick={prev} aria-label={view === "month" ? "Previous month" : "Previous week"} className="lov-icon-btn">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[120px] text-center text-[12px] font-medium sm:min-w-[180px] sm:text-[13px]">
            {navLabel}
          </span>
          <button onClick={next} aria-label={view === "month" ? "Next month" : "Next week"} className="lov-icon-btn">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCursor(new Date())}
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
          {projects.length > 0 && (
            <label className="hidden h-7 items-center gap-1.5 rounded border border-border/70 bg-background px-2 text-[12px] text-muted-foreground sm:flex">
              <span>Project</span>
              <select
                value={projectFilterValue}
                onChange={(event) => setActiveProjectId(event.target.value === "all" ? null : event.target.value)}
                disabled={Boolean(routeProjectId)}
                className="h-6 max-w-44 bg-transparent text-foreground outline-none disabled:opacity-80"
                aria-label="Filter calendar by project"
              >
                <option value="all">All projects</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {undatedCount > 0 && (
            <span className="hidden text-[12px] text-muted-foreground lg:inline">
              {undatedCount} no date
            </span>
          )}
        </Toolbar>
      }
    >
      <div className="flex h-full min-h-0 w-full">
        {error && <div className="absolute left-6 right-6 top-3 z-40 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</div>}
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
          {loading && <div className="px-4 py-2 text-[12px] text-muted-foreground">Loading calendar data...</div>}
          <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-background/80 px-4 py-2 text-[12px] text-muted-foreground">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <CalendarClock className="h-3.5 w-3.5" />
              <span className="truncate">{selectedProjectName}</span>
            </span>
            <span>/</span>
            <span className={dueSummary.overdue > 0 ? "text-red-700 dark:text-red-300" : ""}>{dueSummary.overdue} overdue</span>
            <span>/</span>
            <span className={dueSummary.today > 0 ? "text-primary" : ""}>{dueSummary.today} today</span>
            <span>/</span>
            <span>{dueSummary.upcoming} upcoming</span>
            {dueSummary.done > 0 && (
              <>
                <span>/</span>
                <span className="text-emerald-700 dark:text-emerald-300">{dueSummary.done} done</span>
              </>
            )}
          </div>
          {!loading && scopedWorkItems.length === 0 && (
            <div className="mx-4 mt-4">
              <div className="flow-empty !border-border/60 !bg-surface/50 !shadow-none py-8">
                <p className="text-[13px] font-medium text-foreground">Nothing scheduled yet.</p>
                <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">
                  Add a due date to a task in {selectedProjectName} to see it here. You can also click any day to create a task for that date.
                </p>
              </div>
            </div>
          )}
          {view === "month" ? (
            <div className="max-w-full overflow-x-hidden">
              <MonthView
                cursor={cursor}
                itemsByKey={itemsByKey}
                allItems={workItems}
                todayKey={todayKey}
                now={now}
                projectsById={projectsById}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCreate={createOnDate}
                onInspect={setInspectedDateKey}
              />
            </div>
          ) : (
            <div>
              <WeekView
                cursor={cursor}
                itemsByKey={itemsByKey}
                allItems={workItems}
                todayKey={todayKey}
                projectsById={projectsById}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onCreate={createOnDate}
              />
            </div>
          )}
          <DayInspector
            dateKey={inspectedDateKey}
            items={inspectedDateItems}
            allItems={workItems}
            todayKey={todayKey}
            members={members}
            projectsById={projectsById}
            selectedId={selectedId}
            onClose={() => setInspectedDateKey(null)}
            onSelect={setSelectedId}
            onCreate={createOnDate}
          />
          {noDateTasks.length > 0 && (
            <section className="w-full min-w-0 border-t border-border/70 bg-surface/50">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <h2 className="text-[13px] font-semibold">No date</h2>
                  <p className="text-[12px] text-muted-foreground">Open a task to add a due date and place it on the calendar.</p>
                </div>
                <span className="rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px] text-muted-foreground">{noDateTasks.length}</span>
              </div>
              <div className="w-full min-w-0 border-t border-border/60">
                <div className="hidden min-h-8 w-full min-w-0 grid-cols-[minmax(18rem,1fr)_minmax(10rem,16rem)_96px_minmax(8rem,12rem)_96px_88px] items-center gap-x-3 border-b border-border/60 px-4 text-[10px] font-medium uppercase text-muted-foreground md:grid">
                  <span>Title</span>
                  <span>Project</span>
                  <span>Priority</span>
                  <span>Assignee</span>
                  <span>Status</span>
                  <span>Date</span>
                </div>
                {noDateTasks.map((item) => (
                  <NoDateTask
                    key={item.id}
                    item={item}
                    projectsById={projectsById}
                    members={members}
                    isSelected={item.id === selectedId}
                    onSelect={setSelectedId}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
        <TaskDrawer
          readOnly={isDemoMode}
          item={selectedItem}
          focusTitle={focusNewTask}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          membersOverride={members}
          projectsOverride={projects}
          allItems={workItems}
          onItemsReplaced={setWorkItems}
          onSelectItem={setSelectedId}
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

export default function CalendarPage({ basePath = "/app" }: { basePath?: "/app" | "/demo" }) {
  return (
    <Suspense fallback={null}>
      <CalendarPageContent basePath={basePath} />
    </Suspense>
  );
}
