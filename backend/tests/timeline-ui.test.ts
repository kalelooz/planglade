import assert from "node:assert/strict";
import test from "node:test";

import { buildTimelineViewModel, taskDateSummary, taskStateLabel } from "../src/app/timeline/timeline-view-model";
import type { Project, WorkItem } from "../src/lib/mock-data";

function project(id: string, name = id): Project {
  return {
    id,
    name,
    status: "Active",
    due: "",
    owner: "user-1",
    progress: 0,
    accent: "oklch(0.52 0.09 195)",
  };
}

function task(partial: Partial<WorkItem> & Pick<WorkItem, "id">): WorkItem {
  return {
    id: partial.id,
    title: partial.title ?? partial.id,
    status: partial.status ?? "To Do",
    priority: partial.priority ?? "Medium",
    assignee: partial.assignee ?? "user-1",
    label: partial.label ?? "Task",
    start: partial.start,
    due: partial.due ?? "",
    project: partial.project ?? "project-1",
  };
}

test("timeline view model renders dated task groups by project", () => {
  const view = buildTimelineViewModel({
    projects: [project("project-1", "Launch"), project("project-2", "Ops")],
    tasks: [
      task({ id: "launch-task", project: "project-1", due: "2026-06-03" }),
      task({ id: "ops-task", project: "project-2", start: "2026-06-04", due: "2026-06-05" }),
    ],
    mode: "week",
    anchorDate: new Date("2026-06-03T12:00:00"),
    today: new Date("2026-06-03T09:00:00"),
  });

  assert.deepEqual(view.plan.projectGroups.map((group) => group.projectName), ["Launch", "Ops"]);
  assert.deepEqual(view.plan.projectGroups.map((group) => group.tasks.map((entry) => entry.task.id)), [["launch-task"], ["ops-task"]]);
  assert.equal(view.hasDatedTasks, true);
});

test("timeline view model switches visible range for week and month", () => {
  const shared = {
    projects: [project("project-1", "Launch")],
    tasks: [task({ id: "launch-task", due: "2026-06-03" })],
    anchorDate: new Date("2026-06-03T12:00:00"),
    today: new Date("2026-06-03T09:00:00"),
  };

  const week = buildTimelineViewModel({ ...shared, mode: "week" });
  const month = buildTimelineViewModel({ ...shared, mode: "month" });

  assert.equal(week.plan.range.days.length, 7);
  assert.equal(month.plan.range.days.length, 30);
  assert.equal(week.rangeLabel, "Jun 1 - Jun 7, 2026");
  assert.equal(month.rangeLabel, "June 2026");
});

test("timeline view model separates unscheduled tasks", () => {
  const view = buildTimelineViewModel({
    projects: [project("project-1", "Launch")],
    tasks: [
      task({ id: "dated", due: "2026-06-03" }),
      task({ id: "unscheduled", due: "" }),
    ],
    mode: "week",
    anchorDate: new Date("2026-06-03T12:00:00"),
    today: new Date("2026-06-03T09:00:00"),
  });

  assert.deepEqual(view.plan.projectGroups[0].tasks.map((entry) => entry.task.id), ["dated"]);
  assert.deepEqual(view.plan.unscheduledTasks.map((entry) => entry.task.id), ["unscheduled"]);
});

test("timeline project filter keeps only that project's tasks", () => {
  const view = buildTimelineViewModel({
    projects: [project("project-1", "Launch"), project("project-2", "Ops")],
    tasks: [
      task({ id: "launch-dated", project: "project-1", due: "2026-06-03" }),
      task({ id: "ops-dated", project: "project-2", due: "2026-06-03" }),
      task({ id: "launch-unscheduled", project: "project-1", due: "" }),
    ],
    mode: "week",
    anchorDate: new Date("2026-06-03T12:00:00"),
    today: new Date("2026-06-03T09:00:00"),
    projectId: "project-1",
  });

  assert.deepEqual(view.plan.projectGroups.map((group) => group.projectName), ["Launch"]);
  assert.deepEqual(view.plan.projectGroups[0].tasks.map((entry) => entry.task.id), ["launch-dated"]);
  assert.deepEqual(view.plan.unscheduledTasks.map((entry) => entry.task.id), ["launch-unscheduled"]);
});

test("timeline view model places the today marker when today is visible", () => {
  const view = buildTimelineViewModel({
    projects: [project("project-1", "Launch")],
    tasks: [task({ id: "dated", due: "2026-06-03" })],
    mode: "week",
    anchorDate: new Date("2026-06-03T12:00:00"),
    today: new Date("2026-06-03T09:00:00"),
  });

  assert.equal(Math.round((view.todayLeftPct ?? 0) * 100) / 100, 35.71);
});

test("timeline task copy summarizes dates for bars and unscheduled tasks", () => {
  assert.equal(taskDateSummary(task({ id: "range", start: "2026-06-02", due: "2026-06-05" })), "Jun 2 - Jun 5");
  assert.equal(taskDateSummary(task({ id: "due", due: "2026-06-05" })), "Due Jun 5");
  assert.equal(taskDateSummary(task({ id: "start", start: "2026-06-02", due: "" })), "Starts Jun 2");
  assert.equal(taskDateSummary(task({ id: "none", due: "" })), "No date");
});

test("timeline task state labels expose overdue and today states", () => {
  assert.equal(taskStateLabel({ status: "Done", isOverdue: false, isDueToday: false, isActiveToday: false }), "Done");
  assert.equal(taskStateLabel({ status: "To Do", isOverdue: true, isDueToday: false, isActiveToday: false }), "Overdue");
  assert.equal(taskStateLabel({ status: "To Do", isOverdue: false, isDueToday: true, isActiveToday: true }), "Due today");
  assert.equal(taskStateLabel({ status: "In Progress", isOverdue: false, isDueToday: false, isActiveToday: true }), "Active today");
  assert.equal(taskStateLabel({ status: "To Do", isOverdue: false, isDueToday: false, isActiveToday: false }), null);
});
