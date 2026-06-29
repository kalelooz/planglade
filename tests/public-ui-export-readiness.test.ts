import assert from "node:assert/strict"
import { access, readFile, stat } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

import { projects, workItems } from "@/lib/mock-data"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("PUBLIC-UI-AND-EXPORT-READINESS-002: public page labels stay direct", async () => {
  const [home, tasks, project] = await Promise.all([
    readProjectFile("src/app/app/page.tsx"),
    readProjectFile("src/app/app/tasks/page.tsx"),
    readProjectFile("src/app/app/projects/projects-page-content.tsx"),
  ])

  for (const label of ["Today’s tasks", "Overdue tasks", "Inbox", "Projects", "Upcoming tasks", "Recent notes"]) {
    assert.match(home, new RegExp(`title=["']${label}["']`))
  }
  assert.doesNotMatch(home, /Overview Dashboard|Recently Captured|Project Focus|Recent Context/)
  assert.match(tasks, /All tasks in \{project\?\.name \?\? "this workspace"\}\./)
  assert.doesNotMatch(tasks, /Use filters for focus|visual flow/)
  assert.doesNotMatch(project, /Project brief|Recent context|task registry/i)
})

test("PUBLIC-UI-AND-EXPORT-READINESS-002: bundled demo data mixes normal project work with public launch work", () => {
  const visibleDemoText = [
    ...projects.flatMap((project) => [project.name, project.description ?? ""]),
    ...workItems.flatMap((item) => [item.title, item.description ?? ""]),
  ].join("\n")

  assert.doesNotMatch(visibleDemoText, /Untitled task|Olala|smoke|debug|maintainer handoff|repo hygiene|internal workflow|Reddit/i)
  assert.match(visibleDemoText, /Plan the week ahead/)
  assert.match(visibleDemoText, /Collect reference images/)
  assert.match(visibleDemoText, /PlanGlade Public Launch/)
})

test("PUBLIC-UI-AND-EXPORT-READINESS-002: README screenshot references resolve to tracked image files", async () => {
  const readme = await readProjectFile("README.md")
  const refs = [...readme.matchAll(/!\[[^\]]+\]\(\.\/(public\/screenshots\/[^)]+)\)/g)].map((match) => match[1])

  assert.deepEqual(refs, [
    "public/screenshots/planglade-home-desktop.png",
    "public/screenshots/planglade-tasks-desktop.png",
    "public/screenshots/planglade-project-detail-desktop.png",
    "public/screenshots/planglade-calendar-desktop.png",
  ])

  for (const ref of refs) {
    await access(path.join(root, ref))
    const file = await stat(path.join(root, ref))
    assert.ok(file.size > 0, `${ref} should not be empty`)
  }
})
