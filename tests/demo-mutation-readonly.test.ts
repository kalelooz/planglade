import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path: string) {
  return readFile(path, "utf8");
}

test("demo write requests stop before fetch while server configuration owns the defense", async () => {
  const [client, apiGuard, nextConfig, netlifyConfig] = await Promise.all([
    source("src/lib/server-session-client.ts"),
    source("middleware.ts"),
    source("next.config.ts"),
    source("netlify.toml"),
  ]);

  assert.match(client, /if \(demoMode\) \{[\s\S]*?status: 403[\s\S]*?DEMO_READ_ONLY_HEADER/);
  assert.doesNotMatch(client, /DEMO_MODE_HEADER|x-planglade-demo-mode/);
  assert.match(apiGuard, /process\.env\.PLANGLADE_DEMO_READ_ONLY/);
  assert.match(apiGuard, /process\.env\.PLANGLADE_BUILD_DEMO_READ_ONLY/);
  assert.doesNotMatch(apiGuard, /request\.headers\.get\([^)]*demo/i);
  assert.match(netlifyConfig, /PLANGLADE_NETLIFY_DEMO_READ_ONLY\s*=\s*"true"/);
  assert.match(
    nextConfig,
    /PLANGLADE_BUILD_DEMO_READ_ONLY:[\s\S]*?process\.env\.PLANGLADE_NETLIFY_DEMO_READ_ONLY/,
  );
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
  assert.match(guard, /handleDemoReadOnlyResponse/);
  assert.match(guard, /DEMO_READ_ONLY_HEADER/);
});

test("fallback demo responses cannot become generic mutation failures", async () => {
  const files = await Promise.all([
    source("src/app/app/inbox/page.tsx"),
    source("src/app/app/tasks/page.tsx"),
    source("src/app/board/board-page-content.tsx"),
    source("src/components/lovable/task-drawer.tsx"),
  ]);

  for (const file of files) assert.match(file, /handleDemoReadOnlyResponse\(response\)/);
  assert.match(files[2], /if \(snapshot\) setWorkItems\(snapshot\)/);
  assert.match(files[2], /useSortable\(\{ id: item\.id, disabled: readOnly \}\)/);
});
