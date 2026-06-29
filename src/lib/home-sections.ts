import { compareLocalDateStrings, getDatePart, localDateKey } from "./dates";
import type { WorkItem } from "./mock-data";

const priorityRank = { High: 0, Medium: 1, Low: 2 };

export type HomeSections = {
  today: WorkItem[];
  upcoming: WorkItem[];
  overdue: WorkItem[];
  completed: WorkItem[];
  inbox: WorkItem[];
};

export function selectHomeSections({
  workItems,
  activeProjectId,
  now = new Date(),
}: {
  workItems: WorkItem[];
  activeProjectId?: string | null;
  now?: Date;
}): HomeSections {
  const todayKey = localDateKey(now);
  const today: WorkItem[] = [];
  const upcoming: WorkItem[] = [];
  const overdue: WorkItem[] = [];
  const completed: WorkItem[] = [];
  const inbox: WorkItem[] = [];

  for (const item of workItems) {
    if (item.status === "Backlog") {
      inbox.push(item);
    }

    if (item.status === "Done") {
      completed.push(item);
      continue;
    }

    if (activeProjectId && item.project !== activeProjectId) continue;

    const due = getDatePart(item.due);
    const cmp = due ? compareLocalDateStrings(due, todayKey) : 1;
    if (due && cmp < 0) overdue.push(item);
    else if (due && cmp === 0) today.push(item);
    else upcoming.push(item);
  }

  overdue.sort((a, b) => compareLocalDateStrings(a.due, b.due) || priorityRank[a.priority] - priorityRank[b.priority]);
  today.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || compareLocalDateStrings(a.due || todayKey, b.due || todayKey));
  upcoming.sort((a, b) => compareLocalDateStrings(a.due, b.due));
  inbox.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || compareLocalDateStrings(a.due || todayKey, b.due || todayKey));

  return { today, upcoming, overdue, completed, inbox };
}
