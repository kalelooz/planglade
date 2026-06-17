"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, FileText, Inbox, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/lovable/shell";
import { Avatar, PriorityIcon, StatusIcon } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";
import { TaskDrawer } from "@/components/lovable/task-drawer";
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
      {count === 0 ? <div className="px-4 py-8 text-center text-xs text-zinc-400">{empty}</div> : children}
    </section>
  );
}

function TaskRow({
  item,
  meta,
  selected,
  projectName,
  memberName,
  onOpen,
  onComplete,
}: {
  item: WorkItem;
  meta: ReactNode;
  selected: boolean;
  projectName: string;
  memberName: string;
  onOpen: () => void;
  onComplete: () => void;
}) {
  const done = item.status === "Done";

  return (
    <div className={`flex items-center gap-3 border-b border-zinc-100 px-3 py-2.5 last:border-b-0 ${selected ? "bg-zinc-100/80" : "hover:bg-zinc-50"}`}>
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
        className={`min-w-0 flex-1 truncate text-left text-xs font-semibold ${done ? "text-zinc-400 line-through" : "text-zinc-800 hover:underline"}`}
        title={item.title}
      >
        {item.title}
      </button>
      <Chip>{item.label}</Chip>
      <span className="hidden max-w-32 items-center gap-1.5 truncate text-[11px] text-zinc-500 md:inline-flex">
        <Avatar id={item.assignee} name={memberName} size={18} />
        <span className="truncate">{memberName}</span>
      </span>
      <span className="hidden max-w-32 truncate font-mono text-[10px] text-zinc-400 lg:inline">{projectName}</span>
      <span className="shrink-0 text-right text-[11px] text-zinc-500">{meta}</span>
    </div>
  );
}

export function FlowBoardHome() {
  const localInboxItems = useStore((state) => state.inboxItems);
  const activeProjectId = useStore((state) => state.settings.activeProjectId);
  const addInboxItem = useStore((state) => state.addInboxItem);
  const captureRef = useRef<HTMLInputElement>(null);

  const [capture, setCapture] = useState("");
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
    if (!text || !workspaceId) return;
    addInboxItem(text, { createWorkItem: true });

    const response = await fetch("/api/work-items", {
      method: "POST",
      headers: { "content-type": "application/json", "x-flowboard-user-id": currentUserId ?? "" },
      body: JSON.stringify({
        workspaceId,
        title: text,
        status: "BACKLOG",
        priority: "MEDIUM",
        dueDate: `${todayKey}T00:00:00.000Z`,
      }),
    });

    if (!response.ok) {
      setError("Capture saved locally; server task creation failed");
      return;
    }

    const payload = (await response.json()) as { workItem: ApiWorkItem };
    const next = toUiWorkItem(payload.workItem, currentUserId);
    setWorkItems((current) => [next, ...current]);
    setSelectedTaskId(next.id);
    setCapture("");
    toast.success("Captured to Inbox", { description: text });
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
      projectName={projectById.get(item.project)?.name ?? "No project"}
      memberName={memberById.get(item.assignee)?.name ?? "Unassigned"}
      onOpen={() => setSelectedTaskId(item.id)}
      onComplete={() => void completeTask(item.id)}
    />
  );

  return (
    <AppShell title={<span className="font-medium">Home</span>}>
      <div className="flex h-full min-h-0 bg-[#fafafa]">
        <div className="min-w-0 flex-1 overflow-y-auto">
          <div className="grid gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-6">
            <main className="min-w-0 space-y-5">
              {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

              <div className="rounded-lg border border-zinc-200/80 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">Daily command center</p>
                    <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">Good afternoon, {firstName}</h1>
                    <p className="mt-1 text-xs text-zinc-500">
                      {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} · {buckets.today.length} today ·{" "}
                      <span className={buckets.overdue.length ? "font-semibold text-red-600" : ""}>{buckets.overdue.length} overdue</span>
                    </p>
                  </div>
                  <Link href="/app/inbox" className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-900">
                    <Inbox className="h-4 w-4" />
                    {buckets.inbox.length + localInboxItems.length} inbox
                  </Link>
                </div>

                <div className="mt-4 flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 focus-within:border-zinc-900">
                  <Plus className="h-4 w-4 text-zinc-400" />
                  <input
                    ref={captureRef}
                    value={capture}
                    onChange={(event) => setCapture(event.target.value)}
                    onKeyDown={onCaptureKey}
                    placeholder="Capture a task, note, or idea..."
                    className="h-8 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                  />
                  <button
                    type="button"
                    onClick={() => void submitCapture()}
                    disabled={!capture.trim() || !workspaceId}
                    className="rounded-md bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Add
                  </button>
                  <kbd className="hidden rounded border bg-white px-1.5 py-0.5 font-mono text-[10px] text-zinc-400 sm:inline">/</kbd>
                </div>
              </div>

              {loading && <div className="px-2 py-2 text-xs text-zinc-400">Loading workspace data...</div>}

              <Section title="Overdue" count={buckets.overdue.length} empty="No overdue work.">
                {buckets.overdue.slice(0, 8).map((item) => renderTask(item, <span className="text-red-600">{daysLate(item.due, now)}d late</span>))}
              </Section>

              <Section title="Today" count={buckets.today.length} empty="Nothing due today.">
                {buckets.today.slice(0, 10).map((item) => renderTask(item, item.status === "Done" ? "Completed" : item.due ? formatDueLabel(item.due) : "No date"))}
              </Section>

              <Section title="Inbox" count={buckets.inbox.length} empty="Inbox is clear.">
                {buckets.inbox.slice(0, 8).map((item) => renderTask(item, item.due ? formatDueLabel(item.due) : "Untriaged"))}
              </Section>
            </main>

            <aside className="min-w-0 space-y-5">
              <section className="rounded-lg border border-zinc-200/80 bg-white">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <h2 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    <CalendarDays className="h-3.5 w-3.5" />
                    Next up
                  </h2>
                  <Link href="/app/calendar" className="text-[11px] text-zinc-400 hover:text-zinc-900">Open</Link>
                </div>
                <div className="divide-y divide-zinc-100">
                  {buckets.upcoming.slice(0, 6).map((item) => (
                    <button key={item.id} type="button" onClick={() => setSelectedTaskId(item.id)} className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 py-2.5 text-left text-xs hover:bg-zinc-50">
                      <span className="min-w-0 truncate font-semibold text-zinc-800">{item.title}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{formatDueLabel(item.due)}</span>
                    </button>
                  ))}
                  {buckets.upcoming.length === 0 && <p className="px-4 py-8 text-center text-xs text-zinc-400">No upcoming dated work.</p>}
                </div>
              </section>

              <section className="rounded-lg border border-zinc-200/80 bg-white">
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                  <h2 className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-700">
                    <FileText className="h-3.5 w-3.5" />
                    Recent notes
                  </h2>
                  <Link href="/app/notes" className="text-[11px] text-zinc-400 hover:text-zinc-900">Open</Link>
                </div>
                <div className="divide-y divide-zinc-100">
                  {recentNotes.map((note) => (
                    <Link key={note.id} href={`/app/notes?id=${note.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 px-4 py-2.5 text-xs hover:bg-zinc-50">
                      <span className="min-w-0 truncate font-semibold text-zinc-800">{note.title}</span>
                      <span className="font-mono text-[10px] text-zinc-400">{note.updated}</span>
                    </Link>
                  ))}
                  {recentNotes.length === 0 && <p className="px-4 py-8 text-center text-xs text-zinc-400">No notes yet.</p>}
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
