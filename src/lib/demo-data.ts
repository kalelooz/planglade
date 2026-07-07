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
  details: string
}

export type DemoNote = {
  id: string
  projectId: string
  title: string
  updated: string
  body: string
}

export const demoProjects: DemoProject[] = [
  {
    id: "bakery-launch",
    name: "Small bakery launch",
    type: "Local business",
    status: "Active",
    due: "2026-07-18",
    accent: "bg-amber-500",
    summary: "Prepare opening week, supplier checks, menu cards, and first customer offers.",
  },
  {
    id: "thesis-plan",
    name: "Student thesis plan",
    type: "Academic",
    status: "Active",
    due: "2026-08-05",
    accent: "bg-blue-500",
    summary: "Move from outline to reviewed chapters with supervisor feedback tracked clearly.",
  },
  {
    id: "home-renovation",
    name: "Home renovation",
    type: "Personal",
    status: "Planning",
    due: "2026-08-22",
    accent: "bg-emerald-500",
    summary: "Sequence room work, contractor visits, material orders, and family decisions.",
  },
  {
    id: "freelance-website",
    name: "Freelance client website",
    type: "Client work",
    status: "Review",
    due: "2026-07-29",
    accent: "bg-violet-500",
    summary: "Finalize page copy, review mockups, collect assets, and schedule launch checks.",
  },
  {
    id: "community-event",
    name: "Community event",
    type: "Volunteer",
    status: "Active",
    due: "2026-08-12",
    accent: "bg-rose-500",
    summary: "Coordinate venue, volunteers, run sheet, supplies, and day-of communication.",
  },
  {
    id: "open-source-release",
    name: "Open-source release",
    type: "Software",
    status: "Planning",
    due: "2026-07-25",
    accent: "bg-slate-500",
    summary: "Triage issues, prepare release notes, test install docs, and tag a stable build.",
  },
]

export const demoTasks: DemoTask[] = [
  {
    id: "bakery-menu-print",
    projectId: "bakery-launch",
    title: "Approve opening menu card",
    status: "In Progress",
    priority: "High",
    due: "2026-07-08",
    noteId: "bakery-opening-note",
    details: "Confirm final pastry names, prices, allergens, and print quantity before sending to the local printer.",
  },
  {
    id: "bakery-supplier-call",
    projectId: "bakery-launch",
    title: "Confirm flour and dairy delivery windows",
    status: "To Do",
    priority: "Medium",
    due: "2026-07-10",
    details: "Call both suppliers and record backup contacts for opening week.",
  },
  {
    id: "thesis-literature-review",
    projectId: "thesis-plan",
    title: "Tighten literature review outline",
    status: "In Review",
    priority: "High",
    due: "2026-07-12",
    noteId: "thesis-supervisor-note",
    details: "Group sources by argument, not by author, and mark weak sections before the supervisor meeting.",
  },
  {
    id: "thesis-survey-cleanup",
    projectId: "thesis-plan",
    title: "Clean survey response spreadsheet",
    status: "Backlog",
    priority: "Medium",
    due: "2026-07-16",
    details: "Remove duplicate rows, normalize empty answers, and keep a copy of the original export.",
  },
  {
    id: "reno-tile-quotes",
    projectId: "home-renovation",
    title: "Compare bathroom tile quotes",
    status: "To Do",
    priority: "Medium",
    due: "2026-07-14",
    noteId: "reno-materials-note",
    details: "Compare price, delivery date, and slip rating for the two shortlisted tile options.",
  },
  {
    id: "reno-kitchen-measure",
    projectId: "home-renovation",
    title: "Measure kitchen wall for shelving",
    status: "Done",
    priority: "Low",
    due: "2026-07-04",
    details: "Measurements captured and shared with the carpenter.",
  },
  {
    id: "site-homepage-copy",
    projectId: "freelance-website",
    title: "Review homepage copy with client",
    status: "In Progress",
    priority: "High",
    due: "2026-07-09",
    noteId: "website-review-note",
    details: "Walk through headline, service blocks, proof points, and contact call-to-action.",
  },
  {
    id: "site-image-check",
    projectId: "freelance-website",
    title: "Collect final brand photos",
    status: "To Do",
    priority: "Medium",
    due: "2026-07-11",
    details: "Request final product and team images in web-ready sizes.",
  },
  {
    id: "event-volunteer-roles",
    projectId: "community-event",
    title: "Assign volunteer arrival roles",
    status: "Backlog",
    priority: "High",
    due: "2026-07-17",
    noteId: "event-run-sheet-note",
    details: "Assign greeter, setup, refreshments, registration, and cleanup roles.",
  },
  {
    id: "event-supply-list",
    projectId: "community-event",
    title: "Check supplies against attendee count",
    status: "To Do",
    priority: "Medium",
    due: "2026-07-19",
    details: "Confirm cups, name tags, signs, extension cords, and backup water.",
  },
  {
    id: "release-notes",
    projectId: "open-source-release",
    title: "Draft release notes",
    status: "In Review",
    priority: "Medium",
    due: "2026-07-13",
    noteId: "release-checklist-note",
    details: "Summarize fixes, upgrade notes, and known limitations in plain language.",
  },
  {
    id: "release-install-check",
    projectId: "open-source-release",
    title: "Test fresh install instructions",
    status: "To Do",
    priority: "High",
    due: "2026-07-15",
    details: "Run setup from a clean folder and note every missing prerequisite.",
  },
]

export const demoNotes: DemoNote[] = [
  {
    id: "bakery-opening-note",
    projectId: "bakery-launch",
    title: "Opening week checklist",
    updated: "Jul 4",
    body: "Keep menu cards short, make allergen labels visible, and prepare a small thank-you offer for first-week customers.",
  },
  {
    id: "thesis-supervisor-note",
    projectId: "thesis-plan",
    title: "Supervisor feedback",
    updated: "Jul 3",
    body: "Clarify research question, move two sources into the methods chapter, and add a paragraph explaining the sample size.",
  },
  {
    id: "reno-materials-note",
    projectId: "home-renovation",
    title: "Materials shortlist",
    updated: "Jul 2",
    body: "Tile option B is cheaper but arrives later. Keep matte finish for floors and use warm white paint in the hallway.",
  },
  {
    id: "website-review-note",
    projectId: "freelance-website",
    title: "Client review agenda",
    updated: "Jul 4",
    body: "Review homepage message, services order, photo quality, contact form labels, and launch-day redirect plan.",
  },
  {
    id: "event-run-sheet-note",
    projectId: "community-event",
    title: "Event run sheet",
    updated: "Jul 1",
    body: "Setup starts at 8:30. Registration opens at 9:30. Keep volunteer briefing under ten minutes.",
  },
  {
    id: "release-checklist-note",
    projectId: "open-source-release",
    title: "Release checklist",
    updated: "Jul 4",
    body: "Confirm install docs, changelog, screenshots, migration note, and tagged build before announcing.",
  },
]

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

const apiProjects = demoProjects.map((project) => ({
  id: project.id,
  name: project.name,
  status: project.status === "Review" ? "IN_REVIEW" : "ACTIVE",
  mode: "STANDARD",
  description: project.summary,
  featureFlags: null,
  dueDate: `${project.due}T00:00:00.000Z`,
  color: project.accent,
  createdById: demoUser.id,
}))

const apiTasks = demoTasks.map((task) => ({
  id: task.id,
  title: task.title,
  status: task.status === "To Do" ? "TODO" : task.status.toUpperCase().replaceAll(" ", "_"),
  priority: task.priority.toUpperCase(),
  assigneeId: demoUser.id,
  projectId: task.projectId,
  parentId: null,
  startDate: null,
  dueDate: `${task.due}T00:00:00.000Z`,
  description: task.details,
  labels: [],
  noteIds: task.noteId ? [task.noteId] : [],
  checklist: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-04T00:00:00.000Z",
}))

const apiNotes = demoNotes.map((note) => ({
  ...note,
  tags: [],
  createdAt: "2026-07-01T00:00:00.000Z",
  updatedAt: "2026-07-04T00:00:00.000Z",
}))

export function getDemoApiResponse(input: RequestInfo | URL): Response | null {
  const value = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
  const url = new URL(value, "http://demo.local")
  const path = url.pathname

  if (path === "/api/projects") return Response.json({ projects: apiProjects })
  if (path === "/api/work-items/counts") {
    return Response.json({
      inboxCount: apiTasks.filter((task) => task.status === "BACKLOG").length,
      todayCount: apiTasks.filter((task) => task.dueDate.startsWith("2026-07-04") && task.status !== "DONE").length,
      myTasksCount: apiTasks.filter((task) => task.status !== "DONE").length,
    })
  }
  if (/^\/api\/work-items\/[^/]+\/comments$/.test(path)) return Response.json({ comments: [] })
  if (/^\/api\/work-items\/[^/]+\/history$/.test(path)) return Response.json({ events: [] })
  if (path === "/api/work-items") return Response.json({ workItems: apiTasks })
  if (path === "/api/work-item-relations") return Response.json({ relations: [] })
  if (path === "/api/notes") return Response.json({ notes: apiNotes })
  if (path === "/api/labels") return Response.json({ labels: [] })
  if (path === "/api/notifications") return Response.json({ notifications: [], unreadCount: 0 })
  if (path === "/api/attachments") return Response.json({ attachments: [] })
  if (path === "/api/activity") return Response.json({ events: [] })
  return null
}
