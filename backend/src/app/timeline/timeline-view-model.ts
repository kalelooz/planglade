import { formatDueLabel, localDateKey, parseLocalDate } from "@/lib/dates";
import type { Project, WorkItem } from "@/lib/mock-data";
import {
  buildTimelineDateRange,
  buildTimelinePlan,
  type TimelinePlan,
  type TimelineRangeMode,
} from "@/lib/timeline";

export type TimelineProjectOption = {
  id: string;
  name: string;
};

export type TimelineTaskStateLabel = "Done" | "Overdue" | "Due today" | "Active today" | null;

export type TimelineViewModel = {
  mode: TimelineRangeMode;
  rangeLabel: string;
  plan: TimelinePlan;
  projectOptions: TimelineProjectOption[];
  todayKey: string;
  todayLeftPct: number | null;
  hasDatedTasks: boolean;
};

function rangeLabel(mode: TimelineRangeMode, startKey: string, endKey: string): string {
  const start = parseLocalDate(startKey);
  const end = parseLocalDate(endKey);
  if (!start || !end) return `${startKey} - ${endKey}`;

  if (mode === "month") {
    return start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-US", sameMonth ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} - ${endLabel}`;
}

export function taskDateSummary(task: WorkItem): string {
  const start = formatDueLabel(task.start);
  const due = formatDueLabel(task.due);
  if (task.start && task.due && start !== due) return `${start} - ${due}`;
  if (task.due) return `Due ${due}`;
  if (task.start) return `Starts ${start}`;
  return "No date";
}

export function taskStateLabel({
  status,
  isOverdue,
  isDueToday,
  isActiveToday,
}: {
  status: WorkItem["status"];
  isOverdue: boolean;
  isDueToday: boolean;
  isActiveToday: boolean;
}): TimelineTaskStateLabel {
  if (status === "Done") return "Done";
  if (isOverdue) return "Overdue";
  if (isDueToday) return "Due today";
  if (isActiveToday) return "Active today";
  return null;
}

export function buildTimelineViewModel({
  projects,
  tasks,
  mode,
  anchorDate,
  today = new Date(),
  projectId,
}: {
  projects: Project[];
  tasks: WorkItem[];
  mode: TimelineRangeMode;
  anchorDate: Date;
  today?: Date;
  projectId?: string | null;
}): TimelineViewModel {
  const filteredTasks = projectId ? tasks.filter((task) => task.project === projectId) : tasks;
  const range = buildTimelineDateRange({ mode, anchorDate });
  const plan = buildTimelinePlan({ projects, tasks: filteredTasks, range, today });
  const todayKey = localDateKey(today);
  const todayIndex = range.days.indexOf(todayKey);

  return {
    mode,
    rangeLabel: rangeLabel(mode, range.startKey, range.endKey),
    plan,
    projectOptions: projects.map((project) => ({ id: project.id, name: project.name })),
    todayKey,
    todayLeftPct: todayIndex >= 0 ? ((todayIndex + 0.5) / range.days.length) * 100 : null,
    hasDatedTasks: plan.projectGroups.some((group) => group.tasks.length > 0),
  };
}
