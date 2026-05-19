"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Inbox, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { ProjectIcon } from "@/components/lovable/project-icon";
import { useStore } from "@/lib/store";
import { type Priority } from "@/lib/mock-data";

export default function InboxPage() {
  const inboxItems = useStore((s) => s.inboxItems);
  const projects = useStore((s) => s.projects);
  const workItems = useStore((s) => s.workItems);
  const removeInboxItem = useStore((s) => s.removeInboxItem);
  const updateInboxItem = useStore((s) => s.updateInboxItem);
  const inboxToWorkItem = useStore((s) => s.inboxToWorkItem);
  const addInboxItem = useStore((s) => s.addInboxItem);
  const [captureValue, setCaptureValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingCreateIds, setPendingCreateIds] = useState<string[] | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedCount = selectedIds.size;
  const allSelected = inboxItems.length > 0 && selectedIds.size === inboxItems.length;
  const selectedTask = selectedTaskId ? workItems.find((item) => item.id === selectedTaskId) ?? null : null;

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

  const bulkUpdate = (patch: Parameters<typeof updateInboxItem>[1], label: string) => {
    selectedIds.forEach((id) => updateInboxItem(id, patch));
    toast.success(`${label} on ${selectedCount} capture${selectedCount === 1 ? "" : "s"}`);
  };

  const bulkPromote = () => {
    setPendingCreateIds([...selectedIds]);
  };

  const bulkDelete = () => {
    selectedIds.forEach((id) => removeInboxItem(id));
    toast(`Deleted ${selectedCount} capture${selectedCount === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
  };

  const clearAll = () => {
    if (inboxItems.length === 0) return;
    if (!window.confirm(`Clear all ${inboxItems.length} inbox capture${inboxItems.length === 1 ? "" : "s"}?`)) return;
    inboxItems.forEach((item) => removeInboxItem(item.id));
    setSelectedIds(new Set());
    toast.success("Inbox cleared");
  };

  const confirmCreateTasks = () => {
    if (!pendingCreateIds?.length) return;
    const createdIds: string[] = [];
    pendingCreateIds.forEach((id) => {
      const createdId = inboxToWorkItem(id);
      if (createdId) createdIds.push(createdId);
    });
    setSelectedIds((current) => {
      const next = new Set(current);
      pendingCreateIds.forEach((id) => next.delete(id));
      return next;
    });
    setPendingCreateIds(null);
    if (createdIds[0]) setSelectedTaskId(createdIds[0]);
    toast.success(`Created ${createdIds.length} task${createdIds.length === 1 ? "" : "s"}`, {
      description: createdIds[0] ? "Opened the first task for editing." : undefined,
    });
  };

  return (
    <AppShell
      title={
        <div className="flex items-baseline gap-2">
          <span className="font-medium">Inbox</span>
          <span className="text-[12px] text-muted-foreground">{inboxItems.length} open capture{inboxItems.length === 1 ? "" : "s"}</span>
        </div>
      }
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
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
                      onClick={() => bulkUpdate({ project: project.id }, `Set project to ${project.name}`)}
                      className="lov-menu-item"
                    >
                      <ProjectIcon name={project.icon} accent={project.accent} />
                      {project.name}
                    </button>
                  ))}
                </BulkMenu>
                <BulkMenu label="Due">
                  {[{ label: "Today", days: 0 }, { label: "Tomorrow", days: 1 }, { label: "In 3 days", days: 3 }, { label: "Next week", days: 7 }].map((option) => (
                    <button
                      key={option.label}
                      onClick={() => {
                        const date = new Date();
                        date.setDate(date.getDate() + option.days);
                        bulkUpdate({ due: date.toISOString().slice(0, 10) }, `Set due date`);
                      }}
                      className="lov-menu-item"
                    >
                      {option.label}
                    </button>
                  ))}
                </BulkMenu>
                <BulkMenu label="Priority">
                  {(["High", "Medium", "Low"] as Priority[]).map((priority) => (
                    <button key={priority} onClick={() => bulkUpdate({ priority }, `Set priority to ${priority}`)} className="lov-menu-item">
                      {priority}
                    </button>
                  ))}
                </BulkMenu>
                <button onClick={bulkPromote} className="lov-btn lov-btn-primary">
                  <Check className="h-3 w-3" />
                  Create tasks
                </button>
                <button onClick={bulkDelete} className="lov-btn lov-btn-danger">
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
                <button onClick={() => setSelectedIds(new Set())} className="lov-btn lov-btn-ghost">
                  Clear
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[12px] text-muted-foreground">
                <span>Project, due, priority, then create tasks.</span>
                <button onClick={clearAll} disabled={inboxItems.length === 0} className="lov-btn lov-btn-ghost h-7 px-2">
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
                    addInboxItem(captureValue.trim());
                    setCaptureValue("");
                    toast.success("Captured to triage");
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
                <div key={item.id} className={`group grid grid-cols-[24px_minmax(120px,1fr)_minmax(104px,0.65fr)_minmax(72px,0.45fr)_minmax(80px,0.45fr)_112px_24px_56px] items-center gap-3 border-b border-border/60 px-2 py-[var(--fb-row-py)] text-[13px] hover:bg-[var(--color-hover)]/60 ${selected ? "bg-[var(--color-hover)]/50" : ""}`}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelected(item.id)}
                    aria-label={`Select ${item.title}`}
                    className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                  />
                  <span className="min-w-0 truncate font-medium">{item.title}</span>
                  <ProjectChip
                    assigned={assignedProject ? { id: assignedProject.id, name: assignedProject.name, accent: assignedProject.accent, icon: assignedProject.icon } : null}
                    items={projects.map((p) => ({ id: p.id, name: p.name, accent: p.accent, icon: p.icon }))}
                    onPick={(pid) => updateInboxItem(item.id, { project: pid })}
                    onClear={() => updateInboxItem(item.id, { project: undefined })}
                  />
                  <DueChip assigned={item.due ?? null} onPick={(due) => updateInboxItem(item.id, { due })} onClear={() => updateInboxItem(item.id, { due: undefined })} />
                  <PriorityChip assigned={item.priority ?? null} onPick={(p) => updateInboxItem(item.id, { priority: p })} onClear={() => updateInboxItem(item.id, { priority: undefined })} />
                  <button
                    onClick={() => setPendingCreateIds([item.id])}
                    title="Promote to task"
                    className={`lov-btn lov-btn-primary h-7 w-[112px] justify-center whitespace-nowrap px-1.5 text-[11px] ${ready ? "" : "opacity-90"}`}
                  >
                    <Check className="h-3 w-3" />
                    Create task
                  </button>
                  <button
                    onClick={() => {
                      removeInboxItem(item.id);
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        next.delete(item.id);
                        return next;
                      });
                    }}
                    title="Remove capture"
                    className="lov-icon-btn opacity-0 hover:text-red-600 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <span className="truncate text-right text-[11px] text-muted-foreground">{item.captured}</span>
                </div>
              );
            })}

            <div className="px-2 py-10 text-center">
              <p className="text-[13px] text-muted-foreground">{inboxItems.length === 0 ? "Inbox is clear." : "End of captures."}</p>
            </div>
          </div>
        </section>
        <TaskDrawer item={selectedTask} onClose={() => setSelectedTaskId(null)} />
        {pendingCreateIds && (
          <ConfirmCreateDialog
            count={pendingCreateIds.length}
            onCancel={() => setPendingCreateIds(null)}
            onConfirm={confirmCreateTasks}
          />
        )}
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

function ConfirmCreateDialog({ count, onCancel, onConfirm }: { count: number; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-sm rounded-lg border bg-background p-5 shadow-xl">
        <h2 className="text-[15px] font-semibold tracking-tight">Create {count === 1 ? "task" : "tasks"}?</h2>
        <p className="mt-1 text-[13px] text-muted-foreground">
          This will remove the selected capture{count === 1 ? "" : "s"} from Inbox and create editable task{count === 1 ? "" : "s"} in the shared task store.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="lov-btn lov-btn-ghost">Cancel</button>
          <button onClick={onConfirm} className="lov-btn lov-btn-primary">
            <Check className="h-3 w-3" />
            Create {count === 1 ? "task" : "tasks"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectChip({ assigned, items, onPick, onClear }: { assigned: { id: string; name: string; accent: string; icon?: string } | null; items: { id: string; name: string; accent: string; icon?: string }[]; onPick: (id: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  if (assigned) {
    return <ChipButton onClear={onClear}><ProjectIcon name={assigned.icon} accent={assigned.accent} size={12} />{assigned.name}</ChipButton>;
  }
  return <MenuButton label="+ project" open={open} setOpen={setOpen} width="w-64">{items.map((p) => <button key={p.id} onClick={() => { onPick(p.id); setOpen(false); }} className="lov-menu-item"><ProjectIcon name={p.icon} accent={p.accent} size={12} />{p.name}</button>)}</MenuButton>;
}

function DueChip({ assigned, onPick, onClear }: { assigned: string | null; onPick: (iso: string) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  if (assigned) {
    const label = new Date(`${assigned}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return <ChipButton onClear={onClear}>{label}</ChipButton>;
  }
  const options = [{ label: "Today", days: 0 }, { label: "Tomorrow", days: 1 }, { label: "In 3 days", days: 3 }, { label: "Next week", days: 7 }];
  return <MenuButton label="+ due" open={open} setOpen={setOpen} width="w-40">{options.map((o) => <button key={o.label} onClick={() => { const d = new Date(); d.setDate(d.getDate() + o.days); onPick(d.toISOString().slice(0, 10)); setOpen(false); }} className="lov-menu-item">{o.label}</button>)}</MenuButton>;
}

function PriorityChip({ assigned, onPick, onClear }: { assigned: Priority | null; onPick: (p: Priority) => void; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const colorMap: Record<Priority, string> = { High: "text-red-600", Medium: "text-amber-600", Low: "text-blue-600" };
  if (assigned) return <ChipButton onClear={onClear} className={colorMap[assigned]}>{assigned}</ChipButton>;
  return <MenuButton label="+ priority" open={open} setOpen={setOpen} width="w-36">{(["High", "Medium", "Low"] as Priority[]).map((p) => <button key={p} onClick={() => { onPick(p); setOpen(false); }} className={`lov-menu-item ${colorMap[p]}`}>{p}</button>)}</MenuButton>;
}

function ChipButton({ children, onClear, className = "" }: { children: ReactNode; onClear: () => void; className?: string }) {
  return (
    <span className={`inline-flex h-6 max-w-40 items-center gap-1 rounded border px-1.5 text-[11px] ${className}`}>
      <span className="min-w-0 truncate inline-flex items-center gap-1">{children}</span>
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
