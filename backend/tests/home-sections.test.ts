import assert from "node:assert/strict";
import test from "node:test";

import { selectHomeSections } from "../src/lib/home-sections";
import type { WorkItem } from "../src/lib/mock-data";

const now = new Date("2026-05-16T09:30:00.000Z");

function task(partial: Partial<WorkItem> & Pick<WorkItem, "id" | "status" | "due" | "project">): WorkItem {
  return {
    title: partial.id,
    priority: "Medium",
    assignee: "AM",
    label: "Task",
    ...partial,
  };
}

test("selectHomeSections derives today, overdue, inbox, and counts from current tasks", () => {
  const workItems: WorkItem[] = [
    task({ id: "task-overdue", status: "In Progress", priority: "High", due: "2026-05-15", project: "project-1" }),
    task({ id: "task-today", status: "To Do", due: "2026-05-16", project: "project-1" }),
    task({ id: "task-inbox", status: "Backlog", priority: "Low", due: "", project: "project-1" }),
    task({ id: "task-other-inbox", status: "Backlog", priority: "Low", due: "", project: "project-2" }),
    task({ id: "task-done", status: "Done", priority: "Low", due: "2026-05-16", project: "project-1" }),
    task({ id: "task-other-project", status: "To Do", due: "2026-05-16", project: "project-2" }),
  ];

  const home = selectHomeSections({ workItems, activeProjectId: "project-1", now });

  assert.deepEqual(home.today.map((item) => item.id), ["task-today"]);
  assert.deepEqual(home.overdue.map((item) => item.id), ["task-overdue"]);
  assert.deepEqual(home.inbox.map((item) => item.id), ["task-inbox", "task-other-inbox"]);
  assert.deepEqual(home.upcoming.map((item) => item.id), ["task-inbox"]);
  assert.deepEqual(home.completed.map((item) => item.id), ["task-done"]);
});
