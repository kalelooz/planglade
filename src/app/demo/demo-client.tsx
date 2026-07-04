"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  FolderKanban,
  Github,
  Inbox,
  ListTodo,
  Plus,
  Search,
  Settings,
  Upload,
  Users,
} from "lucide-react"
import { toast } from "sonner"

import { PlanGladeMark } from "@/components/brand/plan-glade-mark"
import {
  DEMO_MODE_MESSAGE,
  demoNotes,
  demoProjects,
  demoTasks,
  type DemoProject,
  type DemoTask,
} from "@/lib/demo-data"

const tabs = ["Projects", "Tasks", "Notes", "Calendar"] as const
type DemoTab = (typeof tabs)[number]
const filters = ["All", "Open", "Due soon", "Done"] as const
type DemoFilter = (typeof filters)[number]

const statusOrder = ["Backlog", "To Do", "In Progress", "In Review", "Done"]
const githubUrl = "https://github.com/kalelooz/planglade"

function blockedDemoAction() {
  toast(DEMO_MODE_MESSAGE)
}

function formatProjectDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function projectProgress(projectId: string) {
  const tasks = demoTasks.filter((task) => task.projectId === projectId)
  if (tasks.length === 0) return 0
  return Math.round((tasks.filter((task) => task.status === "Done").length / tasks.length) * 100)
}

function taskProject(task: DemoTask) {
  return demoProjects.find((project) => project.id === task.projectId) ?? demoProjects[0]
}

function DemoShell({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: DemoTab
  onTabChange: (tab: DemoTab) => void
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-zinc-50 text-zinc-950">
      <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white md:flex md:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-zinc-200 px-4">
          <PlanGladeMark />
          <span className="font-semibold tracking-tight">PlanGlade</span>
        </div>
        <div className="border-b border-zinc-200 px-4 py-3">
          <p className="text-[12px] font-semibold text-zinc-900">Demo mode</p>
          <p className="mt-1 text-[12px] leading-5 text-zinc-500">Changes are disabled.</p>
        </div>
        <nav className="flex-1 space-y-1 px-2 py-3">
          {tabs.map((tab) => {
            const Icon =
              tab === "Projects"
                ? FolderKanban
                : tab === "Tasks"
                  ? ListTodo
                  : tab === "Notes"
                    ? FileText
                    : CalendarDays
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={`flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[13px] ${
                  activeTab === tab
                    ? "bg-zinc-100 font-medium text-zinc-950"
                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab}</span>
              </button>
            )
          })}
        </nav>
        <div className="border-t border-zinc-200 p-3">
          <button
            type="button"
            onClick={blockedDemoAction}
            className="flex h-8 w-full items-center gap-2 rounded px-2 text-left text-[13px] text-zinc-500 hover:bg-zinc-50"
          >
            <Settings className="h-3.5 w-3.5" />
            Settings
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-14 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white/95 px-4 backdrop-blur">
          <Link href="/" className="mr-2 inline-flex items-center gap-2 md:hidden">
            <PlanGladeMark />
            <span className="font-semibold">PlanGlade</span>
          </Link>
          <div className="flex items-center gap-2 rounded-full border border-zinc-300 bg-zinc-100 px-3 py-1 text-[12px] font-medium text-zinc-800">
            <span className="sr-only">Demo mode — changes are disabled.</span>
            {DEMO_MODE_MESSAGE}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={blockedDemoAction} className="hidden h-8 items-center gap-1.5 rounded border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 sm:inline-flex">
              <Upload className="h-3.5 w-3.5" />
              Upload
            </button>
            <button type="button" onClick={blockedDemoAction} className="hidden h-8 items-center gap-1.5 rounded border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 sm:inline-flex">
              <Users className="h-3.5 w-3.5" />
              Invite
            </button>
            <Link href={githubUrl} target="_blank" className="inline-flex h-8 items-center gap-1.5 rounded border border-zinc-200 bg-white px-3 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50">
              <Github className="h-3.5 w-3.5" />
              GitHub
            </Link>
          </div>
          <div className="flex w-full gap-1 overflow-x-auto pb-2 md:hidden">
            {tabs.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={`h-8 rounded px-3 text-[12px] font-medium ${
                  activeTab === tab ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}

function ProjectsView({
  selectedProjectId,
  onSelectProject,
  onOpenTask,
}: {
  selectedProjectId: string
  onSelectProject: (id: string) => void
  onOpenTask: (id: string) => void
}) {
  const selectedProject = demoProjects.find((project) => project.id === selectedProjectId) ?? demoProjects[0]
  const tasks = demoTasks.filter((task) => task.projectId === selectedProject.id)
  const notes = demoNotes.filter((note) => note.projectId === selectedProject.id)

  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] gap-4 p-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-4 py-3">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">Projects</p>
          <h1 className="mt-1 text-[20px] font-semibold tracking-tight">Sample workspaces</h1>
        </div>
        <div className="divide-y divide-zinc-100">
          {demoProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => onSelectProject(project.id)}
              className={`block w-full px-4 py-3 text-left hover:bg-zinc-50 ${
                selectedProject.id === project.id ? "bg-zinc-100" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${project.accent}`} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{project.name}</span>
                <span className="text-[11px] text-zinc-500">{projectProgress(project.id)}%</span>
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-zinc-500">{project.summary}</p>
            </button>
          ))}
        </div>
      </section>

      <section className="min-w-0 rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-zinc-500">{selectedProject.type} / Due {formatProjectDate(selectedProject.due)}</p>
              <h2 className="mt-1 text-[24px] font-semibold tracking-tight">{selectedProject.name}</h2>
              <p className="mt-2 max-w-2xl text-[14px] leading-6 text-zinc-600">{selectedProject.summary}</p>
            </div>
            <button type="button" onClick={blockedDemoAction} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-[13px] font-semibold text-white hover:bg-zinc-700">
              <Plus className="h-3.5 w-3.5" />
              New task
            </button>
          </div>
        </div>
        <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Tasks</h3>
              <span className="text-[12px] text-zinc-500">{tasks.length}</span>
            </div>
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Notes</h3>
              <span className="text-[12px] text-zinc-500">{notes.length}</span>
            </div>
            <div className="space-y-2">
              {notes.map((note) => (
                <article key={note.id} className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-[13px] font-semibold">{note.title}</p>
                  <p className="mt-1 line-clamp-3 text-[12px] leading-5 text-zinc-600">{note.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function TaskRow({ task, onOpenTask }: { task: DemoTask; onOpenTask: (id: string) => void }) {
  const project = taskProject(task)
  return (
    <button
      type="button"
      onClick={() => onOpenTask(task.id)}
      className="grid w-full gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-left text-[13px] hover:border-zinc-300 hover:bg-zinc-50 md:grid-cols-[minmax(0,1fr)_8rem_7rem_5rem]"
    >
      <span className="min-w-0">
        <span className="block truncate font-medium">{task.title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{project.name}</span>
      </span>
      <span className="text-[12px] text-zinc-600">{task.status}</span>
      <span className="text-[12px] text-zinc-600">{task.priority}</span>
      <span className="text-[12px] text-zinc-500">{formatProjectDate(task.due)}</span>
    </button>
  )
}

function TasksView({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<DemoFilter>("All")
  const filteredTasks = useMemo(() => {
    return demoTasks.filter((task) => {
      if (filter === "Open" && task.status === "Done") return false
      if (filter === "Done" && task.status !== "Done") return false
      if (filter === "Due soon" && task.due > "2026-07-14") return false
      const haystack = `${task.title} ${task.details} ${taskProject(task).name}`.toLowerCase()
      return haystack.includes(query.trim().toLowerCase())
    })
  }, [filter, query])

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3">
        <div className="flex h-9 min-w-64 items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 text-[13px] text-zinc-500">
          <Search className="h-3.5 w-3.5" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-zinc-900 outline-none" placeholder="Search demo tasks" />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {filters.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setFilter(option)}
              className={`h-9 rounded-md px-3 text-[12px] font-medium ${
                filter === option ? "bg-zinc-900 text-white" : "border border-zinc-200 bg-white text-zinc-700"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <button type="button" onClick={blockedDemoAction} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-md bg-zinc-900 px-3 text-[13px] font-semibold text-white hover:bg-zinc-700">
          <Plus className="h-3.5 w-3.5" />
          New task
        </button>
      </div>
      <div className="space-y-5">
        {statusOrder.map((status) => {
          const tasks = filteredTasks.filter((task) => task.status === status)
          return (
            <section key={status}>
              <div className="mb-2 flex items-center gap-2 px-1">
                <h2 className="text-[13px] font-semibold">{status}</h2>
                <span className="text-[12px] text-zinc-500">{tasks.length}</span>
              </div>
              <div className="space-y-2">
                {tasks.length === 0 ? (
                  <div className="rounded-md border border-dashed border-zinc-200 bg-white px-3 py-4 text-[12px] text-zinc-500">No tasks in this group.</div>
                ) : (
                  tasks.map((task) => <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} />)
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function NotesView({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const [selectedNoteId, setSelectedNoteId] = useState(demoNotes[0].id)
  const selected = demoNotes.find((note) => note.id === selectedNoteId) ?? demoNotes[0]
  const linkedTasks = demoTasks.filter((task) => task.noteId === selected.id)
  const project = demoProjects.find((item) => item.id === selected.projectId) ?? demoProjects[0]

  return (
    <div className="grid min-h-[calc(100vh-3.5rem)] gap-4 p-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h1 className="text-[15px] font-semibold">Notes</h1>
          <button type="button" onClick={blockedDemoAction} className="rounded-md border border-zinc-200 px-2 py-1 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50">New</button>
        </div>
        <div className="divide-y divide-zinc-100">
          {demoNotes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => setSelectedNoteId(note.id)}
              className={`block w-full px-4 py-3 text-left hover:bg-zinc-50 ${selected.id === note.id ? "bg-zinc-100" : ""}`}
            >
              <span className="block truncate text-[13px] font-semibold">{note.title}</span>
              <span className="mt-1 line-clamp-2 text-[12px] leading-5 text-zinc-500">{note.body}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 px-5 py-4">
          <p className="text-[12px] text-zinc-500">{project.name} / Edited {selected.updated}</p>
          <h2 className="mt-1 text-[24px] font-semibold tracking-tight">{selected.title}</h2>
        </div>
        <div className="max-w-3xl px-5 py-5">
          <p className="text-[15px] leading-7 text-zinc-700">{selected.body}</p>
          <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">Linked tasks</p>
              <button type="button" onClick={blockedDemoAction} className="text-[12px] font-medium text-zinc-700 hover:text-zinc-950">Extract tasks</button>
            </div>
            <div className="space-y-2">
              {linkedTasks.length === 0 ? (
                <p className="text-[12px] text-zinc-500">No linked tasks for this note.</p>
              ) : (
                linkedTasks.map((task) => <TaskRow key={task.id} task={task} onOpenTask={onOpenTask} />)
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function CalendarView({ onOpenTask }: { onOpenTask: (id: string) => void }) {
  const [cursor, setCursor] = useState(new Date("2026-07-01T00:00:00.000Z"))
  const monthTasks = demoTasks.filter((task) => task.due.startsWith("2026-07"))
  const days = Array.from({ length: 31 }, (_, index) => index + 1)

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-zinc-200 bg-white p-3">
        <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="h-8 rounded border border-zinc-200 px-2 hover:bg-zinc-50" aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-40 text-center text-[14px] font-semibold">
          {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="h-8 rounded border border-zinc-200 px-2 hover:bg-zinc-50" aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </button>
        <button type="button" onClick={blockedDemoAction} className="ml-auto h-8 rounded bg-zinc-900 px-3 text-[12px] font-semibold text-white hover:bg-zinc-700">Add task</button>
      </div>
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-zinc-200 bg-white text-[12px]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="border-b border-r border-zinc-200 bg-zinc-50 px-2 py-2 font-medium text-zinc-500 last:border-r-0">{day}</div>
        ))}
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={`blank-${index}`} className="min-h-28 border-b border-r border-zinc-100 bg-zinc-50/60" />
        ))}
        {days.map((day) => {
          const key = `2026-07-${String(day).padStart(2, "0")}`
          const tasks = monthTasks.filter((task) => task.due === key)
          return (
            <div key={key} className="min-h-28 border-b border-r border-zinc-100 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-medium text-zinc-600">{day}</span>
                {tasks.length > 0 && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">{tasks.length}</span>}
              </div>
              <div className="space-y-1">
                {tasks.slice(0, 2).map((task) => (
                  <button key={task.id} type="button" onClick={() => onOpenTask(task.id)} className="block w-full truncate rounded border border-zinc-200 bg-zinc-50 px-1.5 py-1 text-left text-[11px] hover:bg-zinc-100">
                    {task.title}
                  </button>
                ))}
                {tasks.length > 2 && <span className="text-[10px] text-zinc-500">+{tasks.length - 2} more</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskDrawer({
  taskId,
  onClose,
}: {
  taskId: string | null
  onClose: () => void
}) {
  const task = taskId ? demoTasks.find((item) => item.id === taskId) ?? null : null
  if (!task) return null
  const project = taskProject(task)
  const note = task.noteId ? demoNotes.find((item) => item.id === task.noteId) : null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-950/20" onMouseDown={onClose}>
      <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-zinc-200 bg-white shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-5 py-4">
          <div>
            <p className="text-[12px] text-zinc-500">{project.name}</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-tight">{task.title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded border border-zinc-200 px-2 py-1 text-[12px] hover:bg-zinc-50">Close</button>
        </div>
        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Info label="Status" value={task.status} />
            <Info label="Priority" value={task.priority} />
            <Info label="Due" value={formatProjectDate(task.due)} />
          </div>
          <section>
            <h3 className="text-[13px] font-semibold">Details</h3>
            <p className="mt-2 text-[14px] leading-6 text-zinc-700">{task.details}</p>
          </section>
          {note && (
            <section className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">Linked note</p>
              <h3 className="mt-1 text-[14px] font-semibold">{note.title}</h3>
              <p className="mt-1 text-[13px] leading-6 text-zinc-600">{note.body}</p>
            </section>
          )}
          <section className="rounded-md border border-zinc-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold">Comments</h3>
              <span className="text-[12px] text-zinc-500">Read-only</span>
            </div>
            <p className="text-[13px] leading-6 text-zinc-600">Comments are visible in demo mode, but posting is disabled.</p>
            <button type="button" onClick={blockedDemoAction} className="mt-3 h-8 rounded bg-zinc-900 px-3 text-[12px] font-semibold text-white hover:bg-zinc-700">Add comment</button>
          </section>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={blockedDemoAction} className="h-9 rounded border border-zinc-200 px-3 text-[13px] font-medium hover:bg-zinc-50">Change status</button>
            <button type="button" onClick={blockedDemoAction} className="h-9 rounded border border-zinc-200 px-3 text-[13px] font-medium hover:bg-zinc-50">Edit task</button>
            <button type="button" onClick={blockedDemoAction} className="h-9 rounded border border-red-200 px-3 text-[13px] font-medium text-red-700 hover:bg-red-50">Delete</button>
          </div>
        </div>
      </aside>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 text-[14px] font-semibold">{value}</p>
    </div>
  )
}

export function DemoClient() {
  const [activeTab, setActiveTab] = useState<DemoTab>("Projects")
  const [selectedProjectId, setSelectedProjectId] = useState<DemoProject["id"]>(demoProjects[0].id)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const openTask = (id: string) => setSelectedTaskId(id)

  return (
    <DemoShell activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === "Projects" && (
        <ProjectsView selectedProjectId={selectedProjectId} onSelectProject={setSelectedProjectId} onOpenTask={openTask} />
      )}
      {activeTab === "Tasks" && <TasksView onOpenTask={openTask} />}
      {activeTab === "Notes" && <NotesView onOpenTask={openTask} />}
      {activeTab === "Calendar" && <CalendarView onOpenTask={openTask} />}
      <TaskDrawer taskId={selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2 text-[12px] font-medium text-zinc-700 shadow-lg">
        <Inbox className="h-3.5 w-3.5" />
        Demo mode. Changes are disabled.
      </div>
    </DemoShell>
  )
}
