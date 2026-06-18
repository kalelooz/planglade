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
