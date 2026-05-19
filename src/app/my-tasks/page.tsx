"use client";
import { useEffect, useState, useMemo } from "react";
import { ArrowRight, Check, Trash2 } from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { WorkItemRow } from "@/components/lovable/work-item-row";
import { useStore } from "@/lib/store";
import { type Status, type WorkItem } from "@/lib/mock-data";
import { isSameLocalDate, parseLocalDate } from "@/lib/dates";

const tabs = ["Today", "Upcoming", "Overdue", "Blocked", "No date", "Completed"] as const;
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
  if (tab === "Blocked") {
    const looksBlocked = w.status === "In Review" || /block/i.test(w.title) || /block/i.test(w.label);
    return looksBlocked;
  }
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
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
    Blocked: byScope.filter((w) => inTab(w, "Blocked", now)).length,
    "No date": byScope.filter((w) => inTab(w, "No date", now)).length,
    Completed: byScope.filter((w) => inTab(w, "Completed", now)).length,
  }), [byScope, now]);

  const openCount = scopeCounts[scope];
  const selectedTask = selectedTaskId ? workItems.find((item) => item.id === selectedTaskId) ?? null : null;
  const selectedVisibleIds = useMemo(
    () => filtered.filter((w) => selectedIds.has(w.id)).map((w) => w.id),
    [filtered, selectedIds]
  );
  const selectedCount = selectedVisibleIds.length;
  const allVisibleSelected = filtered.length > 0 && selectedCount === filtered.length;
  const movableStatuses: Status[] = ["Backlog", "To Do", "In Progress", "In Review"];

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) {
        filtered.forEach((w) => next.delete(w.id));
      } else {
        filtered.forEach((w) => next.add(w.id));
      }
      return next;
    });
  };

  const bulkSetStatus = (status: Status) => {
    selectedVisibleIds.forEach((id) => setStatus(id, status));
    setSelectedIds((current) => {
      const next = new Set(current);
      selectedVisibleIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const bulkDelete = () => {
    selectedVisibleIds.forEach((id) => deleteWorkItem(id));
    if (selectedTaskId && selectedVisibleIds.includes(selectedTaskId)) {
      setSelectedTaskId(null);
    }
    setSelectedIds((current) => {
      const next = new Set(current);
      selectedVisibleIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  return (
    <AppShell title={<span className="font-medium">My Tasks</span>}>
      <div className="flex">
      <div className="min-w-0 flex-1">
      <div className="mx-auto w-full max-w-5xl px-6 py-8">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[13px] text-muted-foreground">Tasks across your workspace.</p>
          <span className="text-[12px] text-muted-foreground">{openCount} open</span>
        </div>

        <div className="mb-3 flex min-h-8 flex-wrap items-center justify-between gap-2 text-[12px]">
          {selectedCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-1 font-medium">{selectedCount} selected</span>
              <button onClick={() => bulkSetStatus("Done")} className="lov-btn lov-btn-primary h-7 px-2">
                <Check className="h-3 w-3" />
                Complete
              </button>
              {movableStatuses.map((status) => (
                <button key={status} onClick={() => bulkSetStatus(status)} className="lov-btn h-7 px-2">
                  <ArrowRight className="h-3 w-3" />
                  {status}
                </button>
              ))}
              <button onClick={bulkDelete} className="lov-btn lov-btn-danger h-7 px-2">
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
              <button onClick={() => setSelectedIds(new Set())} className="lov-btn lov-btn-ghost h-7 px-2">
                Clear
              </button>
            </div>
          ) : (
            <span className="text-muted-foreground">Select tasks to run bulk actions.</span>
          )}
          <button onClick={toggleSelectVisible} disabled={filtered.length === 0} className="lov-btn lov-btn-ghost h-7 px-2 disabled:opacity-50">
            {allVisibleSelected ? "Clear visible" : "Select visible"}
          </button>
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
              <div key={w.id} className="grid grid-cols-[20px_minmax(0,1fr)] items-stretch gap-1">
                <input
                  type="checkbox"
                  checked={selectedIds.has(w.id)}
                  onChange={() => toggleSelected(w.id)}
                  aria-label={`Select ${w.title}`}
                  className="mt-2 h-3.5 w-3.5 self-start accent-[var(--color-primary)]"
                />
                <WorkItemRow
                  item={w}
                  selected={selectedTaskId === w.id}
                  onClick={() => setSelectedTaskId(w.id)}
                  onMove={(nextStatus) => setStatus(w.id, nextStatus)}
                  onDelete={() => {
                    deleteWorkItem(w.id);
                    if (selectedTaskId === w.id) setSelectedTaskId(null);
                    setSelectedIds((current) => {
                      const next = new Set(current);
                      next.delete(w.id);
                      return next;
                    });
                  }}
                />
              </div>
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
