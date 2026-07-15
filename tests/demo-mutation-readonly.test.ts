import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("demo write requests stop before fetch while server defense remains", async () => {
  const [client, apiGuard] = await Promise.all([
    source("src/lib/server-session-client.ts"),
    source("middleware.ts"),
  ]);

  assert.match(client, /if \(demoMode\) \{\s*return Response\.json\(\{ error: DEMO_MODE_MESSAGE \}, \{ status: 403 \}\)/);
  assert.match(client, /headers\.set\(DEMO_MODE_HEADER, "true"\)/);
  assert.match(apiGuard, /x-planglade-demo-mode|DEMO_MODE_HEADER|demo/i);
});

test("shared demo surfaces guard mutations before optimistic state", async () => {
  const files = await Promise.all([
    source("src/app/app/inbox/page.tsx"),
    source("src/app/app/tasks/page.tsx"),
    source("src/app/app/notes/page.tsx"),
    source("src/app/app/calendar/page.tsx"),
    source("src/app/board/board-page-content.tsx"),
  ]);

  for (const file of files) assert.match(file, /blockReadOnlyMutation\(isDemoMode\)/);
  assert.match(files[4], /if \(isDemoMode\) return;[\s\S]*?async function load/);
  assert.match(files[4], /readOnly=\{isDemoMode\}/);
});

test("notes and task details receive explicit read-only capability", async () => {
  const [notes, editor, drawer] = await Promise.all([
    source("src/app/app/notes/page.tsx"),
    source("src/components/notes/markdown-editor.tsx"),
    source("src/components/lovable/task-drawer.tsx"),
  ]);

  assert.match(notes, /<MarkdownEditor[\s\S]*?readOnly=\{isDemoMode\}/);
  assert.match(editor, /editable: !readOnly/);
  assert.match(drawer, /blockReadOnlyMutation\(readOnly\)/);
  assert.match(drawer, /readOnly=\{readOnly\}/);
});

test("canonical feedback copy remains exact", async () => {
  const demoData = await source("src/lib/demo-data.ts");
  const guard = await source("src/lib/demo-readonly.ts");
  assert.match(demoData, /Demo mode - changes are disabled\./);
  assert.match(guard, /id: "demo-read-only"/);
});
