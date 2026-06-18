import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("DESIGN-SPIKE-002 reaches every real page interior without demo claims", () => {
  const pages = [
    "src/components/flowboard-home.tsx",
    "src/app/inbox/page.tsx",
    "src/components/tasks/task-hub.tsx",
    "src/app/projects/page.tsx",
    "src/app/notes/page.tsx",
    "src/app/calendar/page.tsx",
    "src/app/settings/page.tsx",
  ].map(read);
  const source = pages.join("\n");

  for (const page of pages) {
    assert.match(page, /text-\[10px\]|text-\[9px\]/);
    assert.match(page, /border-zinc-200\/80/);
  }

  assert.match(read("src/components/flowboard-home.tsx"), /max-w-5xl/);
  assert.match(read("src/app/inbox/page.tsx"), /Inbox Buffer/);
  assert.match(read("src/components/tasks/task-hub.tsx"), /Work registry/);
  assert.match(read("src/app/projects/page.tsx"), /Project docs/);
  assert.match(read("src/app/calendar/page.tsx"), /Dated work, without a separate events system/);
  assert.doesNotMatch(source, /continuous sync|productivity score|fake ai|time tracking|subscription tier/i);
  assert.doesNotMatch(read("src/app/settings/page.tsx"), />Reset workspace</);
  assert.doesNotMatch(read("src/app/settings/page.tsx"), />Reset to seed</);
});

test("DESIGN-SPIKE-003 keeps the visual pass reviewable", () => {
  const tasks = read("src/components/tasks/task-hub.tsx");
  const calendar = read("src/app/calendar/page.tsx");
  const sonner = read("src/components/ui/sonner.tsx");
  const globals = read("src/app/globals.css");
  const animatedSurfaces = [
    "src/components/flowboard-home.tsx",
    "src/app/inbox/page.tsx",
    "src/components/tasks/task-hub.tsx",
    "src/app/projects/page.tsx",
    "src/app/notes/page.tsx",
    "src/app/calendar/page.tsx",
    "src/app/settings/page.tsx",
  ];

  for (const file of animatedSurfaces) {
    assert.match(read(file), /animate-fade-in/, file);
  }

  assert.match(tasks, /searchParams\.get\("view"\) === "board"/);
  assert.match(tasks, /router\.replace\(query \? `\$\{pathname\}\?\$\{query\}` : pathname, \{ scroll: false \}\)/);
  assert.match(calendar, /selectedDateKey={selectedDateKey}/);
  assert.match(calendar, /title={fullDateLabel\(selectedDateKey\)}/);
  assert.match(sonner, /position="bottom-right"/);
  assert.match(sonner, /animate-slide-up/);
  assert.match(sonner, /before:bg-zinc-950/);
  assert.match(globals, /\.toaster \[data-sonner-toast\]::before/);
});
