import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTimelineDateRange,
  buildTimelinePlan,
  calculateTimelineBarSpan,
} from "../src/lib/timeline";
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

test("buildTimelineDateRange creates a Monday-start week range", () => {
  const range = buildTimelineDateRange({ mode: "week", anchorDate: new Date("2026-06-03T12:00:00") });

  assert.equal(range.startKey, "2026-06-01");
  assert.equal(range.endKey, "2026-06-07");
  assert.deepEqual(range.days, [
    "2026-06-01",
    "2026-06-02",
    "2026-06-03",
    "2026-06-04",
    "2026-06-05",
    "2026-06-06",
    "2026-06-07",
  ]);
});

test("buildTimelineDateRange creates a full month range", () => {
  const range = buildTimelineDateRange({ mode: "month", anchorDate: new Date("2026-02-10T12:00:00") });

  assert.equal(range.startKey, "2026-02-01");
  assert.equal(range.endKey, "2026-02-28");
  assert.equal(range.days.length, 28);
});

test("tasks with due dates appear in dated groups", () => {
  const plan = buildTimelinePlan({
    projects: [project("project-1", "Launch")],
    tasks: [task({ id: "dated", due: "2026-06-04" })],
    range: buildTimelineDateRange({ mode: "week", anchorDate: new Date("2026-06-03T12:00:00") }),
    today: new Date("2026-06-03T09:00:00"),
  });

  assert.deepEqual(plan.projectGroups.map((group) => group.projectName), ["Launch"]);
  assert.deepEqual(plan.projectGroups[0].tasks.map((entry) => entry.task.id), ["dated"]);
  assert.deepEqual(plan.unscheduledTasks.map((entry) => entry.task.id), []);
});

test("tasks without usable dates appear in Unscheduled", () => {
  const plan = buildTimelinePlan({
    projects: [project("project-1")],
    tasks: [
      task({ id: "missing", due: "" }),
      task({ id: "invalid", start: "not-a-date", due: "also-bad" }),
    ],
    range: buildTimelineDateRange({ mode: "week", anchorDate: new Date("2026-06-03T12:00:00") }),
    today: new Date("2026-06-03T09:00:00"),
  });

  assert.deepEqual(plan.projectGroups, []);
  assert.deepEqual(plan.unscheduledTasks.map((entry) => entry.task.id), ["missing", "invalid"]);
});

test("dated tasks are grouped by project", () => {
  const plan = buildTimelinePlan({
    projects: [project("project-1", "Alpha"), project("project-2", "Beta")],
    tasks: [
      task({ id: "a", project: "project-1", due: "2026-06-02" }),
      task({ id: "b", project: "project-2", due: "2026-06-03" }),
    ],
    range: buildTimelineDateRange({ mode: "week", anchorDate: new Date("2026-06-03T12:00:00") }),
    today: new Date("2026-06-03T09:00:00"),
  });

  assert.deepEqual(plan.projectGroups.map((group) => group.projectName), ["Alpha", "Beta"]);
  assert.deepEqual(plan.projectGroups.map((group) => group.tasks.map((entry) => entry.task.id)), [["a"], ["b"]]);
});

test("tasks without a known project are grouped safely", () => {
  const plan = buildTimelinePlan({
    projects: [project("project-1", "Known")],
    tasks: [
      task({ id: "known", project: "project-1", due: "2026-06-02" }),
      task({ id: "orphan", project: "missing-project", due: "2026-06-03" }),
    ],
    range: buildTimelineDateRange({ mode: "week", anchorDate: new Date("2026-06-03T12:00:00") }),
    today: new Date("2026-06-03T09:00:00"),
  });

  assert.deepEqual(plan.projectGroups.map((group) => group.projectName), ["Known", "No project"]);
  assert.deepEqual(plan.projectGroups[1].tasks.map((entry) => entry.task.id), ["orphan"]);
});

test("calculateTimelineBarSpan clamps dated tasks to the visible range", () => {
  const span = calculateTimelineBarSpan({
    taskStartKey: "2026-05-30",
    taskEndKey: "2026-06-03",
    rangeStartKey: "2026-06-01",
    rangeEndKey: "2026-06-07",
  });

  assert.ok(span);
  assert.equal(span.leftPct, 0);
  assert.equal(Math.round(span.widthPct * 100) / 100, 42.86);
  assert.equal(span.startsBeforeRange, true);
  assert.equal(span.endsAfterRange, false);
});

test("dated tasks mark overdue and today-relevant state", () => {
  const plan = buildTimelinePlan({
    projects: [project("project-1")],
    tasks: [
      task({ id: "overdue", due: "2026-06-06" }),
      task({ id: "today", due: "2026-06-07" }),
      task({ id: "done-old", status: "Done", due: "2026-06-01" }),
    ],
    range: buildTimelineDateRange({ mode: "week", anchorDate: new Date("2026-06-07T12:00:00") }),
    today: new Date("2026-06-07T09:00:00"),
  });

  const states = new Map(plan.projectGroups[0].tasks.map((entry) => [entry.task.id, entry]));
  assert.equal(states.get("overdue")?.isOverdue, true);
  assert.equal(states.get("overdue")?.isTodayRelevant, false);
  assert.equal(states.get("today")?.isOverdue, false);
  assert.equal(states.get("today")?.isTodayRelevant, true);
  assert.equal(states.get("done-old")?.isOverdue, false);
});

test("timeline planning preserves stable project and task ordering", () => {
  const plan = buildTimelinePlan({
    projects: [project("project-2", "Second"), project("project-1", "First")],
    tasks: [
      task({ id: "first-b", project: "project-1", due: "2026-06-03" }),
      task({ id: "second-a", project: "project-2", due: "2026-06-02" }),
      task({ id: "first-a", project: "project-1", due: "2026-06-01" }),
      task({ id: "orphan", project: "missing-project", due: "2026-06-04" }),
      task({ id: "unscheduled", project: "project-2", due: "" }),
    ],
    range: buildTimelineDateRange({ mode: "week", anchorDate: new Date("2026-06-03T12:00:00") }),
    today: new Date("2026-06-03T09:00:00"),
  });

  assert.deepEqual(plan.projectGroups.map((group) => group.projectName), ["Second", "First", "No project"]);
  assert.deepEqual(plan.projectGroups.map((group) => group.tasks.map((entry) => entry.task.id)), [
    ["second-a"],
    ["first-b", "first-a"],
    ["orphan"],
  ]);
  assert.deepEqual(plan.unscheduledTasks.map((entry) => entry.task.id), ["unscheduled"]);
});
