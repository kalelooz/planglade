"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, CalendarDays, FileText, Folder, Inbox } from "lucide-react";

import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { DependencyBadge } from "@/components/lovable/dependency-badge";
import { Avatar } from "@/components/lovable/icons";
import { PriorityIndicator } from "@/components/lovable/priority-indicator";
import { Chip } from "@/components/lovable/page";
import { FlowMetaPill } from "@/components/lovable/flow-ui";
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

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "danger" | "warning" | "success" }) {
  const toneClass =
    tone === "danger"
      ? "border-red-200/80 bg-red-50/70 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300"
      : tone === "warning"
        ? "border-amber-200/80 bg-amber-50/70 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
        : tone === "success"
          ? "border-emerald-200/80 bg-emerald-50/70 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"
          : "border-border bg-muted/50 text-muted-foreground";

  return (
    <span className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 font-mono text-[10px] font-medium leading-none ${toneClass}`}>
      {children}
    </span>
  );
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
    <div className="app-section-header">
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        <h2 className="truncate text-[12px] font-semibold text-foreground">{title}</h2>
        {typeof count === "number" ? <Pill>{count}</Pill> : null}
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

type HomeTaskRowMode = "default" | "attention" | "recent" | "next";

function homeTaskTitle(item: WorkItem) {
  const title = item.title.trim();
  if (title && title.toLowerCase() !== "no title") return title;
  const description = item.description?.trim();
  return description || "New task";
}

function isRealHomeAssignee(member: { id: string; name: string } | undefined) {
  if (!member) return false;
  const name = member.name.trim();
  return !!name && member.id !== "unassigned" && name.toLowerCase() !== "unassigned";
}

function TaskRow({
  item,
  selected,
  onOpen,
  allItems,
  members,
  danger = false,
  mode = "default",
}: {
  item: WorkItem;
  selected: boolean;
  onOpen: () => void;
  allItems: WorkItem[];
  members: Array<{ id: string; name: string }>;
  danger?: boolean;
  mode?: HomeTaskRowMode;
}) {
  const completed = item.status === "Done";
  const member = members.find((candidate) => candidate.id === item.assignee);
  const assignedMember = isRealHomeAssignee(member) ? member : null;
  const displayLabel = item.label?.trim();
  const displayTitle = homeTaskTitle(item);
  const dueLabel = item.due ? formatDueLabel(item.due) : null;
  const showDate = !!dueLabel && mode !== "next";
  const isNextMode = mode === "next";
  const showAssignee = !!assignedMember && !isNextMode;
  const showType = !!displayLabel && displayLabel.toLowerCase() !== "task" && !isNextMode;

  return (
    <button
      type="button"
      onClick={onOpen}
      title={displayTitle}
      data-home-task-preview-row
      className={`flow-row flow-row-flat group grid w-full min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-3 py-2.5 text-left text-[13px] sm:grid-cols-[minmax(0,1fr)_auto] ${
        selected ? "flow-row-selected text-foreground" : ""
      }`}
    >
      <span
        data-home-row-title
        className="min-w-0 px-1 py-1"
      >
        <span
          className={`block min-w-0 truncate ${
            isNextMode ? "font-semibold tracking-tight" : "font-medium"
          } ${completed ? "text-muted-foreground" : "text-foreground"}`}
        >
          {displayTitle}
        </span>
      </span>
      <span
        data-home-row-metadata
        className={`flex min-w-0 items-center gap-x-2 gap-y-1 text-muted-foreground ${
          isNextMode ? "flex-nowrap text-[10.5px] sm:col-start-auto sm:min-w-max sm:shrink-0 sm:justify-end sm:whitespace-nowrap" : "flex-wrap text-[12px] sm:col-start-auto sm:min-w-max sm:shrink-0 sm:flex-nowrap sm:justify-end sm:whitespace-nowrap"
        }`}
      >
        <span data-home-row-priority-dependency className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap">
          <DependencyBadge item={item} allItems={allItems} />
          <PriorityIndicator priority={item.priority} />
        </span>
        {assignedMember && showAssignee ? (
          <span className="inline-flex min-w-0 max-w-32 items-center gap-1 text-foreground/75">
            <Avatar id={assignedMember.id} name={assignedMember.name} />
            <span className="truncate">{assignedMember.name}</span>
          </span>
        ) : null}
        {showType ? <span className="shrink-0 whitespace-nowrap"><Chip>{displayLabel}</Chip></span> : null}
        {showDate ? (
          <FlowMetaPill className={`shrink-0 whitespace-nowrap border-transparent bg-transparent ${danger ? "font-medium text-red-600 dark:text-red-300" : ""}`}>
            {dueLabel}
          </FlowMetaPill>
        ) : null}
      </span>
    </button>
  );
}

function TaskList({
  items,
  selectedTaskId,
  onOpen,
  allItems,
  members,
  empty,
  danger = false,
  mode = "default",
}: {
  items: WorkItem[];
  selectedTaskId: string | null;
  onOpen: (id: string) => void;
  allItems: WorkItem[];
  members: Array<{ id: string; name: string }>;
  empty: ReactNode;
  danger?: boolean;
  mode?: HomeTaskRowMode;
}) {
  if (items.length === 0) return <>{empty}</>;

  return (
    <div>
      {items.map((item) => (
        <TaskRow
          key={item.id}
          item={item}
          selected={selectedTaskId === item.id}
          onOpen={() => onOpen(item.id)}
          allItems={allItems}
          members={members}
          danger={danger}
          mode={mode}
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
      <div className="kimi-home flex h-full">
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto [scrollbar-gutter:stable]">
          <div className="mx-auto w-full max-w-[880px] px-4 py-6 sm:px-6 sm:py-8">
            <div className="space-y-8">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[10.5px] text-red-700">{error}</div>}

              <div>
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{greeting}, {firstName}.</h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">{todayLabel}</p>
                  </div>
                  {loading ? <span className="font-mono text-[10px] text-zinc-400">Loading home data...</span> : null}
                </div>
                <nav aria-label="Today overview" className="grid grid-cols-3 border-y border-border/60 text-[11px]">
                  <Link href={taskHref("today")} className="flex min-h-11 items-center gap-2 px-3 hover:bg-[var(--color-hover)]">
                    <span className="text-base font-semibold text-foreground">{buckets.today.length}</span>
                    <span className="text-muted-foreground">due today</span>
                  </Link>
                  <Link href={taskHref("overdue")} className="flex min-h-11 items-center gap-2 border-x border-border px-3 hover:bg-[var(--color-hover)]">
                    <span className={`text-base font-semibold ${buckets.overdue.length > 0 ? "text-red-600 dark:text-red-300" : "text-foreground"}`}>{buckets.overdue.length}</span>
                    <span className="text-muted-foreground">overdue</span>
                  </Link>
                  <Link href={`${basePath}/inbox`} className="flex min-h-11 items-center gap-2 px-3 hover:bg-[var(--color-hover)]">
                    <span className="text-base font-semibold text-foreground">{inboxCount}</span>
                    <span className="text-muted-foreground">in inbox</span>
                  </Link>
                </nav>
              </div>

              <main className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[1fr_280px]">
                <div className="min-w-0 space-y-8">
                  <section>
                    <SectionHeader
                      title="Today’s tasks"
                      count={buckets.today.length}
                      action={
                        buckets.today.length > previewLimit ? (
                          <Link href={taskHref("today")} className="font-mono text-[10px] text-zinc-500 hover:text-zinc-950">Show all</Link>
                        ) : null
                      }
                    />
                    <div className="border-t border-border">
                      <TaskList
                        items={todayPreview}
                        selectedTaskId={selectedTaskId}
                        onOpen={setSelectedTaskId}
                        allItems={workItems}
                        members={members}
                          mode="default"
                          empty={
                            <EmptyRow title="Nothing due today.">
                            You&apos;re clear for today.
                          </EmptyRow>
                        }
                      />
                    </div>
                  </section>

                  <section>
                    <SectionHeader
                      title="Overdue tasks"
                      count={buckets.overdue.length}
                      icon={<AlertCircle className="h-3.5 w-3.5" />}
                      action={
                        buckets.overdue.length > previewLimit ? (
                          <Link href={taskHref("overdue")} className="font-mono text-[10px] text-red-600 hover:text-red-700">Show all</Link>
                        ) : null
                      }
                    />
                    <div className="border-t border-border">
                      <TaskList
                        items={overduePreview}
                        selectedTaskId={selectedTaskId}
                        onOpen={setSelectedTaskId}
                        allItems={workItems}
                        members={members}
                        danger
                          mode="attention"
                          empty={
                          <EmptyRow title="No overdue tasks.">
                            Nothing needs attention.
                          </EmptyRow>
                        }
                      />
                    </div>
                  </section>

                  <section>
                    <SectionHeader
                      title="Inbox"
                      count={inboxBucket.length}
                      icon={<Inbox className="h-3.5 w-3.5" />}
                      action={<Link href={`${basePath}/inbox`} className="font-mono text-[10px] text-zinc-500 hover:text-zinc-950">Open Inbox</Link>}
                    />
                    <div className="border-t border-border">
                      <TaskList
                        items={inboxPreview}
                        selectedTaskId={selectedTaskId}
                        onOpen={setSelectedTaskId}
                        allItems={workItems}
                        members={members}
                          mode="recent"
                          empty={
                          <EmptyRow title="Inbox is clear.">
                            New captures will appear here.
                          </EmptyRow>
                        }
                      />
                    </div>
                  </section>
                </div>

                <aside className="min-w-0 space-y-8">
                  <section>
                    <SectionHeader title="Projects" count={projectMetrics.length} icon={<Folder className="h-3.5 w-3.5" />} />
                    {projectMetrics.length === 0 ? (
                      <EmptyRow title="No active projects.">Create a project to group related work.</EmptyRow>
                    ) : (
                      <div className="border-t border-border">
                        <div className="divide-y divide-border">
                        {projectMetrics.map(({ project, openCount, overdueCount, next, progress }) => (
                          <Link
                            key={project.id}
                            href={projectHref(project.id, basePath)}
                            className="block px-3 py-2.5 transition-colors hover:bg-[var(--color-hover)]"
                          >
                            <div className="flex min-w-0 items-center justify-between gap-3">
                              <span className="min-w-0 truncate text-xs font-medium text-foreground">{project.name}</span>
                              <span
                                className={`shrink-0 font-mono text-[10px] ${
                                  overdueCount > 0 ? "text-red-600 dark:text-red-300" : project.status === "On Hold" ? "text-amber-600 dark:text-amber-300" : "text-muted-foreground"
                                }`}
                              >
                                {overdueCount > 0 ? `${overdueCount} overdue` : project.status === "On Hold" ? "On hold" : `${openCount} open`}
                              </span>
                            </div>
                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-foreground"
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                              />
                            </div>
                            <div className="mt-2 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground">
                              <span className="min-w-0 truncate">
                                {next ? `Next / ${next.title}` : project.due ? `Due / ${formatDueLabel(project.due)}` : "No dated task"}
                              </span>
                              <span>{progress}%</span>
                            </div>
                          </Link>
                        ))}
                        </div>
                      </div>
                    )}
                  </section>

                  <section>
                    <SectionHeader
                      title="Upcoming tasks"
                      count={buckets.upcoming.length}
                      icon={<CalendarDays className="h-3.5 w-3.5" />}
                      action={<Link href={`${basePath}/calendar`} className="font-mono text-[10px] text-zinc-500 hover:text-zinc-950">Calendar</Link>}
                    />
                    <div className="border-t border-border">
                      <TaskList
                        items={upcomingPreview}
                        selectedTaskId={selectedTaskId}
                        onOpen={setSelectedTaskId}
                        allItems={workItems}
                        members={members}
                          mode="next"
                          empty={
                          <EmptyRow title="No upcoming tasks.">
                            Add due dates to plan ahead.
                          </EmptyRow>
                        }
                      />
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
          </div>
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
