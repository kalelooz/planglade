import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (filePath: string) => readFile(path.join(root, filePath), "utf8");

test("page width modes encode the agreed policy", async () => {
  const source = await read("src/components/lovable/page-width.tsx");

  assert.match(source, /standard: "max-w-\[1080px\]"/);
  assert.match(source, /wide: "max-w-\[1320px\]"/);
  assert.match(source, /reading: "max-w-\[900px\]"/);
  assert.match(source, /canvas: "max-w-none"/);
  assert.match(source, /data-page-width=\{mode\}/);
});

test("work surfaces use the standard and wide modes", async () => {
  const [home, inbox, tasks, projects] = await Promise.all([
    read("src/app/app/page.tsx"),
    read("src/app/app/inbox/page.tsx"),
    read("src/app/app/tasks/page.tsx"),
    read("src/app/app/projects/projects-page-content.tsx"),
  ]);

  assert.match(home, /<PageWidth mode="standard"/);
  assert.match(inbox, /<PageWidth mode="standard"/);
  assert.match(tasks, /<PageWidth mode="standard"/);
  assert.match(projects, /<PageWidth mode="wide"/);
});

test("notes and settings retain a reading-width content column", async () => {
  const [notes, settings, demoSettings] = await Promise.all([
    read("src/app/app/notes/page.tsx"),
    read("src/app/app/settings/page.tsx"),
    read("src/app/demo/settings/page.tsx"),
  ]);

  assert.match(notes, /<PageWidth mode="reading"/);
  assert.match(settings, /<PageWidth mode="reading"/);
  assert.match(demoSettings, /<PageWidth as="main" mode="reading"/);
});

test("interactive canvases stay fluid", async () => {
  const [board, calendar, connections, taskMap] = await Promise.all([
    read("src/app/board/board-page-content.tsx"),
    read("src/app/app/calendar/page.tsx"),
    read("src/app/app/connections/page.tsx"),
    read("src/components/tasks/task-map.tsx"),
  ]);

  for (const source of [board, calendar, connections, taskMap]) {
    assert.match(source, /<PageWidth mode="canvas"/);
  }
});

test("width wrappers do not replace task drawer ownership", async () => {
  const pages = await Promise.all([
    read("src/app/app/page.tsx"),
    read("src/app/app/inbox/page.tsx"),
    read("src/app/app/tasks/page.tsx"),
    read("src/app/app/calendar/page.tsx"),
    read("src/app/board/board-page-content.tsx"),
  ]);

  for (const source of pages) {
    assert.ok(source.indexOf("<PageWidth") < source.indexOf("<TaskDrawer"));
  }
});
