"use client";
import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Plus, Mic } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { useStore } from "@/lib/store";
import { byInitials } from "@/lib/mock-data";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-2 flex items-baseline gap-2 px-1">
        <h2 className="text-[13px] font-semibold">{title}</h2>
        {count != null && <span className="text-[11px] text-muted-foreground">{count}</span>}
      </div>
      <div className="border-t">{children}</div>
    </section>
  );
}

function Row({ checkbox = true, checked = false, onCheck, children }: { checkbox?: boolean; checked?: boolean; onCheck?: () => void; children: React.ReactNode }) {
  return (
    <div
      className="group flex items-center gap-3 border-b px-2 py-2 text-[13px] hover:bg-[var(--color-hover)]/60"
    >
      {checkbox && (
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onCheck?.()}
          onClick={(e) => e.stopPropagation()}
          className="h-3 w-3 accent-[var(--color-primary)]"
        />
      )}
      {children}
    </div>
  );
}

const TODAY_REF = new Date(); // dynamic

export default function HomePage() {
  const workItems = useStore((s) => s.workItems);
  const inboxItems = useStore((s) => s.inboxItems);
  const notes = useStore((s) => s.notes);
  const setStatus = useStore((s) => s.setWorkItemStatus);
  const addInboxItem = useStore((s) => s.addInboxItem);

  const [capture, setCapture] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedTask = workItems.find((w) => w.id === selectedTaskId) ?? null;

  const today = workItems.filter((w) => w.status === "In Progress" || w.status === "In Review").slice(0, 5);
  const overdue = workItems.filter((w) => w.status !== "Done" && new Date(w.due) < TODAY_REF).slice(0, 5);

  const completeWithUndo = (id: string) => {
    const prev = workItems.find((w) => w.id === id);
    if (!prev || prev.status === "Done") return;
    const prevStatus = prev.status;
    setStatus(id, "Done");
    toast.success(`Marked ${id} done`, {
      description: prev.title,
      duration: 6000,
      action: { label: "Undo", onClick: () => setStatus(id, prevStatus) },
    });
  };

  const onCaptureKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && capture.trim()) {
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
          <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-1 flex items-baseline justify-between">
          <h1 className="text-[20px] font-semibold tracking-tight">Good afternoon, Alex</h1>
          <span className="text-[12px] text-muted-foreground">{TODAY_REF.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</span>
        </div>
        <p className="mb-6 text-[13px] text-muted-foreground">{today.length} due today · {overdue.length} overdue · {inboxItems.length} to triage</p>

        <div className="mb-2 flex items-center gap-2 rounded-md border bg-card px-3 py-2 shadow-xs focus-within:border-ring focus-within:shadow-sm">
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={capture}
            onChange={(e) => setCapture(e.target.value)}
            onKeyDown={onCaptureKey}
            placeholder="Capture a task, note, or idea…"
            aria-label="Quick capture"
            className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            disabled
            title="Voice capture (coming soon)"
            className="rounded p-1 text-muted-foreground/40"
          >
            <Mic className="h-3.5 w-3.5" />
          </button>
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">↵</kbd>
        </div>
        <p className="mb-10 px-1 text-[11px] text-muted-foreground">
          Press <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">↵</kbd> to save. Captures land in your <a href="/inbox" className="underline decoration-dotted underline-offset-2 hover:text-foreground">Inbox</a> — a parking spot for unsorted items you triage later (assign a project, due date, or priority).
        </p>

        <Section title="Today" count={today.length}>
          {today.length === 0 && <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">Nothing on deck. Capture something above.</div>}
          {today.map((w) => {
            const m = byInitials(w.assignee);
            return (
              <Row key={w.id} checked={false} onCheck={() => completeWithUndo(w.id)}>
                <PriorityIcon p={w.priority} />
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(w.id)}
                  title={w.title}
                  className="min-w-0 flex-1 truncate text-left font-medium hover:underline focus:outline-none focus-visible:underline"
                >
                  {w.title}
                </button>
                <Chip>{w.label}</Chip>
                <Avatar id={m.id} name={m.name} />
                <span className="w-24 shrink-0 whitespace-nowrap text-right text-[12px] text-muted-foreground">{w.status}</span>
              </Row>
            );
          })}
        </Section>

        <Section title="Overdue" count={overdue.length}>
          {overdue.length === 0 && <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">No overdue work.</div>}
          {overdue.map((w) => {
            const m = byInitials(w.assignee);
            const daysLate = Math.max(1, Math.floor((+TODAY_REF - +new Date(w.due)) / 86400000));
            return (
              <Row key={w.id} checked={false} onCheck={() => completeWithUndo(w.id)}>
                <PriorityIcon p={w.priority} />
                <button
                  type="button"
                  onClick={() => setSelectedTaskId(w.id)}
                  title={w.title}
                  className="min-w-0 flex-1 truncate text-left font-medium hover:underline focus:outline-none focus-visible:underline"
                >
                  {w.title}
                </button>
                <Chip tone="danger">Overdue</Chip>
                <Avatar id={m.id} name={m.name} />
                <span className="w-16 shrink-0 whitespace-nowrap text-right text-[12px] text-red-600">{daysLate}d</span>
              </Row>
            );
          })}
        </Section>

        <Section title="Inbox · to triage" count={inboxItems.length}>
          {inboxItems.length === 0 && <div className="px-2 py-6 text-center text-[12px] text-muted-foreground">Inbox zero.</div>}
          {inboxItems.slice(0, 5).map((i) => (
            <Row key={i.id} checkbox={false}>
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              <span className="flex-1 truncate text-muted-foreground">{i.title}</span>
              <span className="text-[12px] text-muted-foreground">{i.captured}</span>
            </Row>
          ))}
        </Section>

        <Section title="Recent notes">
          {notes.slice(0, 3).map((n) => (
            <Link
              key={n.id}
              href={`/notes?id=${n.id}`}
              className="group flex items-center gap-3 border-b px-2 py-2 text-[13px] hover:bg-[var(--color-hover)]/60"
            >
              <span className="truncate text-[13px] font-medium">{n.title}</span>
              <Chip>{n.tag}</Chip>
              <span className="ml-auto whitespace-nowrap text-[12px] text-muted-foreground">{n.updated}</span>
            </Link>
          ))}
        </Section>
          </div>
        </div>
        <TaskDrawer item={selectedTask} onClose={() => setSelectedTaskId(null)} />
      </div>
    </AppShell>
  );
}
