"use client";
import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { WorkItemRow } from "@/components/lovable/work-item-row";
import { useStore } from "@/lib/store";
import { type WorkItem } from "@/lib/mock-data";
import { isSameLocalDate, parseLocalDate } from "@/lib/dates";

const tabs = ["Today", "Upcoming", "Overdue", "No date", "Completed"] as const;
type Tab = (typeof tabs)[number];

type Scope = "mine" | "team" | "all";

const ME = "AM";

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function inTab(w: WorkItem, tab: Tab, today: Date): boolean {
  const due = parseLocalDate(w.due);
  const todayStart = startOfLocalDay(today);
  const sameDay = isSameLocalDate(w.due, todayStart);
  const isDone = w.status === "Done";
  if (tab === "Completed") return isDone;
  if (isDone) return false;
  if (tab === "Overdue") return !!due && due < todayStart && !sameDay;
  if (tab === "Today") return sameDay;
  if (tab === "Upcoming") return !!due && due > todayStart && !sameDay;
  if (tab === "No date") return !w.due;
  return true;
}

export default function MyTasks() {
  const [tab, setTab] = useState<Tab>("Today");
  const [scope, setScope] = useState<Scope>("mine");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const workItems = useStore((s) => s.workItems);
  const setStatus = useStore((s) => s.setWorkItemStatus);
  const deleteWorkItem = useStore((s) => s.deleteWorkItem);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const byScope = useMemo(() => {
    if (scope === "mine") return workItems.filter((w) => w.assignee === ME);
    if (scope === "team") return workItems.filter((w) => w.assignee !== ME);
    return workItems;
  }, [workItems, scope]);

  const filtered = useMemo(() => byScope.filter((w) => inTab(w, tab, now)), [byScope, now, tab]);

  const scopeCounts = useMemo(() => ({
    mine: workItems.filter((w) => w.assignee === ME && w.status !== "Done").length,
    team: workItems.filter((w) => w.assignee !== ME && w.status !== "Done").length,
    all: workItems.filter((w) => w.status !== "Done").length,
  }), [workItems]);

  const counts: Record<Tab, number> = useMemo(() => ({
    Today: byScope.filter((w) => inTab(w, "Today", now)).length,
    Upcoming: byScope.filter((w) => inTab(w, "Upcoming", now)).length,
    Overdue: byScope.filter((w) => inTab(w, "Overdue", now)).length,
    "No date": byScope.filter((w) => inTab(w, "No date", now)).length,
    Completed: byScope.filter((w) => inTab(w, "Completed", now)).length,
  }), [byScope, now]);

  const openCount = scopeCounts[scope];
  const selectedTask = selectedTaskId ? workItems.find((item) => item.id === selectedTaskId) ?? null : null;

  return (
    <AppShell title={<span className="font-medium">My Tasks</span>}>
      <div className="flex">
      <div className="min-w-0 flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">Tasks across your workspace.</p>
          <span className="text-[12px] text-muted-foreground">{openCount} open</span>
        </div>

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
            return (
              <WorkItemRow
                key={w.id}
                item={w}
                selected={selectedTaskId === w.id}
                onClick={() => setSelectedTaskId(w.id)}
                onMove={(nextStatus) => setStatus(w.id, nextStatus)}
                onDelete={() => {
                  deleteWorkItem(w.id);
                  if (selectedTaskId === w.id) setSelectedTaskId(null);
                }}
              />
            );
          })}
        </div>
      </div>
      </div>
      <TaskDrawer item={selectedTask} onClose={() => setSelectedTaskId(null)} />
      </div>
    </AppShell>
  );
}
