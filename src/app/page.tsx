"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { useStore } from "@/lib/store";
import { byInitials, type WorkItem } from "@/lib/mock-data";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function compareDateKey(a: string, b: string) {
  return a.localeCompare(b);
}

function formatDueLabel(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Section({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {count != null && <span className="text-[11px] text-muted-foreground">{count}</span>}
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      <div className="border-t">{children}</div>
    </section>
  );
}

function TaskRow({
  item,
  meta,
  onOpen,
  onComplete,
}: {
  item: WorkItem;
  meta: React.ReactNode;
  onOpen: () => void;
  onComplete: () => void;
}) {
  const member = byInitials(item.assignee);

  return (
    <div className="group flex items-center gap-3 border-b px-2 py-2 text-[13px] hover:bg-[var(--color-hover)]/60">
      <input
        type="checkbox"
        checked={item.status === "Done"}
        onChange={onComplete}
        onClick={(event) => event.stopPropagation()}
        className="h-3.5 w-3.5 accent-[var(--color-primary)]"
        aria-label={`Complete ${item.title}`}
      />
      <PriorityIcon p={item.priority} />
      <button
        type="button"
        onClick={onOpen}
        title={item.title}
        className="min-w-0 flex-1 truncate text-left font-medium hover:underline focus:outline-none focus-visible:underline"
      >
        {item.title}
      </button>
      <Chip>{item.label}</Chip>
      <Avatar id={member.id} name={member.name} />
      <span className="shrink-0 whitespace-nowrap text-right text-[12px] text-muted-foreground">{meta}</span>
    </div>
  );
}

function InboxRow({ title, captured }: { title: string; captured: string }) {
  return (
    <div className="flex items-center gap-3 border-b px-2 py-2 text-[13px] hover:bg-[var(--color-hover)]/60">
      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
      <span className="min-w-0 flex-1 truncate text-muted-foreground">{title}</span>
      <span className="shrink-0 text-[12px] text-muted-foreground">{captured}</span>
    </div>
  );
}

const TODAY_REF = new Date();

export default function HomePage() {
  const workItems = useStore((state) => state.workItems);
  const inboxItems = useStore((state) => state.inboxItems);
  const notes = useStore((state) => state.notes);
  const setStatus = useStore((state) => state.setWorkItemStatus);
  const addInboxItem = useStore((state) => state.addInboxItem);

  const [capture, setCapture] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = workItems.find((item) => item.id === selectedTaskId) ?? null;

  const todayKey = localDateKey(TODAY_REF);
  const openItems = workItems.filter((item) => item.status !== "Done");
  const today = openItems.filter((item) => item.due === todayKey).slice(0, 5);
  const overdue = openItems
    .filter((item) => item.due && compareDateKey(item.due, todayKey) < 0)
    .sort((a, b) => compareDateKey(a.due, b.due))
    .slice(0, 5);
  const active = openItems
    .filter((item) => (item.status === "In Progress" || item.status === "In Review") && item.due !== todayKey)
    .slice(0, 5);

  const completeWithUndo = (id: string) => {
    const previous = workItems.find((item) => item.id === id);
    if (!previous || previous.status === "Done") return;

    setStatus(id, "Done");
    toast.success(`Marked ${id} done`, {
      description: previous.title,
      duration: 6000,
      action: { label: "Undo", onClick: () => setStatus(id, previous.status) },
    });
  };

  const onCaptureKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && capture.trim()) {
      const text = capture.trim();
      addInboxItem(text);
      toast.success("Captured to Inbox", { description: text });
      setCapture("");
    }
  };

  return (
    <AppShell title={<span className="font-medium">Home</span>}>
      <div className="flex h-full">
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
          <div className="mx-auto grid max-w-6xl gap-8 px-5 py-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)] lg:px-8">
            <div className="min-w-0">
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <h1 className="text-[20px] font-semibold tracking-tight">Good afternoon, Alex</h1>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {TODAY_REF.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </span>
              </div>
              <p className="mb-5 text-[13px] text-muted-foreground">
                {today.length} due today - {overdue.length} overdue - {inboxItems.length} to triage
              </p>

              <div className="mb-2 flex items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-xs focus-within:border-ring focus-within:shadow-sm">
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={capture}
                  onChange={(event) => setCapture(event.target.value)}
                  onKeyDown={onCaptureKey}
                  placeholder="Capture a task, note, or idea..."
                  aria-label="Quick capture"
                  className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                />
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Enter</kbd>
              </div>
              <p className="mb-8 px-1 text-[11px] text-muted-foreground">
                Captures land in your{" "}
                <Link href="/inbox" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                  Inbox
                </Link>{" "}
                so you can assign a project, due date, or priority later.
              </p>

              <Section title="Today" count={today.length}>
                {today.length === 0 ? (
                  <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">
                    Nothing due today. Capture new work above or clear overdue items first.
                  </div>
                ) : (
                  today.map((item) => (
                    <TaskRow
                      key={item.id}
                      item={item}
                      meta={item.status}
                      onOpen={() => setSelectedTaskId(item.id)}
                      onComplete={() => completeWithUndo(item.id)}
                    />
                  ))
                )}
              </Section>

              <Section title="Overdue" count={overdue.length}>
                {overdue.length === 0 ? (
                  <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">No overdue work.</div>
                ) : (
                  overdue.map((item) => {
                    const daysLate = Math.max(1, Math.floor((+TODAY_REF - +new Date(`${item.due}T00:00:00`)) / 86400000));
                    return (
                      <TaskRow
                        key={item.id}
                        item={item}
                        meta={<span className="text-red-600">{daysLate}d</span>}
                        onOpen={() => setSelectedTaskId(item.id)}
                        onComplete={() => completeWithUndo(item.id)}
                      />
                    );
                  })
                )}
              </Section>

              <Section title="Active work" count={active.length}>
                {active.length === 0 ? (
                  <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">No active work outside today.</div>
                ) : (
                  active.map((item) => (
                    <TaskRow
                      key={item.id}
                      item={item}
                      meta={item.due ? formatDueLabel(item.due) : item.status}
                      onOpen={() => setSelectedTaskId(item.id)}
                      onComplete={() => completeWithUndo(item.id)}
                    />
                  ))
                )}
              </Section>
            </div>

            <aside className="min-w-0 lg:border-l lg:pl-8">
              <Section
                title="Inbox to triage"
                count={inboxItems.length}
                action={
                  <Link href="/inbox" className="text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
                    Open
                  </Link>
                }
              >
                {inboxItems.length === 0 ? (
                  <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">Inbox zero.</div>
                ) : (
                  inboxItems.slice(0, 6).map((item) => <InboxRow key={item.id} title={item.title} captured={item.captured} />)
                )}
              </Section>

              <Section title="Recent notes">
                {notes.slice(0, 5).map((note) => (
                  <Link
                    key={note.id}
                    href={`/notes?id=${note.id}`}
                    className="group flex items-center gap-3 border-b px-2 py-2 text-[13px] hover:bg-[var(--color-hover)]/60"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{note.title}</span>
                    <Chip>{note.tag}</Chip>
                    <span className="shrink-0 whitespace-nowrap text-[12px] text-muted-foreground">{note.updated}</span>
                  </Link>
                ))}
              </Section>
            </aside>
          </div>
        </div>
        <TaskDrawer item={selectedTask} onClose={() => setSelectedTaskId(null)} />
      </div>
    </AppShell>
  );
}
