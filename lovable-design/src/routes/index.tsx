import { createFileRoute } from "@tanstack/react-router";
import { Plus, Mic } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { workItems, inboxItems, notes, byInitials } from "@/lib/mock-data";
import { Avatar, PriorityIcon } from "@/components/app/icons";
import { Chip } from "@/components/app/page";

export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({ meta: [
    { title: "Home — FlowBoard" },
    { name: "description", content: "Your daily command center for tasks, notes, and projects." },
  ]}),
});

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

function Row({ checkbox = true, children }: { checkbox?: boolean; children: React.ReactNode }) {
  return (
    <div className="group flex items-center gap-3 border-b px-2 py-2 text-[13px] hover:bg-hover/60">
      {checkbox && <input type="checkbox" className="h-3 w-3 accent-primary" />}
      {children}
    </div>
  );
}

function Home() {
  const today = workItems.filter((w) => w.status === "In Progress" || w.id === "FB-90").slice(0, 4);
  const overdue = workItems.filter((w) => new Date(w.due) < new Date("2026-05-16")).slice(0, 3);

  return (
    <AppShell title={<span className="font-medium">Home</span>}>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="mb-1 flex items-baseline justify-between">
          <h1 className="text-[20px] font-semibold tracking-tight">Good afternoon, Alex</h1>
          <span className="text-[12px] text-muted-foreground">Saturday, May 16</span>
        </div>
        <p className="mb-6 text-[13px] text-muted-foreground">3 in progress · 5 in inbox · 2 overdue</p>

        {/* Quick capture */}
        <div className="mb-10 flex items-center gap-2 rounded-md border bg-card px-3 py-2 focus-within:border-ring">
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Add a task, note, or reminder…"
            className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <button className="rounded p-1 text-muted-foreground hover:bg-hover"><Mic className="h-3.5 w-3.5" /></button>
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">⌘↵</kbd>
        </div>

        <Section title="Today" count={today.length}>
          {today.map((w) => {
            const m = byInitials(w.assignee);
            return (
              <Row key={w.id}>
                <PriorityIcon p={w.priority} />
                <span className="flex-1 truncate">{w.title}</span>
                <Chip>{w.label}</Chip>
                <Avatar id={m.id} name={m.name} />
                <span className="w-12 text-right text-[12px] text-muted-foreground">Today</span>
              </Row>
            );
          })}
        </Section>

        <Section title="Overdue" count={overdue.length}>
          {overdue.map((w) => {
            const m = byInitials(w.assignee);
            return (
              <Row key={w.id}>
                <PriorityIcon p={w.priority} />
                <span className="flex-1 truncate">{w.title}</span>
                <Chip tone="danger">Overdue</Chip>
                <Avatar id={m.id} name={m.name} />
                <span className="w-16 text-right text-[12px] text-red-600">2 days</span>
              </Row>
            );
          })}
        </Section>

        <Section title="Inbox" count={inboxItems.length}>
          {inboxItems.slice(0, 4).map((i) => (
            <Row key={i.id}>
              <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
              <span className="flex-1 truncate text-muted-foreground">{i.title}</span>
              <span className="text-[12px] text-muted-foreground">{i.captured}</span>
            </Row>
          ))}
        </Section>

        <Section title="Recent notes">
          {notes.slice(0, 3).map((n) => (
            <Row key={n.id} checkbox={false}>
              <span className="text-[13px] font-medium">{n.title}</span>
              <Chip>{n.tag}</Chip>
              <span className="ml-auto text-[12px] text-muted-foreground">{n.updated}</span>
            </Row>
          ))}
        </Section>
      </div>
    </AppShell>
  );
}
