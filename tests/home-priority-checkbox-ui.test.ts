import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8");
}

function componentBody(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  assert.ok(start >= 0, `${startNeedle} missing`);
  assert.ok(end > start, `${endNeedle} missing after ${startNeedle}`);
  return source.slice(start, end);
}

test("Home task rows follow the compact preview treatment without changing task mutations", async () => {
  const source = await readProjectFile("src/app/app/page.tsx");
  const row = componentBody(source, "function TaskRow", "function TaskList");

  assert.match(row, /data-home-task-preview-row/);
  assert.match(row, /grid-cols-\[18px_minmax\(0,1fr\)_auto_20px\]/);
  assert.match(row, /data-home-row-title/);
  assert.match(row, /data-home-row-metadata/);
  assert.match(row, /<Flag/);
  assert.match(row, /project \|\| isBlocked/);
  assert.doesNotMatch(row, /TaskCompletionToggle|DependencyBadge|PriorityIndicator/);
  assert.doesNotMatch(row, /absolute|-\s?m[trblxy]?-/);
});

test("Home hierarchy uses capture, attention, upcoming work, projects, inbox, and notes", async () => {
  const source = await readProjectFile("src/app/app/page.tsx");

  for (const label of ["HomeQuickCapture", "What needs your attention", "Coming up this week", "Project focus", 'title="Inbox"', 'title="Recent notes"']) {
    assert.match(source, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.ok(source.indexOf("What needs your attention") < source.indexOf("Coming up this week"));
  assert.ok(source.indexOf("Coming up this week") < source.indexOf("Project focus"));
});

test("Home applies the standard page width directly instead of the legacy dashboard canvas", async () => {
  const source = await readProjectFile("src/app/app/page.tsx");

  assert.match(source, /<PageWidth mode="standard" className="px-3 py-6/);
  assert.match(source, /lg:grid-cols-\[minmax\(0,1fr\)_300px\]/);
  assert.doesNotMatch(source, /app-workspace-canvas/);
});

test("Home is preview-only while the real drawer retains mutation behavior", async () => {
  const home = await readProjectFile("src/app/app/page.tsx");
  const row = componentBody(home, "function TaskRow", "function TaskList");
  const drawer = await readProjectFile("src/components/lovable/task-drawer.tsx");

  assert.doesNotMatch(row, /TaskCompletionToggle/);
  assert.match(row, /onClick=\{onOpen\}/);
  assert.match(home, /<TaskDrawer/);
  assert.match(home, /onItemsReplaced=\{setWorkItems\}/);
  assert.match(drawer, /apiFetch/);
});

test("PriorityIndicator remains safe for list surfaces that use it", async () => {
  const source = await readProjectFile("src/components/lovable/priority-indicator.tsx");

  assert.match(source, /whitespace-nowrap/);
  assert.doesNotMatch(source, /absolute|-\s?m[trblxy]?-/);
});
