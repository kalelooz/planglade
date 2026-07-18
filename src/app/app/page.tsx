"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, CircleSlash, FileText, Flag, Folder, Inbox } from "lucide-react";

import { AppShell } from "@/components/lovable/shell";
import { PageWidth } from "@/components/lovable/page-width";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { useStore } from "@/lib/store";
import { type Project, type WorkItem } from "@/lib/mock-data";
import { compareLocalDateStrings, formatDueLabel, getDatePart, localDateKey } from "@/lib/dates";
import { selectHomeSections } from "@/lib/home-sections";
import { apiFetch, getServerSession } from "@/lib/server-session-client";
import {
  type ApiNote,
  type ApiProject,
  type ApiWorkItem,
  toUiProject,
  toUiNotePreview,
  toUiWorkItem,
} from "@/lib/server-ui-mappers";
import { applyWorkItemDependencyRelations, type WorkItemDependencyRelation } from "@/lib/work-item-dependencies";
import { getDemoFixtures } from "@/lib/demo-data";

function projectHref(projectId: string, basePath: "/app" | "/demo", section?: "notes") {
  const base = `${basePath}/projects/${encodeURIComponent(projectId)}`;
  return section ? `${base}?section=${section}` : base;
}

function SectionHeader({
  title,
  count,
  action,
  icon,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <h2 className="truncate text-[13px] font-semibold tracking-tight text-foreground/90">{title}</h2>
        {typeof count === "number" ? <span className="text-xs tabular-nums text-muted-foreground">{count}</span> : null}
      </div>
      {action}
    </div>
  );
}

function EmptyRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flow-empty flow-empty-inline">
      <p className="text-xs font-medium text-foreground">{title}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{children}</p>
    </div>
  );
}

function homeTaskTitle(item: WorkItem) {
  const title = item.title.trim();
  if (title && title.toLowerCase() !== "no title") return title;
  const description = item.description?.trim();
  return description || "New task";
}

function TaskRow({
  item,
  selected,
  onOpen,
  projects,
}: {
  item: WorkItem;
  selected: boolean;
  onOpen: () => void;
  projects: Project[];
}) {
  const completed = item.status === "Done";
  const displayTitle = homeTaskTitle(item);
  const project = item.project ? projects.find((candidate) => candidate.id === item.project) ?? null : null;
  const dueLabel = item.due ? formatDueLabel(item.due) : null;
  const isBlocked = (item.blockerIds?.length ?? 0) > 0;
  const priorityTone = item.priority === "High" ? "text-red-600" : item.priority === "Medium" ? "text-amber-600" : "text-sky-600";

  return (
    <button
      type="button"
      onClick={onOpen}
      title={displayTitle}
      data-home-task-preview-row
      className={`group grid w-full min-w-0 grid-cols-[18px_minmax(0,1fr)_auto_20px] items-start gap-x-3 px-2.5 py-2 text-left transition-colors hover:bg-[var(--color-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        selected ? "bg-accent/80" : ""
      }`}
    >
      <span aria-hidden="true" className={`mt-0.5 h-[18px] w-[18px] shrink-0 rounded-full border-[1.5px] ${completed ? "border-emerald-600 bg-emerald-600" : isBlocked ? "border-red-400/60" : "border-muted-foreground/40"}`} />
      <span data-home-row-title className="min-w-0">
        <span className={`block min-w-0 truncate text-[13.5px] font-medium leading-5 ${completed ? "text-muted-foreground line-through font-normal" : "text-foreground"}`}>{displayTitle}</span>
        {(project || isBlocked) ? <span className="mt-0.5 flex min-w-0 items-center gap-2 text-[11px] leading-4 text-muted-foreground">
          {project ? <span className="min-w-0 truncate">{project.name}</span> : null}
          {isBlocked ? <span className="inline-flex shrink-0 items-center gap-1 text-red-600"><CircleSlash className="h-3 w-3" />Blocked</span> : null}
        </span> : null}
      </span>
      <span data-home-row-metadata className={`pt-0.5 text-xs whitespace-nowrap ${dueLabel?.includes("ago") || dueLabel === "Yesterday" ? "font-medium text-red-600" : "text-muted-foreground"}`}>
        {dueLabel ? <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3 opacity-70" />{dueLabel}</span> : null}
      </span>
      <Flag aria-label={`${item.priority} priority`} className={`mt-0.5 h-3.5 w-3.5 ${priorityTone} ${item.priority === "High" ? "fill-current" : ""}`} />
    </button>
  );
}

function TaskList({
  items,
  selectedTaskId,
  onOpen,
  projects,
  empty,
}: {
  items: WorkItem[];
  selectedTaskId: string | null;
  onOpen: (id: string) => void;
  projects: Project[];
  empty: ReactNode;
}) {
  if (items.length === 0) return <>{empty}</>;

  return (
    <div className="divide-y divide-border/60 border-y border-border/60">
      {items.map((item) => (
        <TaskRow
          key={item.id}
          item={item}
          selected={selectedTaskId === item.id}
          onOpen={() => onOpen(item.id)}
          projects={projects}
        />
      ))}
    </div>
  );
}

function ContextRow({ href, title, kind, meta }: { href: string; title: string; kind: string; meta: string }) {
  return (
    <Link
      href={href}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-2.5 text-xs transition-colors hover:bg-[var(--color-hover)]"
    >
      <span className="min-w-0 truncate font-medium text-foreground">{title}</span>
      <span className="font-mono text-[10px] text-muted-foreground/75">{kind}</span>
      <span className="font-mono text-[10px] text-muted-foreground">{meta}</span>
    </Link>
  );
}

function HomeQuickCapture({ disabled }: { disabled: boolean }) {
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = title.trim();
    if (!value || disabled || submitting) return;

    setSubmitting(true);
    window.dispatchEvent(new CustomEvent("planglade:quick-capture", {
      detail: {
        title: value,
        onComplete: (created: boolean) => {
          if (created) setTitle("");
          setSubmitting(false);
        },
      },
    }));
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <span aria-hidden="true" className="h-4 w-4 rounded-full border border-muted-foreground/40" />
      <label className="sr-only" htmlFor="home-quick-capture">Capture a task</label>
      <input id="home-quick-capture" value={title} onChange={(event) => setTitle(event.target.value)} disabled={disabled || submitting} placeholder={disabled ? "Quick capture is unavailable in the demo" : "Capture a task..."} className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed" />
      <button type="submit" disabled={!title.trim() || disabled || submitting} className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Adding" : "Add"}</button>
    </form>
  );
}

export default function HomePage({ basePath = "/app" }: { basePath?: "/app" | "/demo" }) {
  const storedActiveProjectId = useStore((state) => state.settings.activeProjectId);
  const updateSettings = useStore((state) => state.updateSettings);
  const isDemoMode = basePath === "/demo";
  const demoData = isDemoMode ? getDemoFixtures() : null;
  const activeProjectId = isDemoMode && !demoData?.apiProjects.some((project) => project.id === storedActiveProjectId)
    ? null
    : storedActiveProjectId;

  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(demoData?.projects ? "demo-workspace" : null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(demoData ? "demo-user" : null);
  const [workItems, setWorkItems] = useState<WorkItem[]>(() => demoData
    ? applyWorkItemDependencyRelations(demoData.apiTasks.map((item) => toUiWorkItem(item, "demo-user")), demoData.demoRelations)
    : []);
  const [projects, setProjects] = useState<Project[]>(() => demoData
    ? demoData.apiProjects.map((project) => toUiProject(project, "demo-user"))
    : []);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>(() => demoData
    ? [{ id: "demo-user", name: "Demo User" }]
    : [{ id: "unassigned", name: "Unassigned" }]);
  const [recentNotes, setRecentNotes] = useState<Array<{ id: string; title: string; tag: string; updated: string; excerpt: string; projectId: string | null }>>(() => demoData
    ? demoData.apiNotes.map((note) => ({ ...toUiNotePreview(note), projectId: note.projectId ?? null })).slice(0, 5)
    : []);
  const [hasMoreRecentNotes, setHasMoreRecentNotes] = useState(() => (demoData?.apiNotes.length ?? 0) > 5);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const currentMemberName = currentUserId ? members.find((member) => member.id === currentUserId)?.name : null;
  const firstName = currentMemberName && !currentMemberName.includes("@") ? currentMemberName.split(" ")[0] || "there" : "there";
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (isDemoMode) return;
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const session = await getServerSession();
        if (!active) return;

        setWorkspaceId(session.workspace.id);
        if (session.workspace.taskPriorityDisplayStyle) {
          updateSettings({ priorityDisplayStyle: session.workspace.taskPriorityDisplayStyle });
        }
        setCurrentUserId(session.user.id);
        if (session.members?.length) {
          setMembers(session.members.map((member) => ({ id: member.id, name: member.name })));
        } else {
          setMembers([{ id: session.user.id, name: session.user.name ?? session.user.email }]);
        }

        const [itemsRes, notesRes, projectsRes, relationsRes] = await Promise.all([
          apiFetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/notes?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/work-item-relations?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);

        if (!itemsRes.ok) throw new Error("Failed to load Home tasks");
        if (!notesRes.ok) throw new Error("Failed to load Home notes");
        if (!projectsRes.ok) throw new Error("Failed to load Home projects");
        if (!relationsRes.ok) throw new Error("Failed to load task dependencies");

        const itemsPayload = (await itemsRes.json()) as { workItems: ApiWorkItem[] };
        const notesPayload = (await notesRes.json()) as { notes: ApiNote[] };
        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const relationsPayload = (await relationsRes.json()) as { relations: WorkItemDependencyRelation[] };
        if (!active) return;

        const mappedItems = itemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id));
        setWorkItems(applyWorkItemDependencyRelations(mappedItems, relationsPayload.relations));
        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        const notePreviews = notesPayload.notes.map((note) => ({ ...toUiNotePreview(note), projectId: note.projectId ?? null }));
        setRecentNotes(notePreviews.slice(0, 5));
        setHasMoreRecentNotes(notePreviews.length > 5);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load Home");
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [isDemoMode, updateSettings]);

  const buckets = useMemo(
    () => selectHomeSections({ workItems, activeProjectId, now }),
    [workItems, activeProjectId, now]
  );
  const inboxBucket = buckets.inbox;
  const inboxCount = inboxBucket.length;
  const taskHref = (filter?: "today" | "overdue") => {
    const params = new URLSearchParams();
    if (filter) params.set("filter", filter);
    if (activeProjectId) params.set("project", activeProjectId);
    const query = params.toString();
    return query ? `${basePath}/tasks?${query}` : `${basePath}/tasks`;
  };

  const projectMetrics = useMemo(() => {
    const todayKey = localDateKey(now);
    return projects
      .filter((project) => project.status !== "Archived")
      .map((project) => {
        const items = workItems.filter((item) => item.project === project.id);
        const openItems = items.filter((item) => item.status !== "Done");
        const doneItems = items.filter((item) => item.status === "Done");
        const overdue = openItems.filter((item) => {
          const due = getDatePart(item.due);
          return due && compareLocalDateStrings(due, todayKey) < 0;
        });
        const next = openItems
          .filter((item) => !!getDatePart(item.due))
          .sort((a, b) => compareLocalDateStrings(a.due, b.due))[0];
        const progress = items.length > 0 ? Math.round((doneItems.length / items.length) * 100) : project.progress;
        return { project, openCount: openItems.length, overdueCount: overdue.length, next, progress };
      })
      .sort((a, b) => {
        if (a.project.id === activeProjectId) return -1;
        if (b.project.id === activeProjectId) return 1;
        return b.overdueCount - a.overdueCount || b.openCount - a.openCount || a.project.name.localeCompare(b.project.name);
      })
      .slice(0, 4);
  }, [activeProjectId, now, projects, workItems]);

  const recentContext = useMemo(() => {
    const noteRows = recentNotes.map((note) => ({
      id: `note-${note.id}`,
      href: note.projectId ? projectHref(note.projectId, basePath, "notes") : `${basePath}/notes?id=${note.id}`,
      title: note.title,
      kind: note.tag,
      meta: note.updated,
    }));
    return noteRows.slice(0, 6);
  }, [recentNotes]);

  const selectedTask = selectedTaskId ? workItems.find((item) => item.id === selectedTaskId) ?? null : null;
  const previewLimit = 5;
  const overduePreview = buckets.overdue.slice(0, previewLimit);
  const todayPreview = buckets.today.slice(0, previewLimit);
  const inboxPreview = inboxBucket.slice(0, previewLimit);
  const upcomingPreview = buckets.upcoming.slice(0, previewLimit);

  return (
    <AppShell title={<span className="font-medium">Home</span>}>
      <div className="flex h-full">
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
          <PageWidth mode="standard" className="px-3 py-6 sm:px-5 sm:py-8 lg:px-6 xl:px-8">
            <div className="space-y-8">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10.5px] text-red-700">{error}</div>}

              <header>
                <div className="flex items-end justify-between gap-4">
                  <div className="min-w-0">
                    <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{greeting}, {firstName}</h1>
                    <p className="mt-1 text-[12px] text-muted-foreground">{todayLabel}</p>
                  </div>
                  {loading ? <span className="text-xs text-muted-foreground">Loading workspace…</span> : null}
                </div>
                <div className="mt-5"><HomeQuickCapture disabled={isDemoMode} /></div>
              </header>

              <main className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="min-w-0 space-y-8">
                  <section>
                    <SectionHeader
                      title="What needs your attention"
                      count={buckets.overdue.length + buckets.today.length}
                      action={<Link href={taskHref("today")} className="text-xs text-muted-foreground hover:text-foreground">View tasks</Link>}
                    />
                    <div className="border-t border-border">
                      <TaskList
                        items={[...overduePreview, ...todayPreview].slice(0, previewLimit)}
                        selectedTaskId={selectedTaskId}
                        onOpen={setSelectedTaskId}
                        projects={projects}
                        empty={<EmptyRow title="Nothing needs your attention.">You&apos;re clear for today.</EmptyRow>}
                      />
                    </div>
                  </section>

                  <section>
                    <SectionHeader
                      title="Coming up this week"
                      count={buckets.upcoming.length}
                      action={<Link href={`${basePath}/calendar`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Calendar <ArrowRight className="h-3 w-3" /></Link>}
                    />
                    <div className="border-t border-border">
                      <TaskList
                        items={upcomingPreview}
                        selectedTaskId={selectedTaskId}
                        onOpen={setSelectedTaskId}
                        projects={projects}
                        empty={<EmptyRow title="No upcoming tasks.">Add due dates to plan ahead.</EmptyRow>}
                      />
                    </div>
                  </section>

                  <section>
                    <SectionHeader
                      title="Project focus"
                      count={projectMetrics.length}
                      action={<Link href={`${basePath}/projects`} className="text-xs text-muted-foreground hover:text-foreground">All projects</Link>}
                    />
                    {projectMetrics.length === 0 ? <EmptyRow title="No active projects.">Create a project to group related work.</EmptyRow> : <div className="divide-y divide-border/60 border-y border-border/60">{projectMetrics.map(({ project, openCount, overdueCount, next, progress }) => <Link key={project.id} href={projectHref(project.id, basePath)} className="block px-2.5 py-3 transition-colors hover:bg-[var(--color-hover)]"><div className="flex min-w-0 items-center justify-between gap-3"><span className="inline-flex min-w-0 items-center gap-2 text-[13px] font-medium text-foreground"><Folder className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /><span className="truncate">{project.name}</span></span><span className={overdueCount > 0 ? "text-xs font-medium text-red-600" : "text-xs text-muted-foreground"}>{overdueCount > 0 ? `${overdueCount} overdue` : `${openCount} open`}</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground" style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} /></div><p className="mt-2 truncate text-[11px] text-muted-foreground">{next ? `Next: ${homeTaskTitle(next)}` : project.due ? `Due ${formatDueLabel(project.due)}` : "No dated task"}</p></Link>)}</div>}
                  </section>
                </div>

                <aside className="min-w-0 space-y-8">
                  <section>
                    <SectionHeader title="Inbox" count={inboxCount} icon={<Inbox className="h-3.5 w-3.5" />} action={<Link href={`${basePath}/inbox`} className="text-xs text-muted-foreground hover:text-foreground">Open inbox</Link>} />
                    <TaskList items={inboxPreview} selectedTaskId={selectedTaskId} onOpen={setSelectedTaskId} projects={projects} empty={<EmptyRow title="Inbox is clear.">New captures will appear here.</EmptyRow>} />
                  </section>

                  <section>
                    <div className="rounded-lg bg-muted/60 px-4 py-3.5">
                      <p className="text-[12px] font-medium text-foreground">{buckets.overdue.length > 0 ? "A little focus will clear the way." : "A calm place for your work."}</p>
                      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{buckets.overdue.length > 0 ? `${buckets.overdue.length} task${buckets.overdue.length === 1 ? "" : "s"} needs attention.` : "Keep the next small step visible."}</p>
                    </div>
                  </section>

                  <section>
                    <SectionHeader
                      title="Recent notes"
                      count={recentContext.length}
                      icon={<FileText className="h-3.5 w-3.5" />}
                      action={<Link href={`${basePath}/notes`} className="font-mono text-[10px] text-zinc-500 hover:text-zinc-950">Notes</Link>}
                    />
                    {recentContext.length === 0 ? (
                      <EmptyRow title="No recent notes.">New notes will appear here.</EmptyRow>
                    ) : (
                      <div className="border-t border-border">
                        <div className="divide-y divide-border">
                          {recentContext.map((row) => (
                            <ContextRow key={row.id} href={row.href} title={row.title} kind={row.kind} meta={row.meta} />
                          ))}
                        </div>
                        {hasMoreRecentNotes ? (
                          <div className="flex items-center justify-between border-t border-border px-3 py-2 font-mono text-[10px] text-muted-foreground">
                            <Link href={`${basePath}/notes`} className="hover:text-foreground">More notes</Link>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </section>
                </aside>
              </main>
            </div>
          </PageWidth>
        </div>
        <TaskDrawer
          item={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          membersOverride={members}
          projectsOverride={projects}
          allItems={workItems}
          onItemsReplaced={setWorkItems}
          onSelectItem={setSelectedTaskId}
          onItemPatched={(id, patch) => {
            setWorkItems((current) => current.map((workItem) => (workItem.id === id ? { ...workItem, ...patch } : workItem)));
          }}
          onItemReplaced={(next) => {
            setWorkItems((current) => current.map((workItem) => (workItem.id === next.id ? next : workItem)));
          }}
        />
      </div>
    </AppShell>
  );
}
