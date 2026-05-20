"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, Inbox, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { ProjectIcon } from "@/components/lovable/project-icon";
import { type Priority, type WorkItem } from "@/lib/mock-data";
import { getServerSession } from "@/lib/server-session-client";
import {
  type ApiProject,
  type ApiWorkItem,
  toApiWorkPriority,
  toApiWorkStatus,
  toUiProject,
  toUiWorkItem,
} from "@/lib/server-ui-mappers";

function relativeLabel(value?: string) {
  if (!value) return "recent";
  const diffMs = Date.now() - new Date(value).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  return `${days}d ago`;
}

export default function InboxPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Array<ReturnType<typeof toUiProject>>>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [capturedAt, setCapturedAt] = useState<Record<string, string>>({});
  const [captureValue, setCaptureValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const inboxItems = useMemo(
    () => workItems.filter((item) => item.status === "Backlog"),
    [workItems]
  );
  const selectedCount = selectedIds.size;
  const allSelected = inboxItems.length > 0 && selectedIds.size === inboxItems.length;
  const selectedTask = selectedTaskId ? workItems.find((item) => item.id === selectedTaskId) ?? null : null;

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
        setMembers((session.members ?? []).map((member) => ({ id: member.id, name: member.name })));

        const [projectsRes, workItemsRes] = await Promise.all([
          fetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          fetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);
        if (!projectsRes.ok) throw new Error("Failed to load projects");
        if (!workItemsRes.ok) throw new Error("Failed to load inbox captures");

        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const itemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        if (!active) return;

        const nextCaptured: Record<string, string> = {};
        itemsPayload.workItems.forEach((item) => {
          nextCaptured[item.id] = relativeLabel(item.createdAt ?? item.updatedAt);
        });
        setCapturedAt(nextCaptured);
        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        setWorkItems(itemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id)));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load Inbox");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const patchWorkItem = async (id: string, localPatch: Partial<WorkItem>, apiPatch: Record<string, unknown>) => {
    if (!workspaceId) return false;
    const snapshot = workItems;
    setWorkItems((current) => current.map((item) => (item.id === id ? { ...item, ...localPatch } : item)));

    const response = await fetch(
      `/api/work-items/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": currentUserId ?? "",
        },
        body: JSON.stringify(apiPatch),
      }
    );

    if (!response.ok) {
      setWorkItems(snapshot);
      setError("Failed to update capture");
      return false;
    }
    return true;
  };

  const deleteWorkItem = async (id: string) => {
    if (!workspaceId) return false;
    const snapshot = workItems;
    setWorkItems((current) => current.filter((item) => item.id !== id));

    const response = await fetch(
      `/api/work-items/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      { method: "DELETE" }
    );
    if (!response.ok) {
      setWorkItems(snapshot);
      setError("Failed to delete capture");
      return false;
    }
    return true;
  };

  const createCapture = async (title: string) => {
    if (!workspaceId) return;
    const response = await fetch("/api/work-items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify({
        workspaceId,
        title,
        status: "BACKLOG",
        priority: "MEDIUM",
      }),
    });
    if (!response.ok) {
      setError("Failed to capture item");
      return;
    }
    const payload = (await response.json()) as { workItem: ApiWorkItem };
    setWorkItems((current) => [toUiWorkItem(payload.workItem, currentUserId), ...current]);
    setCapturedAt((current) => ({ ...current, [payload.workItem.id]: "just now" }));
    toast.success("Captured to Inbox");
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(inboxItems.map((item) => item.id)));
  };

  const bulkUpdate = async (patch: Partial<WorkItem>, label: string) => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const apiPatch: Record<string, unknown> = {};
      if (patch.project !== undefined) apiPatch.projectId = patch.project;
      if (patch.due !== undefined) apiPatch.dueDate = patch.due ? `${patch.due}T00:00:00.000Z` : undefined;
      if (patch.priority !== undefined) apiPatch.priority = toApiWorkPriority(patch.priority);
      await patchWorkItem(id, patch, apiPatch);
    }
    toast.success(`${label} on ${selectedCount} capture${selectedCount === 1 ? "" : "s"}`);
  };

  const bulkPromote = async () => {
    const ids = Array.from(selectedIds);
    const promoted: string[] = [];
    for (const id of ids) {
      const ok = await patchWorkItem(id, { status: "To Do" }, { status: toApiWorkStatus("To Do"), completedAt: null });
      if (ok) promoted.push(id);
    }
    if (promoted[0]) setSelectedTaskId(promoted[0]);
    setSelectedIds(new Set());
    toast.success(`Sent ${promoted.length} capture${promoted.length === 1 ? "" : "s"} to tasks`);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    let deleted = 0;
    for (const id of ids) {
      const ok = await deleteWorkItem(id);
      if (ok) deleted += 1;
    }
    toast(`Deleted ${deleted} capture${deleted === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
  };

  const clearAll = async () => {
    if (inboxItems.length === 0) return;
    if (!window.confirm(`Clear all ${inboxItems.length} inbox capture${inboxItems.length === 1 ? "" : "s"}?`)) return;
    for (const item of inboxItems) {
      await deleteWorkItem(item.id);
    }
    setSelectedIds(new Set());
    toast.success("Inbox cleared");
  };

  return (
    <AppShell
      title={
        <div className="flex items-baseline gap-2">
          <span className="font-medium">Inbox</span>
          <span className="text-[12px] text-muted-foreground">
            {inboxItems.length} open capture{inboxItems.length === 1 ? "" : "s"}
          </span>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
        {error && <div className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
        {loading && <div className="mb-3 text-[12px] text-muted-foreground">Loading inbox data...</div>}
        <section className="min-w-0">
          <div className="mb-2 flex min-h-8 items-center justify-between gap-3">
            <h1 className="inline-flex items-center gap-1.5 text-[13px] font-semibold tracking-tight">
              <Inbox className="h-3.5 w-3.5" />
              Captures
            </h1>
            {selectedCount > 0 ? (
              <div className="flex flex-wrap items-center justify-end gap-2 text-[12px]">
                <span className="px-1 font-medium">{selectedCount} selected</span>
                <BulkMenu label="Project">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => { void bulkUpdate({ project: project.id }, `Set project to ${project.name}`); }}
                      className="lov-menu-item"
                    >
                      <ProjectIcon name={project.icon} accent={project.accent} />
                      {project.name}
                    </button>
                  ))}
                </BulkMenu>
                <BulkMenu label="Due">
                  {[
                    { label: "Today", days: 0 },
                    { label: "Tomorrow", days: 1 },
                    { label: "In 3 days", days: 3 },
                    { label: "Next week", days: 7 },
                  ].map((option) => (
                    <button
                      key={option.label}
                      onClick={() => {
                        const date = new Date();
                        date.setDate(date.getDate() + option.days);
                        void bulkUpdate({ due: date.toISOString().slice(0, 10) }, "Set due date");
                      }}
                      className="lov-menu-item"
                    >
                      {option.label}
                    </button>
                  ))}
                </BulkMenu>
                <BulkMenu label="Priority">
                  {(["High", "Medium", "Low"] as Priority[]).map((priority) => (
                    <button
                      key={priority}
                      onClick={() => { void bulkUpdate({ priority }, `Set priority to ${priority}`); }}
                      className="lov-menu-item"
                    >
                      {priority}
                    </button>
                  ))}
                </BulkMenu>
                <button onClick={() => { void bulkPromote(); }} className="lov-btn lov-btn-primary">
                  <Check className="h-3 w-3" />
                  Send to tasks
                </button>
                <button onClick={() => { void bulkDelete(); }} className="lov-btn lov-btn-danger">
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="lov-btn lov-btn-ghost">
                  Clear
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                <span>Project, due, priority, then send to tasks.</span>
                <button onClick={() => { void clearAll(); }} disabled={inboxItems.length === 0} className="lov-btn lov-btn-ghost h-7 px-2">
                  Clear all
                </button>
                <label className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={inboxItems.length === 0}
                    className="h-3.5 w-3.5 shrink-0 appearance-auto accent-[var(--color-primary)] disabled:opacity-40"
                  />
                  Select all
                </label>
              </div>
            )}
          </div>

          <div className="border-t border-border/70">
            <div className="grid grid-cols-[24px_minmax(120px,1fr)_minmax(104px,0.65fr)_minmax(72px,0.45fr)_minmax(80px,0.45fr)_112px_24px_56px] items-center gap-3 border-b border-border/60 px-2 py-[var(--fb-row-py)]">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={captureValue}
                onChange={(e) => setCaptureValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && captureValue.trim()) {
                    void createCapture(captureValue.trim());
                    setCaptureValue("");
                  }
                }}
                placeholder="Capture a thought, task, or idea."
                className="h-7 min-w-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
              />
              <span className="text-[11px] text-muted-foreground">Project</span>
              <span className="text-[11px] text-muted-foreground">Due</span>
              <span className="text-[11px] text-muted-foreground">Priority</span>
              <span />
              <span />
              <kbd className="justify-self-end rounded border bg-muted px-1 font-mono text-[10px] text-muted-foreground">Enter</kbd>
            </div>

            {inboxItems.map((item) => {
              const assignedProject = item.project ? projects.find((p) => p.id === item.project) : null;
              const ready = Boolean(item.project || item.due || item.priority);
              const selected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`group grid grid-cols-[24px_minmax(120px,1fr)_minmax(104px,0.65fr)_minmax(72px,0.45fr)_minmax(80px,0.45fr)_112px_24px_56px] items-center gap-3 border-b border-border/60 px-2 py-[var(--fb-row-py)] text-[13px] hover:bg-[var(--color-hover)]/60 ${selected ? "bg-[var(--color-hover)]/50" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelected(item.id)}
                    aria-label={`Select ${item.title}`}
                    className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                  />
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="min-w-0 truncate font-medium">{item.title}</span>
                  </div>
                  <ProjectChip
                    assigned={assignedProject ? { id: assignedProject.id, name: assignedProject.name, accent: assignedProject.accent, icon: assignedProject.icon } : null}
                    items={projects.map((p) => ({ id: p.id, name: p.name, accent: p.accent, icon: p.icon }))}
                    onPick={(pid) => { void patchWorkItem(item.id, { project: pid }, { projectId: pid }); }}
                    onClear={() => {}}
                  />
                  <DueChip
                    assigned={item.due ?? null}
                    onPick={(due) => { void patchWorkItem(item.id, { due }, { dueDate: `${due}T00:00:00.000Z` }); }}
                    onClear={() => {}}
                  />
                  <PriorityChip
                    assigned={item.priority ?? null}
                    onPick={(p) => { void patchWorkItem(item.id, { priority: p }, { priority: toApiWorkPriority(p) }); }}
                    onClear={() => {}}
                  />
                  <button
                    onClick={() => {
                      void (async () => {
                        const ok = await patchWorkItem(item.id, { status: "To Do" }, { status: toApiWorkStatus("To Do"), completedAt: null });
                        if (!ok) return;
                        setSelectedTaskId(item.id);
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          next.delete(item.id);
                          return next;
                        });
                        toast.success("Sent capture to tasks");
                      })();
                    }}
                    title="Send to tasks"
                    className={`lov-btn lov-btn-primary h-7 w-[112px] justify-center whitespace-nowrap px-1.5 text-[11px] ${ready ? "" : "opacity-90"}`}
                  >
                    <Check className="h-3 w-3" />
                    Send to tasks
                  </button>
                  <button
                    onClick={() => {
                      void (async () => {
                        const ok = await deleteWorkItem(item.id);
                        if (!ok) return;
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          next.delete(item.id);
                          return next;
                        });
                      })();
                    }}
                    title="Remove capture"
                    className="lov-icon-btn opacity-0 hover:text-red-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <span className="truncate text-right text-[11px] text-muted-foreground">{capturedAt[item.id] ?? "recent"}</span>
                </div>
              );
            })}

            <div className="px-2 py-10 text-center">
              <p className="text-[13px] text-muted-foreground">
                {inboxItems.length === 0 ? "Inbox is clear." : "End of captures."}
              </p>
            </div>
          </div>
        </section>
        <TaskDrawer
          item={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          membersOverride={members}
          projectsOverride={projects}
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

function BulkMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} className="lov-btn">
        {label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onMouseDown={() => setOpen(false)} />
          <div className="absolute left-0 z-[80] mt-1 min-w-56 rounded-md border bg-popover py-1 shadow-md" onClick={() => setOpen(false)}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

function ProjectChip({
  assigned,
  items,
  onPick,
  onClear,
}: {
  assigned: { id: string; name: string; accent: string; icon?: string } | null;
  items: { id: string; name: string; accent: string; icon?: string }[];
  onPick: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (assigned) {
    return (
      <ChipButton onClear={onClear}>
        <ProjectIcon name={assigned.icon} accent={assigned.accent} size={12} />
        {assigned.name}
      </ChipButton>
    );
  }
  return (
    <MenuButton label="+ project" open={open} setOpen={setOpen} width="w-64">
      {items.map((p) => (
        <button
          key={p.id}
          onClick={() => {
            onPick(p.id);
            setOpen(false);
          }}
          className="lov-menu-item"
        >
          <ProjectIcon name={p.icon} accent={p.accent} size={12} />
          {p.name}
        </button>
      ))}
    </MenuButton>
  );
}

function DueChip({ assigned, onPick, onClear }: { assigned: string | null; onPick: (iso: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  if (assigned) {
    const label = new Date(`${assigned}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return <ChipButton onClear={onClear}>{label}</ChipButton>;
  }
  const options = [{ label: "Today", days: 0 }, { label: "Tomorrow", days: 1 }, { label: "In 3 days", days: 3 }, { label: "Next week", days: 7 }];
  return (
    <MenuButton label="+ due" open={open} setOpen={setOpen} width="w-40">
      {options.map((o) => (
        <button
          key={o.label}
          onClick={() => {
            const d = new Date();
            d.setDate(d.getDate() + o.days);
            onPick(d.toISOString().slice(0, 10));
            setOpen(false);
          }}
          className="lov-menu-item"
        >
          {o.label}
        </button>
      ))}
    </MenuButton>
  );
}

function PriorityChip({ assigned, onPick, onClear }: { assigned: Priority | null; onPick: (p: Priority) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const colorMap: Record<Priority, string> = { High: "text-red-600", Medium: "text-amber-600", Low: "text-blue-600" };
  if (assigned) return <ChipButton onClear={onClear} className={colorMap[assigned]}>{assigned}</ChipButton>;
  return (
    <MenuButton label="+ priority" open={open} setOpen={setOpen} width="w-36">
      {(["High", "Medium", "Low"] as Priority[]).map((p) => (
        <button
          key={p}
          onClick={() => {
            onPick(p);
            setOpen(false);
          }}
          className={`lov-menu-item ${colorMap[p]}`}
        >
          {p}
        </button>
      ))}
    </MenuButton>
  );
}

function ChipButton({ children, onClear, className = "" }: { children: ReactNode; onClear: () => void; className?: string }) {
  return (
    <span className={`inline-flex h-6 max-w-40 items-center gap-1 rounded border px-1.5 text-[11px] ${className}`}>
      <span className="inline-flex min-w-0 items-center gap-1 truncate">{children}</span>
      <ChevronDown className="h-3 w-3 text-muted-foreground" />
      <button onClick={onClear} className="lov-icon-btn h-4 w-4"><X className="h-2.5 w-2.5" /></button>
    </span>
  );
}

function MenuButton({ label, open, setOpen, children, width = "w-44" }: { label: string; open: boolean; setOpen: (open: boolean) => void; children: ReactNode; width?: string }) {
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="lov-btn lov-btn-ghost h-6 whitespace-nowrap border-dashed px-1.5 text-[11px]">
        {label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onMouseDown={() => setOpen(false)} />
          <div className={`absolute right-0 z-[80] mt-1 ${width} rounded-md border bg-popover py-1 shadow-md`}>{children}</div>
        </>
      )}
    </div>
  );
}
