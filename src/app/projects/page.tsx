"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Activity, Clock3, FileText, Plus, X, FolderPlus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lovable/shell";
import { useStore } from "@/lib/store";
import { type ProjectStatus, type WorkItem } from "@/lib/mock-data";
import { compareLocalDateStrings, formatDueLabel, getDatePart, localDateKey, parseLocalDate } from "@/lib/dates";
import { Avatar, PriorityIcon, StatusIcon } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { WorkItemRow } from "@/components/lovable/work-item-row";
import { ProjectIcon, IconPicker } from "@/components/lovable/project-icon";

const STATUSES: ProjectStatus[] = ["Active", "In Review", "On Hold", "Archived"];
const TASK_TABS = ["All", "Today", "Upcoming", "Overdue", "No date", "Completed"] as const;
type TaskTab = (typeof TASK_TABS)[number];
type TaskScope = "mine" | "team" | "all";
const ME = "AM";

function isInTab(item: WorkItem, tab: TaskTab, today: Date): boolean {
  if (tab === "All") return true;
  const isDone = item.status === "Done";
  if (tab === "Completed") return isDone;
  if (isDone) return false;
  if (tab === "No date") return !item.due;
  if (!item.due) return false;
  const due = parseLocalDate(item.due);
  if (!due || Number.isNaN(due.getTime())) return false;
  const sameDay = localDateKey(due) === localDateKey(today);
  if (tab === "Overdue") return due < today && !sameDay;
  if (tab === "Today") return sameDay;
  if (tab === "Upcoming") return due > today && !sameDay;
  return true;
}

function formatDueDate(due?: string) {
  return due ? formatDueLabel(due) : "—";
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function ProjectsInner() {
  const params = useSearchParams();
  const projects = useStore((s) => s.projects);
  const workItems = useStore((s) => s.workItems);
  const notes = useStore((s) => s.notes);
  const activity = useStore((s) => s.activity);
  const members = useStore((s) => s.members);
  const addProject = useStore((s) => s.addProject);
  const updateProject = useStore((s) => s.updateProject);
  const removeProject = useStore((s) => s.removeProject);
  const addWorkItem = useStore((s) => s.addWorkItem);
  const deleteWorkItem = useStore((s) => s.deleteWorkItem);
  const setWorkItemStatus = useStore((s) => s.setWorkItemStatus);
  const updateSettings = useStore((s) => s.updateSettings);
  const activeProjectId = useStore((s) => s.settings.activeProjectId);
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [iconEditingId, setIconEditingId] = useState<string | null>(null);
  const [taskTab, setTaskTab] = useState<TaskTab>("All");
  const [taskScope, setTaskScope] = useState<TaskScope>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [focusNewTask, setFocusNewTask] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const cols = "grid-cols-[minmax(64px,0.7fr)_minmax(140px,1.7fr)_minmax(96px,1fr)_minmax(100px,1fr)_minmax(72px,0.7fr)_minmax(44px,0.45fr)_minmax(44px,0.45fr)]";
  const today = useMemo(() => startOfLocalDay(now), [now]);
  const todayKey = localDateKey(today);
  const selectedProjectId = params.get("project");
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (selectedProject && selectedProject.id !== activeProjectId) {
      updateSettings({ activeProjectId: selectedProject.id });
    }
  }, [activeProjectId, selectedProject, updateSettings]);

  const projectItems = useMemo(() => {
    if (!selectedProjectId) return [];
    return workItems.filter((workItem) => workItem.project === selectedProjectId);
  }, [selectedProjectId, workItems]);

  const scopedItems = useMemo(() => {
    if (taskScope === "mine") return projectItems.filter((w) => w.assignee === ME);
    if (taskScope === "team") return projectItems.filter((w) => w.assignee !== ME);
    return projectItems;
  }, [projectItems, taskScope]);

  const filteredItems = useMemo(
    () => scopedItems.filter((w) => isInTab(w, taskTab, today)),
    [scopedItems, taskTab, today]
  );

  const scopeCounts = useMemo(
    () => ({
      mine: projectItems.filter((w) => w.assignee === ME && w.status !== "Done").length,
      team: projectItems.filter((w) => w.assignee !== ME && w.status !== "Done").length,
      all: projectItems.filter((w) => w.status !== "Done").length,
    }),
    [projectItems]
  );

  const tabCounts: Record<TaskTab, number> = useMemo(
    () => ({
      All: scopedItems.length,
      Today: scopedItems.filter((w) => isInTab(w, "Today", today)).length,
      Upcoming: scopedItems.filter((w) => isInTab(w, "Upcoming", today)).length,
      Overdue: scopedItems.filter((w) => isInTab(w, "Overdue", today)).length,
      "No date": scopedItems.filter((w) => isInTab(w, "No date", today)).length,
      Completed: scopedItems.filter((w) => isInTab(w, "Completed", today)).length,
    }),
    [scopedItems, today]
  );

  const selectedTask = selectedTaskId ? projectItems.find((workItem) => workItem.id === selectedTaskId) ?? null : null;

  const createAndFocusTask = (status: WorkItem["status"] = "Backlog") => {
    const id = addWorkItem({ title: "Untitled task", status, project: selectedProjectId ?? selectedProject?.id ?? "core" });
    setSelectedTaskId(id);
    setFocusNewTask(true);
    toast.success("Task created");
  };

  if (selectedProject) {
    const owner = members.find((member) => member.id === selectedProject.owner) ?? members[0];
    const items = projectItems;
    const done = items.filter((workItem) => workItem.status === "Done").length;
    const open = items.length - done;
    const overdue = items.filter((workItem) => workItem.status !== "Done" && !!workItem.due && compareLocalDateStrings(workItem.due, todayKey) < 0).length;
    const progress = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
    const projectItemIds = new Set(items.map((item) => item.id));
    const projectNoteIds = new Set(items.flatMap((item) => item.noteIds ?? []));
    const projectNotes = notes
      .filter((note) => projectNoteIds.has(note.id) || [...projectItemIds].some((id) => `${note.title} ${note.excerpt}`.includes(id)))
      .slice(0, 4);
    const projectActivity = activity
      .flatMap((day) => day.items.map((item) => ({ ...item, date: day.date })))
      .filter((item) => {
        const match = item.target.match(/\bFB-\d+\b/);
        return match ? projectItemIds.has(match[0]) : false;
      })
      .slice(0, 5);

    return (
      <AppShell title={<span className="font-medium">Projects / {selectedProject.name}</span>}>
        <div className="flex h-full min-h-0">
          <div className="min-w-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
            <div className="mx-auto w-full max-w-4xl px-6 py-8 lg:px-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <ProjectIcon name={selectedProject.icon} accent={selectedProject.accent} size={18} />
                  <h1 className="truncate text-[22px] font-semibold tracking-tight">{selectedProject.name}</h1>
                </div>
                <p className="text-[13px] text-muted-foreground">Project overview with live work items and progress.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => createAndFocusTask()} className="lov-btn lov-btn-primary">
                  <Plus className="h-3.5 w-3.5" /> New task
                </button>
                <button onClick={() => setEditingProjectId(selectedProject.id)} className="lov-btn lov-btn-ghost">
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                <button
                  onClick={() => {
                    removeProject(selectedProject.id);
                    updateSettings({ activeProjectId: null });
                    router.push("/projects");
                    toast.success("Project deleted");
                  }}
                  className="lov-btn lov-btn-danger"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
                <button onClick={() => router.push("/projects")} className="lov-btn lov-btn-ghost">All projects</button>
              </div>
            </div>

            <section className="border-y py-4">
              <dl className="grid grid-cols-2 gap-y-3 text-[13px] md:grid-cols-4">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</dt>
                  <dd className="mt-1"><Chip tone={selectedProject.status === "Active" ? "accent" : selectedProject.status === "On Hold" ? "warning" : "neutral"}>{selectedProject.status}</Chip></dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Manager</dt>
                  <dd className="mt-1 flex items-center gap-2"><Avatar id={owner.id} name={owner.name} /> {owner.name}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Due</dt>
                  <dd className="mt-1 text-muted-foreground">{selectedProject.due ? new Date(selectedProject.due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Progress</dt>
                  <dd className="mt-1 text-muted-foreground">{progress}% complete</dd>
                </div>
              </dl>
            </section>

            <section className="mt-8 grid gap-4 md:grid-cols-4">
              {[
                ["Open", open],
                ["Done", done],
                ["Overdue", overdue],
                ["Total", items.length],
              ].map(([label, value]) => (
                <div key={label} className="border-t pt-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="mt-1 text-[24px] font-semibold tracking-tight">{value}</div>
                </div>
              ))}
            </section>

            <section className="mt-10 grid gap-8 lg:grid-cols-2">
              <ProjectContextSection title="Project notes" icon={<FileText className="h-3.5 w-3.5" />} href="/notes">
                {projectNotes.length === 0 ? (
                  <div className="px-1 py-5 text-[12px] text-muted-foreground">No notes linked to this project yet.</div>
                ) : (
                  projectNotes.map((note) => (
                    <Link key={note.id} href={`/notes?id=${note.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 py-[var(--fb-row-py)] text-[13px] last:border-b-0 hover:text-foreground">
                      <span className="min-w-0 truncate font-medium">{note.title}</span>
                      <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{note.tag}</span>
                        <span>{note.updated}</span>
                      </span>
                    </Link>
                  ))
                )}
              </ProjectContextSection>

              <ProjectContextSection title="Project activity" icon={<Activity className="h-3.5 w-3.5" />} href={`/activity?project=${selectedProject.id}`}>
                {projectActivity.length === 0 ? (
                  <div className="px-1 py-5 text-[12px] text-muted-foreground">No recent project changes.</div>
                ) : (
                  projectActivity.map((item, index) => {
                    const member = members.find((m) => m.id === item.who) ?? members[0];
                    return (
                      <Link key={`${item.date}-${index}`} href={`/activity?project=${selectedProject.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border/60 py-[var(--fb-row-py)] text-[13px] last:border-b-0 hover:text-foreground">
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{member?.name ?? item.who}</span>{" "}
                          <span className="text-muted-foreground">{item.action}</span>{" "}
                          <span>{item.target}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock3 className="h-3 w-3" />
                          {item.time}
                        </span>
                      </Link>
                    );
                  })
                )}
              </ProjectContextSection>
            </section>

            <section className="mt-10">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-[14px] font-semibold tracking-tight">Tasks</h2>
                <span className="text-[12px] text-muted-foreground">{filteredItems.length} shown</span>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-1 text-[13px]">
                <button
                  onClick={() => setTaskScope("mine")}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium ${taskScope === "mine" ? "bg-[var(--color-hover)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span>Assigned to me</span>
                  <span className="text-[11px] text-muted-foreground">({scopeCounts.mine})</span>
                </button>
                <button
                  onClick={() => setTaskScope("team")}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium ${taskScope === "team" ? "bg-[var(--color-hover)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span>Team</span>
                  <span className="text-[11px] text-muted-foreground">({scopeCounts.team})</span>
                </button>
                <button
                  onClick={() => setTaskScope("all")}
                  className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium ${taskScope === "all" ? "bg-[var(--color-hover)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span>All tasks</span>
                  <span className="text-[11px] text-muted-foreground">({scopeCounts.all})</span>
                </button>
              </div>

              <div className="mb-3 flex flex-wrap items-center gap-1 border-b text-[13px]">
                {TASK_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTaskTab(t)}
                    className={`relative flex items-center gap-1.5 rounded-t px-2.5 py-2 ${taskTab === t ? "bg-transparent text-foreground font-semibold border-b-2 border-foreground -mb-px" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>{t}</span>
                    <span className="text-[11px] text-muted-foreground">{tabCounts[t]}</span>
                  </button>
                ))}
              </div>

              <div className="border-t">
                {items.length === 0 ? (
                  <div className="px-3 py-12 text-center text-[13px] text-muted-foreground">No tasks in this project yet.</div>
                ) : (
                  <>
                    {filteredItems.length === 0 && (
                      <div className="px-3 py-12 text-center text-[13px] text-muted-foreground">No tasks in this view yet.</div>
                    )}
                    {filteredItems.map((workItem) => {
                      return (
                        <WorkItemRow
                          key={workItem.id}
                          item={workItem}
                          selected={selectedTaskId === workItem.id}
                          onClick={() => setSelectedTaskId(workItem.id)}
                          onMove={(nextStatus) => setWorkItemStatus(workItem.id, nextStatus)}
                          onDelete={() => {
                            deleteWorkItem(workItem.id);
                            if (selectedTaskId === workItem.id) setSelectedTaskId(null);
                          }}
                        />
                      );
                    })}
                  </>
                )}
              </div>
            </section>
            </div>
          </div>

          <TaskDrawer
            item={selectedTask}
            focusTitle={focusNewTask}
            onTitleFocused={() => setFocusNewTask(false)}
            onClose={() => {
              setSelectedTaskId(null);
              setFocusNewTask(false);
            }}
          />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={<span className="font-medium">Projects</span>}>
      <div className="h-full overflow-y-scroll [scrollbar-gutter:stable]">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h1 className="text-[20px] font-semibold tracking-tight">Projects</h1>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-muted-foreground">{projects.length} in your workspace</span>
              <button
                onClick={() => setModalOpen(true)}
                className="lov-btn lov-btn-primary"
              >
                <Plus className="h-3.5 w-3.5" /> New project
              </button>
            </div>
          </div>
          <p className="mb-6 text-[13px] text-muted-foreground">Click a project to open its overview.</p>

          {projects.length === 0 ? (
            <EmptyState onCreate={() => setModalOpen(true)} />
          ) : (
            <>
              {/* Column headers */}
              <div className={`grid ${cols} items-center gap-3 border-b border-border px-2 pb-2 pt-1 text-[13px] font-semibold tracking-tight text-foreground`}>
                <span>Status</span>
                <span>Project</span>
                <span>Manager</span>
                <span>Progress</span>
                <span>Due</span>
                <span className="text-right">Tasks</span>
                <span className="text-right">Done</span>
              </div>

              {projects.map((p) => {
                const m = members.find((member) => member.id === p.owner) ?? members[0];
                const items = workItems.filter((w) => w.project === p.id);
                const done = items.filter((w) => w.status === "Done").length;
                const progress = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
                const overdue = !!p.due && p.due < todayKey && p.status !== "Archived";
                return (
                  <div
                    key={p.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => { updateSettings({ activeProjectId: p.id }); router.push(`/projects?project=${p.id}`); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); updateSettings({ activeProjectId: p.id }); router.push(`/projects?project=${p.id}`); } }}
                    className={`grid ${cols} cursor-pointer items-center gap-3 border-b border-border/40 px-2 py-3 text-[13px] hover:bg-[var(--color-hover)]/40 focus:bg-[var(--color-hover)]/40 focus:outline-none`}
                  >
                    <span>
                      <Chip tone={p.status === "Active" ? "accent" : p.status === "On Hold" ? "warning" : "neutral"}>{p.status}</Chip>
                    </span>
                    <span className="relative flex items-center gap-2 font-medium text-foreground">
                      <button
                        type="button"
                        title="Change icon"
                        onClick={(e) => { e.stopPropagation(); setIconEditingId(iconEditingId === p.id ? null : p.id); }}
                        className="lov-icon-btn h-6 w-6"
                      >
                        <ProjectIcon name={p.icon} accent={p.accent} />
                      </button>
                      <span className="whitespace-nowrap">{p.name}</span>
                      {iconEditingId === p.id && (
                        <>
                          <div className="fixed inset-0 z-[70]" onMouseDown={(e) => { e.stopPropagation(); setIconEditingId(null); }} />
                          <div className="absolute left-0 top-8 z-[80] w-[336px]" onClick={(e) => e.stopPropagation()}>
                            <IconPicker
                              value={p.icon ?? "Folder"}
                              accent={p.accent}
                              onChange={(name) => { updateProject(p.id, { icon: name }); setIconEditingId(null); }}
                            />
                          </div>
                        </>
                      )}
                    </span>
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <Avatar id={m.id} name={m.name} /> <span className="truncate">{m.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full transition-all" style={{ width: `${progress}%`, background: p.accent }} />
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{progress}%</span>
                    </span>
                    <span className={overdue ? "font-medium text-red-600" : "text-muted-foreground"}>
                      {p.due ? new Date(`${getDatePart(p.due)}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                    <span className="text-right text-muted-foreground">{items.length}</span>
                    <span className="text-right text-muted-foreground">{done}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {modalOpen && (
        <NewProjectModal
          members={members}
          onClose={() => setModalOpen(false)}
          onCreate={(input) => {
            const id = addProject(input);
            updateSettings({ activeProjectId: id });
            toast.success(`Created project "${input.name}"`);
            setModalOpen(false);
            router.push(`/projects?project=${id}`);
          }}
        />
      )}

      {editingProjectId && selectedProject && (
        <NewProjectModal
          members={members}
          initial={selectedProject}
          title="Edit project"
          submitLabel="Save project"
          onClose={() => setEditingProjectId(null)}
          onCreate={(input) => {
            updateProject(editingProjectId, input);
            toast.success(`Updated project "${input.name}"`);
            setEditingProjectId(null);
          }}
        />
      )}
    </AppShell>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsInner />
    </Suspense>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border/60 bg-card/40 py-16 text-center">
      <FolderPlus className="h-8 w-8 text-muted-foreground/60" />
      <p className="text-[14px] font-medium text-foreground">No projects yet</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">Projects group related work items. Create one to start organizing your tasks.</p>
      <button
        onClick={onCreate}
        className="lov-btn lov-btn-primary mt-1"
      >
        <Plus className="h-3.5 w-3.5" /> New project
      </button>
    </div>
  );
}

function ProjectContextSection({ title, icon, href, children }: { title: string; icon: React.ReactNode; href: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">{icon}{title}</h2>
        <Link href={href} className="text-[12px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">Open</Link>
      </div>
      <div className="border-t border-border/70">{children}</div>
    </section>
  );
}

function NewProjectModal({
  members,
  initial,
  title,
  submitLabel,
  onClose,
  onCreate,
}: {
  members: { id: string; name: string }[];
  initial?: { name: string; status: ProjectStatus; owner: string; due: string; icon?: string };
  title?: string;
  submitLabel?: string;
  onClose: () => void;
  onCreate: (input: { name: string; status: ProjectStatus; owner: string; due: string; icon: string }) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "Folder");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "Active");
  const [owner, setOwner] = useState(initial?.owner ?? members[0]?.id ?? "AM");
  const [due, setDue] = useState(initial?.due ?? "");

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), status, owner, due, icon });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-tight">{title ?? "New project"}</h2>
          <button onClick={onClose} className="lov-icon-btn" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Name">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card">
                <ProjectIcon name={icon} accent="var(--color-primary)" size={16} />
              </span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="e.g. Mobile App v3"
                className="h-9 flex-1 rounded-md border bg-card px-2.5 text-[13px] outline-none focus:border-ring"
              />
            </div>
          </Field>

          <Field label="Icon">
            <IconPicker value={icon} accent="var(--color-primary)" onChange={setIcon} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="h-9 w-full rounded-md border bg-card px-2 text-[13px] outline-none focus:border-ring"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Manager">
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="h-9 w-full rounded-md border bg-card px-2 text-[13px] outline-none focus:border-ring"
              >
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Due (optional)">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-9 w-full rounded-md border bg-card px-2 text-[13px] outline-none focus:border-ring"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="lov-btn lov-btn-ghost">Cancel</button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="lov-btn lov-btn-primary"
          >
            {submitLabel ?? "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
