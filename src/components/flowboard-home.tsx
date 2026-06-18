"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, FileText, Inbox, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/lovable/shell";
import { PriorityIcon } from "@/components/lovable/icons";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { compareLocalDateStrings, formatDueLabel, getDatePart, localDateKey } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { type Project, type WorkItem } from "@/lib/mock-data";
import { getServerSession } from "@/lib/server-session-client";
import {
  type ApiNote,
  type ApiProject,
  type ApiWorkItem,
  toApiWorkStatus,
  toUiNotePreview,
  toUiProject,
  toUiWorkItem,
} from "@/lib/server-ui-mappers";

const priorityRank = { High: 0, Medium: 1, Low: 2 };

function daysLate(dateKey: string, today: Date) {
  return Math.max(1, Math.floor((today.getTime() - new Date(`${getDatePart(dateKey)}T00:00:00`).getTime()) / 86400000));
}

function homeDueLabel(item: WorkItem, todayKey: string) {
  const due = getDatePart(item.due);
  if (!due) return "No date";
  const cmp = compareLocalDateStrings(due, todayKey);
  if (cmp === 0) return "Due today";
  if (cmp < 0) return "Overdue";
  return formatDueLabel(due);
}

function Section({
  title,
  count,
  children,
  empty,
}: {
  title: string;
  count: number;
  children: ReactNode;
  empty: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-zinc-200/80 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">{title}</h2>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-mono text-[10px] text-zinc-500">{count}</span>
      </div>
      {count === 0 ? <div className="px-4 py-4 text-xs text-zinc-500">{empty}</div> : children}
    </section>
  );
}

function TaskRow({
  item,
  meta,
  selected,
  projectName,
  onOpen,
  onComplete,
}: {
  item: WorkItem;
  meta: ReactNode;
  selected: boolean;
  projectName?: string;
  onOpen: () => void;
  onComplete: () => void;
}) {
  const done = item.status === "Done";

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-2 border-b border-zinc-100 px-3 py-2.5 last:border-b-0 sm:flex-nowrap ${selected ? "bg-zinc-100/80" : "hover:bg-zinc-50"}`}>
      <input
        type="checkbox"
        checked={done}
        onChange={onComplete}
        disabled={done}
        className="h-3.5 w-3.5 accent-zinc-900"
        aria-label={`Complete ${item.title}`}
      />
      <PriorityIcon p={item.priority} />
      <button
        type="button"
        onClick={onOpen}
        data-testid={`home-task-row-${item.id}`}
        className={`min-w-0 flex-[1_1_12rem] text-left text-xs font-semibold sm:truncate ${done ? "text-zinc-400 line-through" : "text-zinc-800 hover:underline"}`}
        title={item.title}
      >
        {item.title}
      </button>
      {projectName ? <span className="max-w-full truncate text-[11px] text-zinc-500 sm:max-w-32">{projectName}</span> : null}
      <span className="shrink-0 text-[11px] font-medium text-zinc-600">{meta}</span>
    </div>
  );
}

function InboxCaptureRow({ item }: { item: WorkItem }) {
  return (
    <Link href="/app/inbox" className="flex min-w-0 items-center gap-3 border-b border-zinc-100 px-3 py-2.5 text-xs last:border-b-0 hover:bg-zinc-50">
      <Inbox className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
      <span className="min-w-0 flex-1 truncate font-semibold text-zinc-800">{item.title}</span>
      <span className="shrink-0 text-[11px] text-zinc-500">Triage</span>
    </Link>
  );
}

export function PlanGladeHome() {
  const activeProjectId = useStore((state) => state.settings.activeProjectId);
  const captureRef = useRef<HTMLInputElement>(null);

  const [capture, setCapture] = useState("");
  const [captureSaving, setCaptureSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [recentNotes, setRecentNotes] = useState<Array<{ id: string; title: string; tag: string; updated: string; excerpt: string }>>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());

  const todayKey = localDateKey(now);
  const selectedTask = selectedTaskId ? workItems.find((item) => item.id === selectedTaskId) ?? null : null;
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const currentMemberName = memberById.get(currentUserId ?? "")?.name ?? "there";
  const firstName = currentMemberName.split(" ")[0] || "there";

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      captureRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const session = await getServerSession();
        if (!active) return;

        setWorkspaceId(session.workspace.id);
        setCurrentUserId(session.user.id);
        const nextMembers = (session.members ?? []).map((member) => ({ id: member.id, name: member.name }));
        setMembers(nextMembers.length ? nextMembers : [{ id: session.user.id, name: session.user.name ?? session.user.email }]);

        const [itemsRes, notesRes, projectsRes] = await Promise.all([
          fetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          fetch(`/api/notes?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          fetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);

        if (!itemsRes.ok) throw new Error("Failed to load tasks");
        if (!notesRes.ok) throw new Error("Failed to load notes");
        if (!projectsRes.ok) throw new Error("Failed to load projects");

        const itemsPayload = (await itemsRes.json()) as { workItems: ApiWorkItem[] };
        const notesPayload = (await notesRes.json()) as { notes: ApiNote[] };
        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        if (!active) return;

        setWorkItems(itemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id)));
        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        setRecentNotes(notesPayload.notes.map(toUiNotePreview).slice(0, 6));
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Failed to load workspace");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const buckets = useMemo(() => {
    const today: WorkItem[] = [];
    const upcoming: WorkItem[] = [];
    const overdue: WorkItem[] = [];
    const inbox: WorkItem[] = [];

    for (const item of workItems) {
      if (activeProjectId && item.project !== activeProjectId) continue;
      if (item.status === "Backlog") {
        inbox.push(item);
        continue;
      }
      if (item.status === "Done" && !recentlyCompletedIds.includes(item.id)) continue;

      const due = getDatePart(item.due);
      const cmp = due ? compareLocalDateStrings(due, todayKey) : 0;
      if (due && cmp < 0 && item.status !== "Done") overdue.push(item);
      else if (!due || cmp === 0) today.push(item);
      else upcoming.push(item);
    }

    const byPriority = (a: WorkItem, b: WorkItem) => priorityRank[a.priority] - priorityRank[b.priority];
    overdue.sort((a, b) => compareLocalDateStrings(a.due, b.due) || byPriority(a, b));
    today.sort((a, b) => byPriority(a, b) || compareLocalDateStrings(a.due || todayKey, b.due || todayKey));
    inbox.sort(byPriority);
    upcoming.sort((a, b) => compareLocalDateStrings(a.due, b.due));

    return { today, overdue, inbox, upcoming };
  }, [activeProjectId, recentlyCompletedIds, todayKey, workItems]);

  const projectFocus = useMemo(() => {
    const openItems = workItems.filter((item) => item.status !== "Done" && item.status !== "Backlog");
    return projects
      .map((project) => ({
        project,
        items: openItems.filter((item) => item.project === project.id),
        allItems: workItems.filter((item) => item.project === project.id && item.status !== "Backlog"),
      }))
      .filter((entry) => entry.items.length > 0)
      .sort((a, b) => b.items.length - a.items.length || a.project.name.localeCompare(b.project.name))[0] ?? null;
  }, [projects, workItems]);

  const completeTask = async (id: string) => {
    if (!workspaceId) return;
    const previous = workItems.find((item) => item.id === id);
    if (!previous || previous.status === "Done") return;

    setRecentlyCompletedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setWorkItems((current) => current.map((item) => (item.id === id ? { ...item, status: "Done" } : item)));
    window.setTimeout(() => setRecentlyCompletedIds((ids) => ids.filter((taskId) => taskId !== id)), 1800);

    const response = await fetch(`/api/work-items/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-flowboard-user-id": currentUserId ?? "" },
      body: JSON.stringify({ status: toApiWorkStatus("Done"), completedAt: new Date().toISOString() }),
    });

    if (!response.ok) {
      setWorkItems((current) => current.map((item) => (item.id === id ? previous : item)));
      setError("Failed to update task");
      return;
    }

    toast.success("Marked done", { description: previous.title });
  };

  const submitCapture = async () => {
    const text = capture.trim();
    if (!text || !workspaceId || captureSaving) return;

    setCaptureSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/work-items", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: text,
          status: "BACKLOG",
          priority: "MEDIUM",
          dueDate: `${todayKey}T00:00:00.000Z`,
        }),
      });

      if (!response.ok) throw new Error("Failed to capture item");

      const payload = (await response.json()) as { workItem: ApiWorkItem };
      const next = toUiWorkItem(payload.workItem, currentUserId);
      setWorkItems((current) => [next, ...current]);
      setCapture("");
      toast.success("Captured to Inbox", { description: text });
    } catch (captureError) {
      setError(captureError instanceof Error ? captureError.message : "Failed to capture item");
    } finally {
      setCaptureSaving(false);
    }
  };

  const onCaptureKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") void submitCapture();
  };

  const renderTask = (item: WorkItem, meta: ReactNode) => (
    <TaskRow
      key={item.id}
      item={item}
      meta={meta}
      selected={selectedTaskId === item.id}
      projectName={projectById.get(item.project)?.name}
      onOpen={() => setSelectedTaskId(item.id)}
      onComplete={() => void completeTask(item.id)}
    />
  );

  return (
    <AppShell title={<span className="font-medium">Home</span>}>
      <div className="flex h-full min-h-0 flex-col bg-[#fafafa] lg:flex-row">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto grid w-full max-w-5xl gap-8 p-6 md:p-8 lg:grid-cols-12 lg:gap-12 lg:p-12">
            <main className="min-w-0 space-y-5 lg:col-span-8">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

              <div>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Daily command center</p>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Good afternoon, {firstName}</h1>
                    <p className="mt-1 text-xs text-zinc-500">
                      {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </p>
                  </div>
                  <Link href="/app/inbox" className="inline-flex items-center gap-2 rounded-md border border-zinc-200/80 bg-white px-3 py-1.5 text-[10px] font-bold text-zinc-700 hover:border-zinc-900">
                    <Inbox className="h-4 w-4" />
                    {buckets.inbox.length} capture{buckets.inbox.length === 1 ? "" : "s"} waiting
                  </Link>
                </div>

                <div className="mt-5 flex items-center gap-2 rounded-lg border border-zinc-200/80 bg-white px-3.5 py-2 shadow-xs focus-within:ring-1 focus-within:ring-zinc-950">
                  <Plus className="h-4 w-4 text-zinc-400" />
                  <input
                    ref={captureRef}
                    value={capture}
                    onChange={(event) => setCapture(event.target.value)}
                    onKeyDown={onCaptureKey}
                    placeholder="Capture work to Inbox..."
                    disabled={captureSaving}
                    className="h-7 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={() => void submitCapture()}
                    disabled={!capture.trim() || !workspaceId || captureSaving}
                    className="rounded-md bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {captureSaving ? "Saving" : "Add"}
                  </button>
                  <kbd className="hidden rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline">/</kbd>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-100 pt-3 text-[10px] uppercase tracking-wider text-zinc-400">
                  <Link href="/app/tasks" className="font-semibold text-zinc-800 hover:underline">{buckets.today.length} today</Link>
                  <Link href="/app/tasks" className={`font-semibold hover:underline ${buckets.overdue.length ? "text-red-600" : "text-zinc-800"}`}>{buckets.overdue.length} overdue</Link>
                  <Link href="/app/inbox" className="font-semibold text-zinc-800 hover:underline">Review {buckets.inbox.length} inbox</Link>
                </div>
              </div>

              {loading && <div className="px-2 py-2 text-xs text-zinc-400">Loading workspace data...</div>}

              <Section title="Overdue" count={buckets.overdue.length} empty={<span>No overdue work. Capture anything loose above.</span>}>
                {buckets.overdue.slice(0, 8).map((item) => renderTask(item, <span className="text-red-600">{daysLate(item.due, now)}d late</span>))}
              </Section>

              <Section title="Today" count={buckets.today.length} empty={<span>Nothing due today. Check Inbox or keep capturing.</span>}>
                {buckets.today.slice(0, 10).map((item) => renderTask(item, item.status === "Done" ? "Completed" : homeDueLabel(item, todayKey)))}
              </Section>

              <Section title="Inbox" count={buckets.inbox.length} empty={<span>Inbox is clear. New captures land here first.</span>}>
                {buckets.inbox.slice(0, 8).map((item) => <InboxCaptureRow key={item.id} item={item} />)}
              </Section>
            </main>

            <aside className="min-w-0 space-y-5 lg:col-span-4">
              <section className="rounded-lg border border-zinc-200/80 bg-white">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">Project focus</h2>
                  <Link href="/app/projects" className="text-[11px] text-zinc-500 hover:text-zinc-900">Create project</Link>
                </div>
                {projectFocus ? (
                  <Link href={`/app/projects/${projectFocus.project.id}`} className="block px-4 py-3 text-xs hover:bg-zinc-50">
                    <span className="block truncate font-semibold text-zinc-800">{projectFocus.project.name}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-zinc-500">
                      {projectFocus.items.length} open item{projectFocus.items.length === 1 ? "" : "s"}
                      <ArrowRight className="h-3 w-3" />
                    </span>
                    <span className="mt-2 block h-1 overflow-hidden rounded-full bg-zinc-200">
                      <span
                        className="block h-full bg-zinc-900"
                        style={{ width: `${projectFocus.allItems.length ? Math.round((projectFocus.allItems.filter((item) => item.status === "Done").length / projectFocus.allItems.length) * 100) : 0}%` }}
                      />
                    </span>
                  </Link>
                ) : (
                  <div className="px-4 py-4 text-xs text-zinc-500">
                    No active project work yet. <Link href="/app/projects" className="font-semibold text-zinc-800 hover:underline">Create a project</Link> or keep capturing.
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-zinc-200/80 bg-white">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <h2 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Next up
                  </h2>
                  <Link href="/app/calendar" className="text-[11px] text-zinc-500 hover:text-zinc-900">Open calendar</Link>
                </div>
                <div className="divide-y divide-zinc-100">
                  {buckets.upcoming.slice(0, 6).map((item) => (
                    <button key={item.id} type="button" onClick={() => setSelectedTaskId(item.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 py-2.5 text-left text-xs hover:bg-zinc-50">
                      <span className="min-w-0 truncate font-semibold text-zinc-800">{item.title}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{formatDueLabel(item.due)}</span>
                    </button>
                  ))}
                  {buckets.upcoming.length === 0 && <p className="px-4 py-4 text-xs text-zinc-500">No upcoming dated work.</p>}
                </div>
              </section>

              <section className="rounded-lg border border-zinc-200/80 bg-white">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <h2 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    <FileText className="h-3.5 w-3.5" />
                    Recent notes
                  </h2>
                  <Link href="/app/notes" className="text-[11px] text-zinc-500 hover:text-zinc-900">Open notes</Link>
                </div>
                <div className="divide-y divide-zinc-100">
                  {recentNotes.map((note) => (
                    <Link key={note.id} href={`/app/notes?id=${note.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 py-2.5 text-xs hover:bg-zinc-50">
                      <span className="min-w-0 truncate font-semibold text-zinc-800">{note.title}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{note.updated}</span>
                    </Link>
                  ))}
                  {recentNotes.length === 0 && <p className="px-4 py-4 text-xs text-zinc-500">No notes yet.</p>}
                </div>
              </section>
            </aside>
          </div>
        </div>

        <TaskDrawer
          item={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          membersOverride={members}
          projectsOverride={projects}
          notesOverride={recentNotes}
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
