import assert from "node:assert/strict"
import test from "node:test"

import { buildWorkspaceImportPlan, remapImportedNoteIds } from "../src/lib/workspace-import-plan"

test("workspace import plan shares relationship warnings and normalized writes", () => {
  const plan = buildWorkspaceImportPlan({
    version: 1,
    generatedAt: "2026-08-23T10:00:00.000Z",
    workspace: { name: "Source", slug: "source" },
    settings: { theme: "dark" },
    data: {
      projects: [{ id: "project-1", name: "Launch Plan", status: "in review", mode: "service desk" }],
      workItems: [{
        id: "task-1",
        title: "Ship",
        status: "to do",
        priority: "urgent",
        project: "missing-project",
        noteIds: ["missing-note"],
      }],
      notes: [],
      projectDocs: [{ id: "doc-1", title: "Runbook", status: "ARCHIVED", project: "missing-project" }],
      savedViews: [{ id: "view-1", name: "Risks", layout: "list", project: "missing-project", isDefault: false }],
    },
  }, {
    projects: ["launch plan"],
    tasks: ["ship"],
    notes: [],
    projectDocs: ["runbook"],
    savedViews: ["risks"],
  })

  assert.deepEqual(plan.relationIssues, {
    tasksMissingProjects: 1,
    projectDocsMissingProjects: 1,
    tasksMissingNotes: 1,
    savedViewsMissingProjects: 1,
  })
  assert.deepEqual(plan.duplicateCandidates, {
    projects: 1,
    tasks: 1,
    notes: 0,
    projectDocs: 1,
    savedViews: 1,
  })
  assert.equal(plan.projects[0]?.slug, "launch-plan")
  assert.equal(plan.projects[0]?.status, "IN_REVIEW")
  assert.equal(plan.projects[0]?.mode, "SERVICE_DESK")
  assert.equal(plan.workItems[0]?.status, "TODO")
  assert.equal(plan.workItems[0]?.priority, "URGENT")
  assert.equal(plan.warnings.some((warning) => warning.code === "work_items_missing_projects"), true)
  assert.equal(plan.warnings.some((warning) => warning.code === "duplicate_tasks"), true)
})

test("workspace import plan reports unsupported export versions without writes", () => {
  const plan = buildWorkspaceImportPlan({
    version: 999,
    data: { projects: [], workItems: [], notes: [], projectDocs: [], savedViews: [] },
  })

  assert.equal(plan.warnings.some((warning) => warning.code === "unsupported_export_version"), true)
  assert.equal(plan.counts.settings, 0)
})

test("workspace import plan reserves non-empty unique project slugs", () => {
  const plan = buildWorkspaceImportPlan({
    data: {
      projects: [
        { id: "project-a", name: "🚀", status: "active" },
        { id: "project-b", name: "Launch Plan", status: "active" },
        { id: "project-c", name: "Launch Plan", status: "active" },
        { id: "project-d", name: `${"a".repeat(49)} b`, status: "active" },
      ],
      workItems: [],
      notes: [],
      projectDocs: [],
      savedViews: [],
    },
  }, {
    projectSlugs: ["project-1", "launch-plan"],
  })

  assert.deepEqual(plan.projects.map((project) => project.slug), [
    "project-1-2",
    "launch-plan-2",
    "launch-plan-3",
    "a".repeat(49),
  ])
  assert.equal(new Set(plan.projects.map((project) => project.slug)).size, 4)
  assert.equal(plan.projects.every((project) => project.slug.length > 0 && project.slug.length <= 50), true)
})

test("workspace import remaps destination note IDs and drops unresolved references", () => {
  const noteMap = new Map([
    ["note-source-1", "note-destination-9"],
    ["note-source-2", "note-destination-10"],
  ])

  assert.deepEqual(
    remapImportedNoteIds(["note-source-2", "missing-note", "note-source-1"], noteMap),
    ["note-destination-10", "note-destination-9"]
  )
  assert.equal(remapImportedNoteIds(undefined, noteMap), undefined)
})
