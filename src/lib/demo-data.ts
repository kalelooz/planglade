export const DEMO_MODE_MESSAGE = "Demo mode - changes are disabled."

export type DemoProject = {
  id: string
  name: string
  type: string
  status: "Active" | "Planning" | "Review"
  due: string
  accent: string
  summary: string
}

export type DemoTask = {
  id: string
  projectId: string
  title: string
  status: "Backlog" | "To Do" | "In Progress" | "In Review" | "Done"
  priority: "High" | "Medium" | "Low"
  due: string
  noteId?: string
  parentId?: string
  details: string
}

export type DemoNote = {
  id: string
  projectId: string | null
  title: string
  updated: string
  body: string
}

const demoUser = {
  id: "demo-user",
  email: "demo@local.invalid",
  name: "Demo User",
}

export const demoSession = {
  user: demoUser,
  workspace: { id: "demo-workspace", slug: "demo", name: "PlanGlade Demo" },
  members: [{ ...demoUser, role: "OWNER" }],
  authMode: "dev-session-scaffold",
}

const demoRelations = [
  {
    id: "demo-relation-release-install",
    sourceId: "release-notes",
    targetId: "release-install-check",
    relationType: "BLOCKED_BY" as const,
  },
  {
    id: "demo-relation-cross-project-docs",
    sourceId: "release-notes",
    targetId: "site-homepage-copy",
    relationType: "RELATES_TO" as const,
  },
]

function dateOffset(now: Date, offset: number) {
  const date = new Date(now)
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + offset)
  return date
}

function dateKey(now: Date, offset: number) {
  const date = dateOffset(now, offset)
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function dateLabel(now: Date, offset: number) {
  return dateOffset(now, offset).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function dateTime(now: Date, offset: number) {
  return `${dateKey(now, offset)}T12:00:00.000Z`
}

export function getDemoFixtures(now = new Date()) {
  const accent = "oklch(0.45 0.08 155)"
  const projects: DemoProject[] = [
    {
      id: "bakery-launch",
      name: "Small bakery launch",
      type: "Local business",
      status: "Active",
      due: dateKey(now, 10),
      accent,
      summary: "Prepare opening week, supplier checks, menu cards, and first customer offers.",
    },
    {
      id: "thesis-plan",
      name: "Student thesis plan",
      type: "Academic",
      status: "Active",
      due: dateKey(now, 22),
      accent,
      summary: "Move from outline to reviewed chapters with supervisor feedback tracked clearly.",
    },
    {
      id: "home-renovation",
      name: "Home renovation",
      type: "Personal",
      status: "Planning",
      due: dateKey(now, 30),
      accent,
      summary: "Sequence room work, contractor visits, material orders, and family decisions.",
    },
    {
      id: "freelance-website",
      name: "Freelance client website",
      type: "Client work",
      status: "Review",
      due: dateKey(now, 16),
      accent,
      summary: "Finalize page copy, review mockups, collect assets, and schedule launch checks.",
    },
    {
      id: "community-event",
      name: "Community event",
      type: "Volunteer",
      status: "Active",
      due: dateKey(now, 26),
      accent,
      summary: "Coordinate venue, volunteers, run sheet, supplies, and day-of communication.",
    },
    {
      id: "open-source-release",
      name: "Open-source release",
      type: "Software",
      status: "Planning",
      due: dateKey(now, 13),
      accent,
      summary: "Triage issues, prepare release notes, test install docs, and tag a stable build.",
    },
  ]

  const tasks: DemoTask[] = [
    {
      id: "bakery-menu-print",
      projectId: "bakery-launch",
      title: "Approve opening menu card",
      status: "In Progress",
      priority: "High",
      due: dateKey(now, -2),
      noteId: "bakery-opening-note",
      details: "Confirm final pastry names, prices, allergens, and print quantity before sending to the local printer.",
    },
    {
      id: "bakery-supplier-call",
      projectId: "bakery-launch",
      title: "Confirm flour and dairy delivery windows",
      status: "To Do",
      priority: "Medium",
      due: dateKey(now, 1),
      details: "Call both suppliers and record backup contacts for opening week.",
      parentId: "bakery-menu-print",
    },
    {
      id: "thesis-literature-review",
      projectId: "thesis-plan",
      title: "Tighten literature review outline",
      status: "In Review",
      priority: "High",
      due: dateKey(now, 3),
      noteId: "thesis-supervisor-note",
      details: "Group sources by argument, not by author, and mark weak sections before the supervisor meeting.",
    },
    {
      id: "thesis-survey-cleanup",
      projectId: "thesis-plan",
      title: "Clean survey response spreadsheet",
      status: "Backlog",
      priority: "Medium",
      due: dateKey(now, 6),
      details: "Remove duplicate rows, normalize empty answers, and keep a copy of the original export.",
    },
    {
      id: "reno-tile-quotes",
      projectId: "home-renovation",
      title: "Compare bathroom tile quotes",
      status: "To Do",
      priority: "Medium",
      due: dateKey(now, 0),
      noteId: "reno-materials-note",
      details: "Compare price, delivery date, and slip rating for the two shortlisted tile options.",
    },
    {
      id: "reno-kitchen-measure",
      projectId: "home-renovation",
      title: "Measure kitchen wall for shelving",
      status: "Done",
      priority: "Low",
      due: dateKey(now, -4),
      details: "Measurements captured and shared with the carpenter.",
    },
    {
      id: "site-homepage-copy",
      projectId: "freelance-website",
      title: "Review homepage copy with client",
      status: "In Progress",
      priority: "High",
      due: dateKey(now, 0),
      noteId: "website-review-note",
      details: "Walk through headline, service blocks, proof points, and contact call-to-action.",
    },
    {
      id: "site-image-check",
      projectId: "freelance-website",
      title: "Collect final brand photos",
      status: "To Do",
      priority: "Medium",
      due: dateKey(now, 2),
      details: "Request final product and team images in web-ready sizes.",
    },
    {
      id: "event-volunteer-roles",
      projectId: "community-event",
      title: "Assign volunteer arrival roles",
      status: "Backlog",
      priority: "High",
      due: dateKey(now, 4),
      noteId: "event-run-sheet-note",
      details: "Assign greeter, setup, refreshments, registration, and cleanup roles.",
    },
    {
      id: "event-supply-list",
      projectId: "community-event",
      title: "Check supplies against attendee count",
      status: "To Do",
      priority: "Medium",
      due: dateKey(now, 8),
      details: "Confirm cups, name tags, signs, extension cords, and backup water.",
    },
    {
      id: "release-notes",
      projectId: "open-source-release",
      title: "Draft release notes",
      status: "In Review",
      priority: "Medium",
      due: dateKey(now, 1),
      noteId: "release-checklist-note",
      details: "Summarize fixes, upgrade notes, and known limitations in plain language.",
    },
    {
      id: "release-install-check",
      projectId: "open-source-release",
      title: "Test fresh install instructions",
      status: "To Do",
      priority: "High",
      due: dateKey(now, 2),
      details: "Run setup from a clean folder and note every missing prerequisite.",
    },
  ]

  const notes: DemoNote[] = [
    {
      id: "weekly-focus-note",
      projectId: null,
      title: "Weekly focus",
      updated: dateLabel(now, -1),
      body: "Keep one clear next step for each active project. Leave the rest in Inbox until it is ready to schedule.",
    },
    {
      id: "bakery-opening-note",
      projectId: "bakery-launch",
      title: "Opening week checklist",
      updated: dateLabel(now, -2),
      body: "Keep menu cards short, make allergen labels visible, and prepare a small thank-you offer for first-week customers.",
    },
    {
      id: "thesis-supervisor-note",
      projectId: "thesis-plan",
      title: "Supervisor feedback",
      updated: dateLabel(now, -3),
      body: "Clarify research question, move two sources into the methods chapter, and add a paragraph explaining the sample size.",
    },
    {
      id: "reno-materials-note",
      projectId: "home-renovation",
      title: "Materials shortlist",
      updated: dateLabel(now, -2),
      body: "Tile option B is cheaper but arrives later. Keep matte finish for floors and use warm white paint in the hallway.",
    },
    {
      id: "website-review-note",
      projectId: "freelance-website",
      title: "Client review agenda",
      updated: dateLabel(now, -1),
      body: "Review homepage message, services order, photo quality, contact form labels, and launch-day redirect plan.",
    },
    {
      id: "event-run-sheet-note",
      projectId: "community-event",
      title: "Event run sheet",
      updated: dateLabel(now, -4),
      body: "Setup starts at 8:30. Registration opens at 9:30. Keep volunteer briefing under ten minutes.",
    },
    {
      id: "release-checklist-note",
      projectId: "open-source-release",
      title: "Release checklist",
      updated: dateLabel(now, -2),
      body: "Confirm install docs, changelog, screenshots, migration note, and tagged build before announcing.",
    },
  ]

  const apiProjects = projects.map((project) => ({
    id: project.id,
    name: project.name,
    status: project.status === "Review" ? "IN_REVIEW" as const : "ACTIVE" as const,
    mode: "STANDARD" as const,
    description: project.summary,
    featureFlags: null,
    dueDate: `${project.due}T00:00:00.000Z`,
    color: project.accent,
    createdById: demoUser.id,
  }))

  const apiTasks = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status === "To Do" ? "TODO" as const : task.status.toUpperCase().replaceAll(" ", "_") as "BACKLOG" | "IN_PROGRESS" | "IN_REVIEW" | "DONE",
    priority: task.priority.toUpperCase() as "HIGH" | "MEDIUM" | "LOW",
    assigneeId: demoUser.id,
    projectId: task.projectId,
    parentId: task.parentId ?? null,
    startDate: null,
    dueDate: `${task.due}T00:00:00.000Z`,
    description: task.details,
    labels: [],
    noteIds: task.noteId ? [task.noteId] : [],
    checklist: [],
    createdAt: dateTime(now, -7),
    updatedAt: dateTime(now, -1),
  }))

  const apiNotes = notes.map((note, index) => ({
    ...note,
    tags: [],
    createdAt: dateTime(now, -7 - index),
    updatedAt: dateTime(now, -1 - index),
  }))

  return {
    projects,
    tasks,
    notes,
    apiProjects,
    apiTasks,
    apiNotes,
    demoRelations,
    counts: {
      inboxCount: apiTasks.filter((task) => task.status === "BACKLOG").length,
      todayCount: tasks.filter((task) => task.due === dateKey(now, 0) && task.status !== "Done").length,
      myTasksCount: tasks.filter((task) => task.status !== "Done").length,
    },
  }
}

const initialFixtures = getDemoFixtures()
export const demoProjects = initialFixtures.projects
export const demoTasks = initialFixtures.tasks
export const demoNotes = initialFixtures.notes

export function getDemoApiResponse(input: RequestInfo | URL): Response | null {
  const value = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  const url = new URL(value, "http://demo.local")
  const path = url.pathname
  const fixtures = getDemoFixtures()

  if (path === "/api/projects") return Response.json({ projects: fixtures.apiProjects })
  if (path === "/api/work-items/counts") return Response.json(fixtures.counts)
  if (/^\/api\/work-items\/[^/]+\/comments$/.test(path)) return Response.json({ comments: [] })
  if (/^\/api\/work-items\/[^/]+\/history$/.test(path)) return Response.json({ events: [] })
  if (path === "/api/work-items") return Response.json({ workItems: fixtures.apiTasks })
  if (path === "/api/work-item-relations") return Response.json({ relations: fixtures.demoRelations })
  if (path === "/api/notes") return Response.json({ notes: fixtures.apiNotes })
  if (path === "/api/labels") return Response.json({ labels: [] })
  if (path === "/api/notifications") return Response.json({ notifications: [], unreadCount: 0 })
  if (path === "/api/attachments") return Response.json({ attachments: [] })
  if (path === "/api/activity") return Response.json({ events: [] })
  return null
}
