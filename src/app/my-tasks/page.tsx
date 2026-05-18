"use client";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/lovable/shell";
import { PriorityIcon, Avatar, StatusIcon } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";
import { useStore } from "@/lib/store";
import { byInitials, type WorkItem, type Status, type Priority } from "@/lib/mock-data";

const tabs = ["Today", "Upcoming", "Overdue", "No date", "Completed"] as const;
type Tab = (typeof tabs)[number];

type Scope = "mine" | "team" | "all";

const ME = "AM";
const TODAY = new Date();

function inTab(w: WorkItem, tab: Tab): boolean {
  const due = new Date(w.due);
  const sameDay = due.toDateString() === TODAY.toDateString();
  const isDone = w.status === "Done";
  if (tab === "Completed") return isDone;
  if (isDone) return false;
  if (tab === "Overdue") return due < TODAY && !sameDay;
  if (tab === "Today") return sameDay;
  if (tab === "Upcoming") return due > TODAY && !sameDay;
  if (tab === "No date") return !w.due;
  return true;
}

export default function MyTasks() {
  const [tab, setTab] = useState<Tab>("Today");
  const [scope, setScope] = useState<Scope>("mine");
  const workItems = useStore((s) => s.workItems);
  const projects = useStore((s) => s.projects);
  const setStatus = useStore((s) => s.setWorkItemStatus);

  const byScope = useMemo(() => {
    if (scope === "mine") return workItems.filter((w) => w.assignee === ME);
    if (scope === "team") return workItems.filter((w) => w.assignee !== ME);
    return workItems;
  }, [workItems, scope]);

  const filtered = useMemo(() => byScope.filter((w) => inTab(w, tab)), [byScope, tab]);

  const scopeCounts = useMemo(() => ({
    mine: workItems.filter((w) => w.assignee === ME && w.status !== "Done").length,
    team: workItems.filter((w) => w.assignee !== ME && w.status !== "Done").length,
    all: workItems.filter((w) => w.status !== "Done").length,
  }), [workItems]);

  const counts: Record<Tab, number> = useMemo(() => ({
    Today: byScope.filter((w) => inTab(w, "Today")).length,
    Upcoming: byScope.filter((w) => inTab(w, "Upcoming")).length,
    Overdue: byScope.filter((w) => inTab(w, "Overdue")).length,
    "No date": byScope.filter((w) => inTab(w, "No date")).length,
    Completed: byScope.filter((w) => inTab(w, "Completed")).length,
  }), [byScope]);

  const openCount = scopeCounts[scope];

  return (
    <AppShell title={<span className="font-medium">My Tasks</span>}>
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-1 flex items-baseline justify-between">
          <h1 className="text-[20px] font-semibold tracking-tight">My Tasks</h1>
          <span className="text-[12px] text-muted-foreground">{openCount} open</span>
        </div>
        <p className="mb-4 text-[13px] text-muted-foreground">Tasks across your workspace.</p>

        {/* Scope filter: Mine / Team / All */}
        <div className="mb-3 flex items-center gap-1 text-[13px]">
          <button onClick={() => setScope("mine")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium ${scope === "mine" ? "bg-[var(--color-hover)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <span>Assigned to me</span>
            <span className="text-[11px] text-muted-foreground">({scopeCounts.mine})</span>
          </button>
          <button onClick={() => setScope("team")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium ${scope === "team" ? "bg-[var(--color-hover)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <span>Team</span>
            <span className="text-[11px] text-muted-foreground">({scopeCounts.team})</span>
          </button>
          <button onClick={() => setScope("all")}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium ${scope === "all" ? "bg-[var(--color-hover)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <span>All Tasks</span>
            <span className="text-[11px] text-muted-foreground">({scopeCounts.all})</span>
          </button>
        </div>

        {/* Date tabs */}
        <div className="mb-3 flex items-center gap-1 text-[13px] border-b">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`relative flex items-center gap-1.5 rounded-t px-2.5 py-2 ${tab === t ? "bg-transparent text-foreground font-semibold border-b-2 border-foreground -mb-px" : "text-muted-foreground hover:text-foreground"}`}>
              <span>{t}</span>
              <span className="text-[11px] text-muted-foreground">{counts[t]}</span>
            </button>
          ))}
        </div>

        <div className="border-t">
          {filtered.length === 0 && (
            <div className="px-3 py-12 text-center text-[13px] text-muted-foreground">Nothing here.</div>
          )}
          {filtered.map((w) => {
            const m = byInitials(w.assignee);
            const projectName = projects.find((p) => p.id === w.project)?.name ?? w.project;
            return (
              <div key={w.id} className="group flex w-full items-center gap-3 border-b px-2 py-2 text-[13px] hover:bg-[var(--color-hover)]/60">
              <input
                type="checkbox"
                checked={w.status === "Done"}
                onChange={() => setStatus(w.id, w.status === "Done" ? "In Progress" : "Done")}
                className="h-3.5 w-3.5 accent-[var(--color-primary)]"
              />
              <span className="font-mono text-[11px] text-muted-foreground">{w.id}</span>
              <span className={`flex-1 truncate ${w.status === "Done" ? "line-through text-muted-foreground" : ""}`}>{w.title}</span>
              <StatusIcon s={w.status} />
              <PriorityIcon p={w.priority} />
              <Chip>{projectName}</Chip>
              <Avatar id={m.id} name={m.name} />
              <span className="w-16 text-right text-[12px] text-muted-foreground">{new Date(w.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
