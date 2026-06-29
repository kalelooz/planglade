import { getDatePart, localDateKey } from "@/lib/dates";
import type { Project, Status, WorkItem } from "@/lib/mock-data";

export type TimelineRangeMode = "week" | "month";

export type TimelineDateRange = {
  mode: TimelineRangeMode;
  startKey: string;
  endKey: string;
  days: string[];
};

export type TimelineDateSource = "range" | "start" | "due" | "none";

export type NormalizedTimelineTaskDates = {
  startKey: string | null;
  endKey: string | null;
  source: TimelineDateSource;
  isScheduled: boolean;
};

export type TimelineBarSpan = {
  startIndex: number;
  endIndex: number;
  leftPct: number;
  widthPct: number;
  startsBeforeRange: boolean;
  endsAfterRange: boolean;
};

export type TimelineTaskEntry = {
  task: WorkItem;
  dates: NormalizedTimelineTaskDates;
  originalIndex: number;
};

export type TimelineDatedTask = TimelineTaskEntry & {
  dates: NormalizedTimelineTaskDates & {
    startKey: string;
    endKey: string;
    isScheduled: true;
  };
  bar: TimelineBarSpan;
  isOverdue: boolean;
  isDueToday: boolean;
  isActiveToday: boolean;
  isTodayRelevant: boolean;
};

export type TimelineProjectGroup = {
  projectId: string;
  projectName: string;
  project: Project | null;
  tasks: TimelineDatedTask[];
};

export type TimelinePlan = {
  range: TimelineDateRange;
  projectGroups: TimelineProjectGroup[];
  unscheduledTasks: TimelineTaskEntry[];
};

const MS_PER_DAY = 86_400_000;
const NO_PROJECT_ID = "no-project";
const NO_PROJECT_NAME = "No project";

function strictDateKey(value: string | null | undefined): string | null {
  const datePart = getDatePart(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

function dateKeyToSerial(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / MS_PER_DAY;
}

function serialToDateKey(serial: number): string {
  const date = new Date(serial * MS_PER_DAY);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function daysBetween(startKey: string, endKey: string): string[] {
  const start = dateKeyToSerial(startKey);
  const end = dateKeyToSerial(endKey);
  return Array.from({ length: end - start + 1 }, (_, index) => serialToDateKey(start + index));
}

function projectGroupKey(task: WorkItem, projectsById: Map<string, Project>): string {
  return projectsById.has(task.project) ? task.project : NO_PROJECT_ID;
}

function isDone(status: Status): boolean {
  return status === "Done";
}

export function buildTimelineDateRange({
  mode,
  anchorDate = new Date(),
}: {
  mode: TimelineRangeMode;
  anchorDate?: Date;
}): TimelineDateRange {
  if (mode === "week") {
    const anchorKey = localDateKey(anchorDate);
    const anchorSerial = dateKeyToSerial(anchorKey);
    const mondayOffset = (anchorDate.getDay() + 6) % 7;
    const startKey = serialToDateKey(anchorSerial - mondayOffset);
    const endKey = serialToDateKey(anchorSerial - mondayOffset + 6);
    return { mode, startKey, endKey, days: daysBetween(startKey, endKey) };
  }

  const startKey = `${anchorDate.getFullYear()}-${String(anchorDate.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0);
  const endKey = localDateKey(endDate);
  return { mode, startKey, endKey, days: daysBetween(startKey, endKey) };
}

export function normalizeTimelineTaskDates(task: Pick<WorkItem, "start" | "due">): NormalizedTimelineTaskDates {
  const startKey = strictDateKey(task.start);
  const dueKey = strictDateKey(task.due);

  if (startKey && dueKey) {
    if (dateKeyToSerial(dueKey) < dateKeyToSerial(startKey)) {
      return { startKey: dueKey, endKey: startKey, source: "range", isScheduled: true };
    }
    return { startKey, endKey: dueKey, source: "range", isScheduled: true };
  }

  if (startKey) {
    return { startKey, endKey: startKey, source: "start", isScheduled: true };
  }

  if (dueKey) {
    return { startKey: dueKey, endKey: dueKey, source: "due", isScheduled: true };
  }

  return { startKey: null, endKey: null, source: "none", isScheduled: false };
}

export function calculateTimelineBarSpan({
  taskStartKey,
  taskEndKey,
  rangeStartKey,
  rangeEndKey,
}: {
  taskStartKey: string;
  taskEndKey: string;
  rangeStartKey: string;
  rangeEndKey: string;
}): TimelineBarSpan | null {
  const taskStart = dateKeyToSerial(taskStartKey);
  const taskEnd = dateKeyToSerial(taskEndKey);
  const rangeStart = dateKeyToSerial(rangeStartKey);
  const rangeEnd = dateKeyToSerial(rangeEndKey);

  if (taskEnd < rangeStart || taskStart > rangeEnd) return null;

  const clampedStart = Math.max(taskStart, rangeStart);
  const clampedEnd = Math.min(taskEnd, rangeEnd);
  const dayCount = rangeEnd - rangeStart + 1;
  const startIndex = clampedStart - rangeStart;
  const endIndex = clampedEnd - rangeStart;

  return {
    startIndex,
    endIndex,
    leftPct: (startIndex / dayCount) * 100,
    widthPct: ((endIndex - startIndex + 1) / dayCount) * 100,
    startsBeforeRange: taskStart < rangeStart,
    endsAfterRange: taskEnd > rangeEnd,
  };
}

export function buildTimelinePlan({
  projects,
  tasks,
  range,
  today = new Date(),
}: {
  projects: Project[];
  tasks: WorkItem[];
  range: TimelineDateRange;
  today?: Date;
}): TimelinePlan {
  const todayKey = localDateKey(today);
  const projectsById = new Map(projects.map((project) => [project.id, project]));
  const groupsById = new Map<string, TimelineProjectGroup>();
  const unscheduledTasks: TimelineTaskEntry[] = [];

  tasks.forEach((task, originalIndex) => {
    const dates = normalizeTimelineTaskDates(task);
    const baseEntry: TimelineTaskEntry = { task, dates, originalIndex };

    if (!dates.isScheduled || !dates.startKey || !dates.endKey) {
      unscheduledTasks.push(baseEntry);
      return;
    }

    const bar = calculateTimelineBarSpan({
      taskStartKey: dates.startKey,
      taskEndKey: dates.endKey,
      rangeStartKey: range.startKey,
      rangeEndKey: range.endKey,
    });
    if (!bar) return;

    const groupId = projectGroupKey(task, projectsById);
    const project = groupId === NO_PROJECT_ID ? null : projectsById.get(groupId) ?? null;
    if (!groupsById.has(groupId)) {
      groupsById.set(groupId, {
        projectId: groupId,
        projectName: project?.name ?? NO_PROJECT_NAME,
        project,
        tasks: [],
      });
    }

    const isTaskDone = isDone(task.status);
    const isDueToday = !isTaskDone && dates.endKey === todayKey;
    const isActiveToday = !isTaskDone && dates.startKey <= todayKey && dates.endKey >= todayKey;
    groupsById.get(groupId)!.tasks.push({
      ...baseEntry,
      dates: {
        ...dates,
        startKey: dates.startKey,
        endKey: dates.endKey,
        isScheduled: true,
      },
      bar,
      isOverdue: !isTaskDone && dates.endKey < todayKey,
      isDueToday,
      isActiveToday,
      isTodayRelevant: isDueToday || isActiveToday,
    });
  });

  const projectGroups = projects
    .map((project) => groupsById.get(project.id))
    .filter((group): group is TimelineProjectGroup => Boolean(group));
  const noProjectGroup = groupsById.get(NO_PROJECT_ID);
  if (noProjectGroup) projectGroups.push(noProjectGroup);

  return {
    range,
    projectGroups,
    unscheduledTasks,
  };
}
