"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { Activity, Clock3, FileText, Inbox, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { useStore } from "@/lib/store";
import { type WorkItem } from "@/lib/mock-data";
import { compareLocalDateStrings, formatDueLabel, getDatePart } from "@/lib/dates";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysLate(dateKey: string, today: Date) {
  return Math.max(1, Math.floor((today.getTime() - new Date(`${getDatePart(dateKey)}T00:00:00`).getTime()) / 86400000));
}

const priorityRank = { High: 0, Medium: 1, Low: 2 };

function TaskRow({
  item,
  meta,
  selected,
  onOpen,
  onComplete,
  members,
}: {
  item: WorkItem;
  meta: ReactNode;
  selected: boolean;
  onOpen: () => void;
  onComplete: () => void;
  members: { id: string; name: string }[];
}) {
  const member = members.find((m) => m.id === item.assignee) ?? members[0];
  const completed = item.status === "Done";

  return (
    <div
      className={`group flex items-center gap-3 border-b border-border/60 px-2 py-[var(--fb-row-py)] text-[13px] transition-colors ${
        selected
          ? "bg-primary/8 shadow-[inset_2px_0_0_var(--color-primary)]"
          : completed
            ? "bg-muted/35 text-muted-foreground"
            : "hover:bg-[var(--color-hover)]/60"
      }`}
    >
      <input
        type="checkbox"
        checked={completed}
        onChange={onComplete}
        onClick={(event) => event.stopPropagation()}
        disabled={completed}
        className="h-3.5 w-3.5 accent-[var(--color-primary)]"
        aria-label={`Complete ${item.title}`}
      />
      <PriorityIcon p={item.priority} />
      <button
        type="button"
        onClick={onOpen}
        title={item.title}
        className={`min-w-0 flex-1 truncate text-left font-medium focus:outline-none focus-visible:underline ${
          completed ? "line-through decoration-muted-foreground/60" : "hover:underline"
        }`}
      >
        {item.title}
      </button>
      <Chip>{item.label}</Chip>
      <span className="inline-flex max-w-36 shrink-0 items-center gap-1.5 text-[12px] text-muted-foreground">
        <Avatar id={member.id} name={member.name} />
        <span className="truncate">{member.name}</span>
      </span>
      <span className="shrink-0 whitespace-nowrap text-right text-[12px] text-muted-foreground">{meta}</span>
    </div>
  );
}

function TaskSection({
  title,
  count,
  children,
  empty,
}: {
  title: string;
  count: number;
  children: ReactNode;
  empty: string;
}) {
  return (
    <section className="pb-4 last:pb-0">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{count}</span>
      </div>
      <div className="border-t border-border/70 pt-2">
        {count === 0 ? (
          <div className="px-2 py-8 text-center text-[12px] text-muted-foreground">{empty}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

function PulseSection({ title, icon, href, children }: { title: string; icon: ReactNode; href: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{icon}{title}</h2>
        <Link href={href} className="text-[11px] text-muted-foreground hover:text-foreground">Open</Link>
      </div>
      <div className="border-t border-border/60 pt-1">{children}</div>
    </section>
  );
}

export default function HomePage() {
  const workItems = useStore((state) => state.workItems);
  const inboxItems = useStore((state) => state.inboxItems);
  const notes = useStore((state) => state.notes);
  const activity = useStore((state) => state.activity);
  const activeProjectId = useStore((state) => state.settings.activeProjectId);
  const members = useStore((state) => state.members);
  const setStatus = useStore((state) => state.setWorkItemStatus);
  const addInboxItem = useStore((state) => state.addInboxItem);

  const [capture, setCapture] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<string[]>([]);
  const [now, setNow] = useState(() => new Date());
  const selectedTask = workItems.find((item) => item.id === selectedTaskId) ?? null;
  const captureRef = useRef<HTMLInputElement>(null);
  const todayKey = localDateKey(now);

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "/") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      event.preventDefault();
      captureRef.current?.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  const buckets = useMemo(() => {
    const today: WorkItem[] = [];
    const upcoming: WorkItem[] = [];
    const overdue: WorkItem[] = [];
    const completed: WorkItem[] = [];

    for (const item of workItems) {
      if (activeProjectId && item.project !== activeProjectId) continue;
      if (item.status === "Done") {
        if (recentlyCompletedIds.includes(item.id)) today.push(item);
        completed.push(item);
        continue;
      }

      const due = getDatePart(item.due);
      const cmp = due ? compareLocalDateStrings(due, todayKey) : 0;
      if (due && cmp < 0) overdue.push(item);
      else if (!due || cmp === 0) today.push(item);
      else upcoming.push(item);
    }

    overdue.sort((a, b) => compareLocalDateStrings(a.due, b.due) || priorityRank[a.priority] - priorityRank[b.priority]);
    today.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority] || compareLocalDateStrings(a.due || todayKey, b.due || todayKey));
    upcoming.sort((a, b) => compareLocalDateStrings(a.due, b.due));

    return { today, overdue, upcoming, completed };
  }, [workItems, activeProjectId, todayKey, recentlyCompletedIds]);

  const recentNotes = notes.slice(0, 5);
  const recentActivity = activity
    .flatMap((day) => day.items.map((item) => ({ ...item, date: day.date })))
    .slice(0, 6);

  const completeWithUndo = (id: string) => {
    const previous = workItems.find((item) => item.id === id);
    if (!previous || previous.status === "Done") return;

    setRecentlyCompletedIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setStatus(id, "Done");
    window.setTimeout(() => {
      setRecentlyCompletedIds((ids) => ids.filter((completedId) => completedId !== id));
    }, 1800);
    toast.success(`Marked ${id} done`, {
      description: previous.title,
      duration: 6000,
      action: {
        label: "Undo",
        onClick: () => {
          setRecentlyCompletedIds((ids) => ids.filter((completedId) => completedId !== id));
          setStatus(id, previous.status);
        },
      },
    });
  };

  const onCaptureKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && capture.trim()) {
      const text = capture.trim();
      addInboxItem(text, { createWorkItem: true });
      toast.success("Captured to Inbox and My Tasks", { description: text });
      setCapture("");
    }
  };

  const renderTask = (item: WorkItem, meta: ReactNode) => (
    <TaskRow
      key={item.id}
      item={item}
      meta={meta}
      selected={selectedTaskId === item.id}
      onOpen={() => setSelectedTaskId(item.id)}
      onComplete={() => completeWithUndo(item.id)}
      members={members}
    />
  );

  return (
    <AppShell title={<span className="font-medium">Today</span>}>
      <div className="flex h-full">
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="grid w-full max-w-none gap-8 px-4 py-6 lg:px-6 xl:grid-cols-[260px_minmax(0,760px)]">
            <div className="min-w-0 xl:order-2">
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <h1 className="text-[20px] font-semibold tracking-tight">Good afternoon, Alex</h1>
                    <span className="text-[12px] text-muted-foreground">
                      {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-[13px] text-muted-foreground">
                    {buckets.today.length} today,{" "}
                    <span className={buckets.overdue.length > 0 ? "font-medium text-red-600" : ""}>
                      {buckets.overdue.length} overdue
                    </span>
                    , {inboxItems.length} in Inbox.
                  </p>
                </div>
                <Link
                  href="/inbox"
                  className="group w-full rounded-lg border border-primary/20 bg-primary/[0.05] px-4 py-3 shadow-sm transition hover:border-primary/40 hover:bg-primary/[0.08] sm:w-[320px]"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-background text-primary">
                      <Inbox className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Inbox</p>
                      <div className="mt-0.5 flex items-baseline gap-2">
                        <span className="text-[20px] font-semibold text-foreground">{inboxItems.length}</span>
                        <span className="text-[12px] text-muted-foreground">
                          capture{inboxItems.length === 1 ? "" : "s"} waiting
                        </span>
                      </div>
                    </div>
                    <span className="lov-btn lov-btn-primary h-7 px-2 text-[11px]">Open</span>
                  </div>
                  <p className="mt-2 text-[12px] text-muted-foreground">
                    Capture first, process in Inbox when you are ready.
                  </p>
                </Link>
              </div>

              <div className="mb-4 flex items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-xs focus-within:border-ring focus-within:shadow-sm">
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  ref={captureRef}
                  value={capture}
                  onChange={(event) => setCapture(event.target.value)}
                  onKeyDown={onCaptureKey}
                  placeholder="Capture a task, note, or idea..."
                  aria-label="Quick capture"
                  className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                />
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">/</kbd>
              </div>

            </div>

            <main className="min-w-0 space-y-12">
                <TaskSection
                  title="Overdue"
                  count={buckets.overdue.length}
                  empty="No overdue work."
                >
                  {buckets.overdue.map((item) => renderTask(item, <span className="text-red-600">{daysLate(getDatePart(item.due), now)}d late</span>))}
                </TaskSection>

                <TaskSection
                  title="Today"
                  count={buckets.today.length}
                  empty="Nothing due today. Capture new work above or clear Inbox."
                >
                  {buckets.today.map((item) => renderTask(item, item.status === "Done" ? "Completed" : item.due ? item.status : "No date"))}
                </TaskSection>

                <TaskSection
                  title="Next up"
                  count={Math.min(buckets.upcoming.length, 5)}
                  empty="No upcoming tasks scheduled."
                >
                  {buckets.upcoming.slice(0, 5).map((item) => renderTask(item, formatDueLabel(item.due)))}
                </TaskSection>
            </main>
            </div>

            <aside className="min-w-0 space-y-6 text-[12px] opacity-90 xl:order-1 xl:border-r xl:border-border/60 xl:pr-6">
              <PulseSection title="Recent notes" icon={<FileText className="h-3.5 w-3.5" />} href="/notes">
                {recentNotes.length === 0 ? (
                  <div className="px-1 py-5 text-[12px] text-muted-foreground">No notes yet.</div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {recentNotes.map((note) => (
                      <Link key={note.id} href={`/notes?id=${note.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-[12px] hover:text-foreground">
                        <span className="min-w-0 truncate font-medium">{note.title}</span>
                        <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{note.tag}</span>
                          <span>{note.updated}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </PulseSection>

              <PulseSection title="Recently changed" icon={<Activity className="h-3.5 w-3.5" />} href="/activity">
                {recentActivity.length === 0 ? (
                  <div className="px-1 py-5 text-[12px] text-muted-foreground">No recent changes.</div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {recentActivity.map((item, index) => {
                      const member = members.find((m) => m.id === item.who) ?? members[0];
                      return (
                        <Link key={`${item.date}-${index}`} href="/activity" className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-[12px] hover:text-foreground">
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
                    })}
                  </div>
                )}
              </PulseSection>
            </aside>
          </div>
        </div>
        <TaskDrawer item={selectedTask} onClose={() => setSelectedTaskId(null)} />
      </div>
    </AppShell>
  );
}
