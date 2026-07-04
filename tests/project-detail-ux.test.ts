import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { members, projects, workItems } from "@/lib/mock-data"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("project detail canonical route renders the shared project detail content", async () => {
  const routePath = "src/app/app/projects/[projectId]/page.tsx"
  const routeSource = await readProjectFile(routePath)

  await access(path.join(root, routePath))
  assert.match(routeSource, /ProjectsPageContent/)
  assert.match(routeSource, /projectId={projectId}/)
})

test("project detail tabs stay under the project route", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const navStart = source.indexOf('aria-label="Project sections"')
  const navEnd = source.indexOf("</nav>", navStart)
  const navSource = source.slice(navStart, navEnd)

  assert.match(source, /const sectionHref = \(section: ProjectSection\)/)
  assert.match(source, /sectionHref\(section\)/)
  assert.doesNotMatch(navSource, /\/app\/tasks/)
  assert.doesNotMatch(navSource, /\/app\/notes/)
  assert.doesNotMatch(navSource, /\/app\/calendar/)
})

test("project index cards use semantic links for Project Detail navigation", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const gridStart = source.indexOf("{projects.map((p) => {")
  const gridEnd = source.indexOf("</Link>", gridStart)
  const cardSource = source.slice(gridStart, gridEnd)

  assert.match(source, /basePath = "\/app"/)
  assert.match(cardSource, /const projectHref = `\$\{basePath\}\/projects\/\$\{encodeURIComponent\(p\.id\)\}`/)
  assert.match(cardSource, /<Link\s+key=\{p\.id\}\s+href=\{projectHref\}/)
  assert.match(cardSource, /onClick=\{\(\) => updateSettings\(\{ activeProjectId: p\.id \}\)\}/)
  assert.doesNotMatch(cardSource, /<button\s+key=\{p\.id\}/)
  assert.doesNotMatch(cardSource, /router\.push\(`\/app\/projects\/\$\{encodeURIComponent\(p\.id\)\}`\)/)
})

test("project overview does not expose the board toggle", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")

  assert.doesNotMatch(source, /boardHref/)
  assert.doesNotMatch(source, /view=board/)
  assert.doesNotMatch(source, />Board</)
  assert.doesNotMatch(source, />List</)
})

test("project detail avoids obvious dashboard panel wrappers", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")

  assert.doesNotMatch(source, /sq-panel/)
})

test("project breadcrumb includes project context and current section", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")

  assert.match(source, /TitleCrumbs/)
  assert.match(source, /items={\["Projects", selectedProject\.name, sectionLabel\]}/)
  assert.match(source, /notes: "Project notes"/)
  assert.doesNotMatch(source, /docs: "Project docs"/)
})

test("project overview is a description and focus view, not the full task registry", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const overviewStart = source.indexOf('selectedSection === "overview"')
  const overviewEnd = source.indexOf('selectedSection === "tasks"', overviewStart)
  const overviewSource = source.slice(overviewStart, overviewEnd)

  assert.match(overviewSource, />Description</)
  assert.match(overviewSource, />Recent notes</)
  assert.doesNotMatch(overviewSource, /Project brief|Recent context/i)
  assert.match(overviewSource, />Focus</)
  assert.match(overviewSource, /focusDeckItems\.map/)
  assert.match(overviewSource, /remainingTasks/)
  assert.match(overviewSource, /blockedItems\.length/)
  assert.match(source, /max-w-6xl overflow-x-hidden px-4 py-6/)
  assert.doesNotMatch(overviewSource, /openPreviewItems\.map/)
  assert.doesNotMatch(overviewSource, /<ProjectTasksSection/)
  assert.doesNotMatch(overviewSource, /<ProjectTaskRow/)
  assert.doesNotMatch(overviewSource, />Open work</)
})

test("project detail keeps Notes as the single project context tab", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const labelsStart = source.indexOf("const PROJECT_SECTION_LABELS")
  const labelsEnd = source.indexOf("} as const;", labelsStart)
  const labelsSource = source.slice(labelsStart, labelsEnd)
  const navStart = source.indexOf('aria-label="Project sections"')
  const navEnd = source.indexOf("</nav>", navStart)
  const navSource = source.slice(navStart, navEnd)

  assert.match(labelsSource, /overview: "Overview"/)
  assert.match(labelsSource, /tasks: "Tasks"/)
  assert.match(labelsSource, /notes: "Notes"/)
  assert.match(labelsSource, /calendar: "Calendar"/)
  assert.doesNotMatch(labelsSource, /docs: "Docs"/)
  assert.doesNotMatch(navSource, />Docs</)
  assert.doesNotMatch(navSource, /section=docs/)
  assert.match(source, /const REMOVED_PROJECT_SECTIONS = new Set\(\["docs"\]\)/)
  assert.match(source, /REMOVED_PROJECT_SECTIONS\.has\(value\)/)
})

test("project overview keeps recent notes local with zinc metadata", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const overviewStart = source.indexOf('selectedSection === "overview"')
  const overviewEnd = source.indexOf('selectedSection === "tasks"', overviewStart)
  const overviewSource = source.slice(overviewStart, overviewEnd)

  assert.match(overviewSource, />Description</)
  assert.match(overviewSource, />Recent notes</)
  assert.match(overviewSource, />View notes</)
  assert.match(overviewSource, /sectionHref\("notes"\)/)
  assert.doesNotMatch(overviewSource, />View docs</)
  assert.doesNotMatch(overviewSource, /sectionHref\("docs"\)/)
  assert.doesNotMatch(overviewSource, /type: "Doc"/)
  assert.doesNotMatch(overviewSource, /No linked notes or docs yet/)
  assert.match(overviewSource, /No project notes yet\./)
  assert.match(overviewSource, /Notes keep decisions and references close to the project\./)
  assert.match(overviewSource, /row\.date/)
  assert.match(overviewSource, /text-\[11px\] text-muted-foreground/)
  assert.doesNotMatch(overviewSource, /text-(blue|indigo)-/)
})

test("project note counts use singular and plural labels without visible doc counts", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")

  assert.match(source, /function formatCount\(count: number, singular: string\)/)
  assert.match(source, /formatCount\(allProjectNotes\.length, "note"\)/)
  assert.doesNotMatch(source, /formatCount\(linkedProjectDocs\.length, "doc"\)/)
  assert.match(source, /note\.projectId === projectId/)
  assert.doesNotMatch(source, /noteIds\.has\(note\.id\)/)
  assert.match(source, /note\{linkedNotes\.length === 1 \? "" : "s"\}/)
})

test("project notes section is the only visible project context editor", async () => {
  const projectSource = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const notesSource = await readProjectFile("src/components/projects/project-notes-section.tsx")
  const docsSource = await readProjectFile("src/components/projects/project-docs-section.tsx")

  const notesStart = projectSource.indexOf('selectedSection === "notes"')
  const notesEnd = projectSource.indexOf('selectedSection === "calendar"', notesStart)
  const notesSectionSource = projectSource.slice(notesStart, notesEnd)

  assert.match(notesSectionSource, /ProjectNotesSection/)
  assert.doesNotMatch(notesSectionSource, /ProjectDocsSection/)
  assert.doesNotMatch(notesSource, /Project Docs/)
  assert.doesNotMatch(projectSource, /selectedSection === "docs"/)
  assert.doesNotMatch(projectSource, /<ProjectDocsSection/)
  assert.doesNotMatch(docsSource, /Project Notes/)
})

test("project note and doc creation use their own APIs", async () => {
  const projectSource = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const notesSource = await readProjectFile("src/components/projects/project-notes-section.tsx")
  const docsSource = await readProjectFile("src/components/projects/project-docs-section.tsx")

  assert.match(notesSource, /apiFetch\("\/api\/notes"/)
  assert.match(notesSource, /projectId/)
  assert.doesNotMatch(notesSource, /\/api\/project-docs/)

  assert.match(docsSource, /apiFetch\("\/api\/project-docs"/)
  assert.match(docsSource, /projectId/)
  assert.doesNotMatch(docsSource, /\/api\/notes/)

  assert.doesNotMatch(projectSource, /ProjectDocsSection/)
  assert.doesNotMatch(projectSource, /from "\.\.\/notes\/page"/)
  assert.doesNotMatch(projectSource, /from "@\/app\/app\/notes\/page"/)
  assert.doesNotMatch(projectSource, /NotesPage/)
})

test("project notes tab shows project-linked notes with useful metadata and clear empty state", async () => {
  const notesSource = await readProjectFile("src/components/projects/project-notes-section.tsx")

  assert.match(notesSource, /notes\.map\(\(note\) =>/)
  assert.match(notesSource, /note\.title/)
  assert.match(notesSource, /note\.excerpt/)
  assert.match(notesSource, /Edited \{note\.updated\}/)
  assert.match(notesSource, />Notes</)
  assert.match(notesSource, /Project context\{projectName \? ` for \$\{projectName\}` : ""\}/)
  assert.match(notesSource, /No project notes yet\./)
  assert.match(notesSource, /Capture decisions, research, meeting notes, and project context here\./)
  assert.match(notesSource, /Saved notes stay linked to this project and also appear on the global Notes page\./)
  assert.doesNotMatch(notesSource, /No notes linked to this project yet\./)
  assert.doesNotMatch(notesSource, /Project Docs|docs-style|runbook/i)
})

test("project notes editor prevents narrow-screen clipped action buttons", async () => {
  const notesSource = await readProjectFile("src/components/projects/project-notes-section.tsx")

  assert.match(notesSource, /grid min-h-\[520px\] min-w-0 grid-cols-1 gap-4/)
  assert.match(notesSource, /min-w-0 rounded-md border bg-card/)
  assert.match(notesSource, /flex flex-wrap items-center justify-between gap-2 border-b/)
  assert.match(notesSource, /lov-btn lov-btn-primary h-8 shrink-0 px-2 text-\[12px\]/)
  assert.match(notesSource, /flex shrink-0 flex-wrap items-center gap-2/)
})

test("project note creation stays linked to the current project", async () => {
  const projectSource = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const notesSource = await readProjectFile("src/components/projects/project-notes-section.tsx")
  const createStart = notesSource.indexOf('mode === "new"')
  const createEnd = notesSource.indexOf(': selectedNote', createStart)
  const createSource = notesSource.slice(createStart, createEnd)

  assert.match(projectSource, /projectId=\{selectedProject\.id\}/)
  assert.match(projectSource, /projectName=\{selectedProject\.name\}/)
  assert.match(createSource, /apiFetch\("\/api\/notes"/)
  assert.match(createSource, /workspaceId,/)
  assert.match(createSource, /projectId,/)
  assert.match(createSource, /title,/)
  assert.match(createSource, /body: draft\.body/)
  assert.match(createSource, /visibility: "PRIVATE"/)
  assert.match(createSource, /tags: \["Note"\]/)
})

test("global Notes preserves project association display", async () => {
  const source = await readProjectFile("src/app/app/notes/page.tsx")

  assert.match(source, /function noteProjectLabel\(note: UiNote, projectById: Map<string, UiProject>\)/)
  assert.match(source, /Project: <span className="font-medium text-foreground">\{noteProjectLabel\(sel, projectById\)\}<\/span>/)
  assert.match(source, /<Chip>\{highlightText\(noteProjectLabel\(n, projectById\), normalizedQuery\)\}<\/Chip>/)
})

test("project overview and tasks rows use flexible title space before metadata", async () => {
  const [projectSource, workItemRowSource] = await Promise.all([
    readProjectFile("src/app/app/projects/projects-page-content.tsx"),
    readProjectFile("src/components/lovable/work-item-row.tsx"),
  ])

  assert.match(projectSource, /FlowRow/)
  assert.match(projectSource, /grid-cols-\[auto_minmax\(0,1fr\)\]/)
  assert.match(projectSource, /md:grid-cols-\[auto_minmax\(0,1fr\)_96px_minmax\(7rem,9rem\)_112px_104px\]/)
  assert.match(projectSource, /TaskCompletionToggle/)
  assert.match(await readProjectFile("src/components/lovable/task-completion-toggle.tsx"), /event\.stopPropagation\(\)/)
  assert.match(workItemRowSource, /sm:grid-cols-\[auto_minmax\(22rem,1fr\)_96px_minmax\(6rem,8rem\)_auto_104px_32px\]/)
  assert.doesNotMatch(workItemRowSource, /flex-\[1_1_18rem\]/)
  assert.doesNotMatch(workItemRowSource, /max-w-(xs|sm|\[[0-9]+px\])/)
  assert.doesNotMatch(workItemRowSource, /grid-cols-\[20px_minmax\(0,1fr\)_minmax\(54px/)
})

test("project detail does not render literal newline artifacts in task row containers", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")

  assert.doesNotMatch(source, /<div className="space-y-1\.5">`r`n/)
  assert.doesNotMatch(source, /<div className="space-y-1\.5">\\r\\n/)
  assert.match(source, /function normalizeTaskRowText/)
  assert.match(source, /normalizeTaskRowText\(item\.title\)/)
})

test("project detail task rows share canonical metadata order", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const rowStart = source.indexOf("function ProjectTaskRow")
  const rowEnd = source.indexOf("function NewProjectModal", rowStart)
  const rowSource = source.slice(rowStart, rowEnd)

  assert.match(rowSource, /md:grid-cols-\[auto_minmax\(0,1fr\)_96px_minmax\(7rem,9rem\)_112px_104px\]/)
  assert.match(rowSource, /TaskCompletionToggle/)
  assert.match(rowSource, /completed \? "text-muted-foreground line-through" : "text-foreground"/)

  const priorityIndex = rowSource.indexOf("<PriorityIndicator")
  const assigneeIndex = rowSource.indexOf("<Avatar")
  const labelIndex = rowSource.indexOf("<Chip>{label}</Chip>")
  const dueIndex = rowSource.indexOf("formatDueDate(item.due)")

  assert.ok(priorityIndex > 0, "priority column missing")
  assert.ok(assigneeIndex > priorityIndex, "assignee must follow priority")
  assert.ok(labelIndex > assigneeIndex, "label chip must follow assignee")
  assert.ok(dueIndex > labelIndex, "due date must follow label chip")
})

test("project tabs are visually and structurally distinct", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const overviewStart = source.indexOf('selectedSection === "overview"')
  const tasksStart = source.indexOf('selectedSection === "tasks"', overviewStart)
  const notesStart = source.indexOf('selectedSection === "notes"', tasksStart)
  const calendarStart = source.indexOf('selectedSection === "calendar"', notesStart)
  const drawerStart = source.indexOf("<TaskDrawer", calendarStart)

  const overviewSource = source.slice(overviewStart, tasksStart)
  const tasksSource = source.slice(tasksStart, notesStart)
  const calendarSource = source.slice(calendarStart, drawerStart)

  assert.match(overviewSource, /grid gap-4 lg:grid-cols-\[minmax\(0,1fr\)_minmax\(18rem,24rem\)\]/)
  assert.match(tasksSource, /ProjectTasksSection/)
  assert.match(source, /taskGroups\.map/)
  assert.match(source, /At risk/)
  assert.match(source, /Active/)
  assert.match(source, /Backlog/)
  assert.match(source, /Completed/)
  assert.match(calendarSource, /Project schedule/)
  assert.match(calendarSource, /scheduleGroups\.map/)
  assert.match(source, /Overdue/)
  assert.match(source, /This week/)
  assert.match(source, /Next week/)
  assert.match(source, /Later/)
  assert.match(source, /Unscheduled/)
  assert.doesNotMatch(calendarSource, /<ProjectTasksSection/)
})

test("project notes tab separates description from linked notes", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const notesStart = source.indexOf('selectedSection === "notes"')
  const calendarStart = source.indexOf('selectedSection === "calendar"', notesStart)
  const notesSource = source.slice(notesStart, calendarStart)

  assert.doesNotMatch(notesSource, /Project brief/)
  assert.match(notesSource, /Project notes/)
  assert.match(notesSource, /Project description/)
  assert.match(notesSource, /Linked notes/)
  assert.match(notesSource, /Description and linked notes\./)
  assert.match(notesSource, /selectedProject\.description/)
  assert.match(notesSource, /contextRows\.slice\(0, 3\)/)
  assert.match(notesSource, /ProjectNotesSection/)
  assert.doesNotMatch(notesSource, />Notes<\/h2>/)
  assert.doesNotMatch(notesSource, /generic note editor|CRUD/i)
})

test("project tasks keep overdue risk neutral at row level", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const rowStart = source.indexOf("function ProjectTaskRow")
  const rowEnd = source.indexOf("function NewProjectModal", rowStart)
  const rowSource = source.slice(rowStart, rowEnd)

  assert.match(rowSource, /AlertTriangle/)
  assert.match(rowSource, /Overdue/)
  assert.match(rowSource, /text-red-600/)
  assert.doesNotMatch(rowSource, /border-red|bg-red/)
})

test("project calendar has a planning rail and task lanes, not event panels", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const calendarStart = source.indexOf('selectedSection === "calendar"')
  const drawerStart = source.indexOf("<TaskDrawer", calendarStart)
  const calendarSource = source.slice(calendarStart, drawerStart)

  assert.match(source, /planningRailItems/)
  assert.match(calendarSource, /Schedule rail/)
  assert.match(calendarSource, /Project schedule/)
  assert.match(calendarSource, /scheduleGroups\.map/)
  assert.match(calendarSource, /laneTone/)
  assert.match(calendarSource, /ProjectTimelineTask/)
  assert.doesNotMatch(calendarSource, /event|Event/)
})

test("project calendar uses Unscheduled consistently", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const calendarStart = source.indexOf('selectedSection === "calendar"')
  const drawerStart = source.indexOf("<TaskDrawer", calendarStart)
  const calendarSource = source.slice(calendarStart, drawerStart)

  assert.match(calendarSource, /Project schedule/)
  assert.match(source, /title: "Unscheduled"/)
  assert.match(source, /Tasks without dates\./)
  assert.match(calendarSource, /aria-label="Schedule rail"/)
  assert.doesNotMatch(calendarSource, /No date \/ Schedule backlog|Schedule backlog/)
})

test("project calendar rail keeps every label visible on mobile", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const calendarStart = source.indexOf('selectedSection === "calendar"')
  const drawerStart = source.indexOf("<TaskDrawer", calendarStart)
  const calendarSource = source.slice(calendarStart, drawerStart)

  assert.match(calendarSource, /grid grid-cols-2/)
  assert.match(calendarSource, /sm:grid-cols-5/)
  assert.match(calendarSource, /last:col-span-2/)
  assert.match(calendarSource, /sm:last:col-span-1/)
  assert.doesNotMatch(calendarSource, /overflow-x-auto/)
})

test("project calendar task rows have bounded item shape and grouped metadata", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")
  const timelineStart = source.indexOf("function ProjectTimelineTask")
  const timelineEnd = source.indexOf("function ProjectTaskRow", timelineStart)
  const timelineSource = source.slice(timelineStart, timelineEnd)

  assert.match(timelineSource, /rounded-md/)
  assert.match(timelineSource, /border-zinc-100\/80/)
  assert.match(timelineSource, /bg-white|bg-zinc-50\/40/)
  assert.match(timelineSource, /hover:bg-zinc-50/)
  assert.match(timelineSource, /min-w-0/)
  assert.match(timelineSource, /truncate/)
  assert.match(timelineSource, /shrink-0/)
  assert.match(timelineSource, /max-w-\[22rem\]/)
  assert.match(timelineSource, /sm:grid-cols-\[5\.5rem_auto_minmax\(0,1fr\)\]/)
  assert.doesNotMatch(timelineSource, /sm:grid-cols-\[5\.5rem_auto_minmax\(0,1fr\)_auto\]/)
})

test("project detail redesign avoids mock wording and heavy product clutter", async () => {
  const source = await readProjectFile("src/app/app/projects/projects-page-content.tsx")

  assert.doesNotMatch(source, /Core Technical Mandate|offline index|local synchronizer|Active Key Objectives/i)
  assert.doesNotMatch(source, /\bAI\b|velocity|sprint report|time tracking|timesheet|team dashboard|\badmin\b|billing/i)
  assert.doesNotMatch(source, /calendarEvents|event system|separate events/i)
})

test("local bootstrap includes a stable realistic project detail fixture", () => {
  const smokeProject = projects.find((project) => project.id === "launch-readiness")
  assert.ok(smokeProject, "missing stable launch readiness project")
  assert.equal(smokeProject.name, "PlanGlade Public Launch")
  assert.equal(smokeProject.status, "Active")

  const smokeTasks = workItems.filter((item) => item.project === smokeProject.id)
  assert.ok(smokeTasks.some((item) => item.status !== "Done"), "fixture project needs an open task")
  assert.ok(smokeTasks.some((item) => item.status === "Done"), "fixture project needs a completed task")

  for (const item of smokeTasks) {
    assert.ok(item.title.length >= 32, `task title too short for alignment fixture: ${item.id}`)
    assert.doesNotMatch(item.title, /`r`n|r`n|\\r|\\n|[\r\n]/)
    assert.ok(item.priority, `missing priority: ${item.id}`)
    assert.ok(item.label, `missing label/type: ${item.id}`)
    assert.ok(item.due, `missing due date: ${item.id}`)
    assert.ok(members.some((member) => member.id === item.assignee), `missing demo assignee: ${item.id}`)
  }
})
