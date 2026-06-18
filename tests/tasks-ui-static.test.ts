import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Tasks route owns the list and board hub", () => {
  const route = readFileSync("src/app/app/tasks/page.tsx", "utf8");
  const hub = readFileSync("src/components/tasks/task-hub.tsx", "utf8");

  assert.equal(route.includes("../../board/page"), false);
  assert.equal(route.includes("../../my-tasks/page"), false);
  assert.equal(route.includes("../../work-items/page"), false);
  assert.equal(hub.includes("INITIAL_TASKS"), false);
  assert.equal(hub.includes("Task Registry"), false);
  assert.equal(hub.includes("sortOrder"), false);
  assert.equal(hub.includes("rank"), false);
  assert.equal(hub.includes("/board"), false);
});

test("Tasks blocked filter only uses real blocker metadata", () => {
  const hub = readFileSync("src/components/tasks/task-hub.tsx", "utf8");
  const myTasks = readFileSync("src/app/my-tasks/page.tsx", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.match(hub, /function isBlocked\(task: WorkItem\) \{\s+return Boolean\(task\.blockerIds\?\.length\);\s+\}/);
  assert.equal(hub.includes('task.status === "In Review"'), false);
  assert.equal(hub.includes("/block/i"), false);
  assert.equal(myTasks.includes('w.status === "In Review"'), false);
  assert.equal(myTasks.includes("/block/i"), false);
  assert.match(schema, /enum WorkItemStatus \{\s+BACKLOG\s+TODO\s+IN_PROGRESS\s+IN_REVIEW\s+DONE\s+\}/);
  assert.doesNotMatch(schema.match(/enum WorkItemStatus \{[\s\S]*?\}/)?.[0] ?? "", /BLOCKED/);
});

test("Core app task surfaces use the shared task drawer", () => {
  const sharedImport = 'import { TaskDrawer } from "@/components/tasks/task-drawer";';
  const surfaces = [
    "src/components/flowboard-home.tsx",
    "src/app/inbox/page.tsx",
    "src/components/tasks/task-hub.tsx",
    "src/app/projects/page.tsx",
    "src/app/calendar/page.tsx",
    "src/app/board/page.tsx",
    "src/app/work-items/page.tsx",
    "src/app/my-tasks/page.tsx",
  ];

  for (const file of surfaces) {
    const source = readFileSync(file, "utf8");
    assert.equal(source.includes(sharedImport), true, file);
    assert.equal(source.includes("@/components/lovable/task-drawer"), false, file);
  }

  assert.equal(readFileSync("src/components/tasks/task-drawer.tsx", "utf8").includes("export function TaskDrawer"), true);
  assert.equal(readFileSync("src/components/lovable/task-drawer.tsx", "utf8").trim(), 'export { TaskDrawer } from "@/components/tasks/task-drawer";');
  const hub = readFileSync("src/components/tasks/task-hub.tsx", "utf8");
  assert.equal(hub.includes("function TaskDetails"), false);
  assert.equal(hub.includes("/api/notes?workspaceId="), true);
  assert.equal(readFileSync("src/app/notes/page.tsx", "utf8").includes("TaskDrawer"), false);
  assert.equal(readFileSync("src/app/settings/page.tsx", "utf8").includes("TaskDrawer"), false);
});

test("Canonical app routes point at drawer-enabled surfaces", () => {
  assert.equal(readFileSync("src/app/app/page.tsx", "utf8").includes("PlanGladeHome"), true);
  assert.equal(readFileSync("src/app/app/inbox/page.tsx", "utf8").trim(), 'export { default } from "../../inbox/page";');
  assert.equal(readFileSync("src/app/app/calendar/page.tsx", "utf8").trim(), 'export { default } from "../../calendar/page";');
  assert.equal(readFileSync("src/app/app/projects/page.tsx", "utf8").trim(), 'export { default } from "../../projects/page";');
  assert.equal(readFileSync("src/app/app/projects/[projectId]/page.tsx", "utf8").includes('redirect(`/app/projects?${nextParams.toString()}`);'), true);
  assert.equal(readFileSync("src/app/app/tasks/page.tsx", "utf8").includes('import { TaskHub } from "@/components/tasks/task-hub";'), true);
});

test("Ctrl+K command palette keeps keyboard selection visible", () => {
  const palette = readFileSync("src/components/lovable/command-palette.tsx", "utf8");

  assert.equal(palette.includes("listRef"), true);
  assert.equal(palette.includes("data-command-index"), true);
  assert.equal(palette.includes('scrollIntoView({ block: "nearest" })'), true);
});

test("Tasks board reflows instead of using horizontal scroll", () => {
  const hub = readFileSync("src/components/tasks/task-hub.tsx", "utf8");
  const drawer = readFileSync("src/components/tasks/task-drawer.tsx", "utf8");
  const instructions = readFileSync("AGENTS.md", "utf8");

  assert.equal(hub.includes("overflow-x-auto"), false);
  assert.equal(hub.includes("min-w-max"), false);
  assert.equal(hub.includes("w-[280px]"), false);
  assert.equal(hub.includes("xl:w-[300px]"), false);
  assert.equal(hub.includes("repeat(auto-fit"), false);
  assert.equal(hub.includes("xl:grid-cols-3"), true);
  assert.equal(hub.includes("lg:grid-cols-[minmax(0,1fr)_360px]"), true);
  assert.equal(hub.includes("min-[1720px]:grid-cols-[minmax(960px,1fr)_360px]"), false);
  assert.equal(drawer.includes("lg:w-[360px]"), true);
  assert.equal(drawer.includes("border border-zinc-200/80 bg-white"), true);
  assert.equal(hub.includes("GripVertical"), true);
  assert.equal(instructions.includes("must not introduce horizontal scrolling in normal app workflows"), true);
});

test("Calendar stays a task view without horizontal scroll", () => {
  const calendar = readFileSync("src/app/calendar/page.tsx", "utf8");
  const schema = readFileSync("prisma/schema.prisma", "utf8");

  assert.equal(calendar.includes('import { TaskDrawer } from "@/components/tasks/task-drawer";'), true);
  assert.equal(calendar.includes("TaskDrawer"), true);
  assert.equal(calendar.includes("/api/work-items?workspaceId="), true);
  assert.equal(calendar.includes("MobileAgenda"), true);
  assert.equal(calendar.includes("No date"), true);
  assert.equal(calendar.includes("overflow-x-auto"), false);
  assert.equal(calendar.includes("overflow-x-scroll"), false);
  assert.equal(calendar.includes("min-w-[720px]"), false);
  assert.equal(calendar.includes("INITIAL_"), false);
  assert.doesNotMatch(schema, /model\s+(CalendarEvent|Event)\b/);
  assert.doesNotMatch(calendar, /status\s*===\s*["']In Review["'].*block/i);
});
