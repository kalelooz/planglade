import assert from "node:assert/strict";
import test from "node:test";

import { projects, workItems, notes } from "@/lib/mock-data";
import { selectHomeSections } from "@/lib/home-sections";
import type { WorkItem } from "@/lib/mock-data";

const blockedPublicDemoText = /Untitled task|Olala|INBOX OVERFLOW|smoke|debug|test task|Meow|hello/i;
const demoNow = new Date("2026-06-29T09:30:00.000Z");

function cloneTask(item: WorkItem, patch: Partial<WorkItem> = {}): WorkItem {
  return { ...item, ...patch };
}

test("HOME-DEMO-DATA-POLISH-004: bundled demo data uses public-safe names", () => {
  const visibleNames = [
    ...projects.map((project) => project.name),
    ...projects.map((project) => project.description ?? ""),
    ...workItems.map((item) => item.title),
    ...workItems.map((item) => item.description ?? ""),
    ...notes.map((note) => note.title),
    ...notes.map((note) => note.excerpt),
  ].join("\n");

  assert.doesNotMatch(visibleNames, blockedPublicDemoText);
});

test("HOME-DEMO-DATA-POLISH-004: Home demo state stays calm and useful", () => {
  const publicDemoItems: WorkItem[] = [
    cloneTask(workItems[0], {
      id: "today-readme",
      title: "Review README setup flow",
      status: "In Progress",
      priority: "Medium",
      due: "2026-06-29",
      project: "launch-readiness",
    }),
    cloneTask(workItems[1], {
      id: "next-self-hosting",
      title: "Prepare self-hosting checklist",
      status: "To Do",
      priority: "High",
      due: "2026-06-30",
      project: "launch-readiness",
    }),
    cloneTask(workItems[1], {
      id: "next-announcement",
      title: "Draft launch announcement",
      status: "To Do",
      priority: "Medium",
      due: "2026-07-03",
      project: "launch-readiness",
    }),
    cloneTask(workItems[1], {
      id: "recent-contributor",
      title: "Write first contributor guide",
      status: "Backlog",
      priority: "Low",
      due: "2026-07-08",
      project: "launch-readiness",
    }),
    cloneTask(workItems[2], {
      id: "done-backup",
      title: "Update backup and restore notes clearly",
      status: "Done",
      due: "2026-06-26",
      project: "launch-readiness",
    }),
  ];

  const home = selectHomeSections({
    workItems: publicDemoItems,
    activeProjectId: "launch-readiness",
    now: demoNow,
  });

  assert.equal(home.overdue.length, 0);
  assert.deepEqual(home.today.map((item) => item.title), ["Review README setup flow"]);
  assert.deepEqual(home.upcoming.slice(0, 2).map((item) => item.title), [
    "Prepare self-hosting checklist",
    "Draft launch announcement",
  ]);
  assert.ok(home.upcoming.every((item) => item.due), "Next Up demo items should have due dates");
  assert.doesNotMatch(home.upcoming.map((item) => item.title).join("\n"), blockedPublicDemoText);
});
