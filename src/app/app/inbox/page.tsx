"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Check, ChevronDown, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/lovable/shell";
import { ProjectViewTitle, Toolbar } from "@/components/lovable/page";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { DependencyBadge } from "@/components/lovable/dependency-badge";
import { ProjectIcon } from "@/components/lovable/project-icon";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getDatePart } from "@/lib/dates";
import { type Priority, type WorkItem } from "@/lib/mock-data";
import { apiFetch, getServerSession } from "@/lib/server-session-client";
import {
  type ApiProject,
  type ApiWorkItem,
  toApiWorkPriority,
  toApiWorkStatus,
  toUiProject,
  toUiWorkItem,
} from "@/lib/server-ui-mappers";
import { applyWorkItemDependencyRelations, type WorkItemDependencyRelation } from "@/lib/work-item-dependencies";
import { getDemoFixtures } from "@/lib/demo-data";
import { blockReadOnlyMutation, handleDemoReadOnlyResponse } from "@/lib/demo-readonly";

const compactPrimaryActionClass =
  "lov-btn lov-btn-primary h-7 justify-center gap-1.5 px-2 text-[11px] disabled:opacity-50";
const compactControlClass =
  "inline-flex h-7 w-full min-w-0 items-center justify-between gap-1 rounded-md border border-border/70 bg-background px-2 text-[11px] text-muted-foreground outline-none transition-colors hover:bg-hover focus-visible:ring-1 focus-visible:ring-ring";

function parseDateValue(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return undefined;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function InboxPage({ basePath = "/app" }: { basePath?: "/app" | "/demo" }) {
  const isDemoMode = basePath === "/demo";
  const demoData = isDemoMode ? getDemoFixtures() : null;
  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(isDemoMode ? "demo-workspace" : null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(isDemoMode ? "demo-user" : null);
  const [projects, setProjects] = useState<Array<ReturnType<typeof toUiProject>>>(() => demoData
    ? demoData.apiProjects.map((project) => toUiProject(project, "demo-user"))
    : []);
  const [workItems, setWorkItems] = useState<WorkItem[]>(() => demoData
    ? applyWorkItemDependencyRelations(demoData.apiTasks.map((item) => toUiWorkItem(item, "demo-user")), demoData.demoRelations)
    : []);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>(() => isDemoMode ? [{ id: "demo-user", name: "Demo User" }] : []);
  const [captureValue, setCaptureValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clearedPriorityIds, setClearedPriorityIds] = useState<Set<string>>(new Set());
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearAllPending, setClearAllPending] = useState(false);
  const [bulkPending, setBulkPending] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const inboxItems = useMemo(
    () => workItems.filter((item) => item.status === "Backlog"),
    [workItems]
  );
  const selectedCount = selectedIds.size;
  const allSelected = inboxItems.length > 0 && selectedIds.size === inboxItems.length;
  const partiallySelected = selectedIds.size > 0 && !allSelected;
  const selectedTask = selectedTaskId ? workItems.find((item) => item.id === selectedTaskId) ?? null : null;

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = partiallySelected;
  }, [partiallySelected]);

  useEffect(() => {
    if (isDemoMode) return;
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

        const [projectsRes, workItemsRes, relationsRes] = await Promise.all([
          apiFetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/work-item-relations?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);
        if (!projectsRes.ok) throw new Error("Failed to load projects");
        if (!workItemsRes.ok) throw new Error("Failed to load inbox captures");
        if (!relationsRes.ok) throw new Error("Failed to load task dependencies");

        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const itemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        const relationsPayload = (await relationsRes.json()) as { relations: WorkItemDependencyRelation[] };
        if (!active) return;

        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
        const mappedItems = itemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id));
        setWorkItems(applyWorkItemDependencyRelations(mappedItems, relationsPayload.relations));
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
  }, [isDemoMode]);

  const patchWorkItem = async (id: string, localPatch: Partial<WorkItem>, apiPatch: Record<string, unknown>) => {
    if (blockReadOnlyMutation(isDemoMode)) return false;
    if (!workspaceId) return false;
    const snapshot = workItems;
    setWorkItems((current) => current.map((item) => (item.id === id ? { ...item, ...localPatch } : item)));

    const response = await apiFetch(
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
      if (handleDemoReadOnlyResponse(response)) return false;
      setError("Failed to update capture");
      return false;
    }
    const payload = (await response.json()) as { workItem?: ApiWorkItem };
    if (payload.workItem) {
      const next = toUiWorkItem(payload.workItem, currentUserId);
      setWorkItems((current) => current.map((item) => (item.id === id ? next : item)));
    }
    return true;
  };

  const deleteWorkItem = async (id: string) => {
    if (blockReadOnlyMutation(isDemoMode)) return false;
    if (!workspaceId) return false;
    const snapshot = workItems;
    setWorkItems((current) => current.filter((item) => item.id !== id));

    const response = await apiFetch(
      `/api/work-items/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      { method: "DELETE", headers: { "x-flowboard-user-id": currentUserId ?? "" } }
    );
    if (!response.ok) {
      setWorkItems(snapshot);
      if (handleDemoReadOnlyResponse(response)) return false;
      setError("Failed to delete capture");
      return false;
    }
    return true;
  };

  const createCapture = async (title: string) => {
    if (blockReadOnlyMutation(isDemoMode)) return false;
    if (!workspaceId) return false;
    const response = await apiFetch("/api/work-items", {
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
      if (handleDemoReadOnlyResponse(response)) return false;
      setError("Failed to capture item");
      return false;
    }
    const payload = (await response.json()) as { workItem: ApiWorkItem };
    setWorkItems((current) => [toUiWorkItem(payload.workItem, currentUserId), ...current]);
    toast.success("Captured to Inbox");
    return true;
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
    if (blockReadOnlyMutation(isDemoMode)) return;
    const ids = Array.from(selectedIds);
    if (patch.priority !== undefined) {
      setClearedPriorityIds((current) => {
        const next = new Set(current);
        for (const id of ids) next.delete(id);
        return next;
      });
    }
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
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (bulkPending) return;
    setBulkPending(true);
    const ids = Array.from(selectedIds);
    const promoted: string[] = [];
    for (const id of ids) {
      const ok = await patchWorkItem(id, { status: "To Do" }, { status: toApiWorkStatus("To Do"), completedAt: null });
      if (ok) promoted.push(id);
    }
    if (promoted[0]) setSelectedTaskId(promoted[0]);
    setSelectedIds(new Set());
    setBulkPending(false);
    toast.success(`Sent ${promoted.length} capture${promoted.length === 1 ? "" : "s"} to tasks`);
  };

  const bulkDelete = async () => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (bulkPending) return;
    setBulkPending(true);
    const ids = Array.from(selectedIds);
    let deleted = 0;
    for (const id of ids) {
      const ok = await deleteWorkItem(id);
      if (ok) deleted += 1;
    }
    toast(`Deleted ${deleted} capture${deleted === 1 ? "" : "s"}`);
    setSelectedIds(new Set());
    setBulkPending(false);
  };

  const clearAll = async () => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (inboxItems.length === 0) return;
    setClearAllPending(true);
    for (const item of inboxItems) {
      await deleteWorkItem(item.id);
    }
    setSelectedIds(new Set());
    setClearAllPending(false);
    setClearAllOpen(false);
    toast.success("Inbox cleared");
  };

  return (
    <AppShell
      title={<ProjectViewTitle view="Inbox" />}
      toolbar={
        <Toolbar>
          {selectedCount > 0 ? (
            <>
              <span className="px-1 font-mono text-[10px] font-medium text-muted-foreground">{selectedCount} selected</span>
              <BulkMenu label="Project">
                {projects.map((project) => (
                  <button
                    type="button"
                    key={project.id}
                    onClick={() => { void bulkUpdate({ project: project.id }, `Set project to ${project.name}`); }}
                    className="lov-menu-item"
                  >
                    <ProjectIcon name={project.icon} accent={project.accent} />
                    {project.name}
                  </button>
                ))}
              </BulkMenu>
              <BulkDatePicker
                label="Due"
                onPick={(due) => {
                  void bulkUpdate({ due }, "Set due date");
                }}
              />
              <BulkMenu label="Priority">
                {(["High", "Medium", "Low"] as Priority[]).map((priority) => (
                  <button
                    type="button"
                    key={priority}
                    onClick={() => { void bulkUpdate({ priority }, `Set priority to ${priority}`); }}
                    className="lov-menu-item"
                  >
                    {priority}
                  </button>
                ))}
              </BulkMenu>
              <button type="button" onClick={() => { void bulkPromote(); }} disabled={bulkPending} className={compactPrimaryActionClass}>
                <Check className="h-3 w-3" />
                {bulkPending ? "Converting..." : "Convert selected to tasks"}
              </button>
              <button type="button" onClick={() => { void bulkDelete(); }} disabled={bulkPending} className="lov-btn lov-btn-danger">
                <Trash2 className="h-3 w-3" />
                {bulkPending ? "Dismissing..." : "Dismiss selected"}
              </button>
              <button type="button" onClick={() => setSelectedIds(new Set())} disabled={bulkPending} className="lov-btn lov-btn-ghost">
                Clear
              </button>
            </>
          ) : inboxItems.length > 0 ? (
            <>
              <span className="hidden font-mono text-[10px] text-muted-foreground md:inline">Set project, due, and priority, then convert.</span>
              <button type="button" onClick={() => setClearAllOpen(true)} className="lov-btn lov-btn-ghost h-7 px-2">
                Clear all
              </button>
            </>
          ) : null}
        </Toolbar>
      }
    >
      <div className="kimi-inbox flex h-full min-h-0">
        <div className="min-w-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
          <div className="mx-auto w-full max-w-[880px] px-4 py-6 sm:px-6 sm:py-8">
            {error && <div className="mb-3 rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{error}</div>}
            {loading && <div className="mb-3 text-[12px] text-muted-foreground">Loading inbox data...</div>}
            <div className="mb-5">
              <h1 className="text-[22px] font-semibold tracking-tight">Inbox</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Capture first. Organize when you&apos;re ready.
              </p>
            </div>

            <div data-inbox-surface="quick-capture" className="mb-4 rounded-lg border border-border bg-card shadow-[0_1px_2px_hsl(240_8%_10%/0.04)]">
              <div className="flex w-full items-center gap-3 px-3 py-2.5 transition-colors focus-within:bg-hover/60 hover:bg-hover/60">
                <Plus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <input
                  value={captureValue}
                  onChange={(e) => setCaptureValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && captureValue.trim()) {
                      void createCapture(captureValue.trim());
                    }
                  }}
                  placeholder="What&apos;s on your mind?"
                  aria-label="Quick Capture"
                  className="h-7 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
                />
                <span className="hidden shrink-0 font-mono text-[10px] text-muted-foreground lg:inline">Needs triage</span>
                <kbd className="shrink-0 rounded border border-border/70 bg-background px-1 font-mono text-[9px] text-muted-foreground">Enter</kbd>
              </div>
            </div>

            <section data-inbox-surface="pending-captures" className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
              <div className="flex w-full flex-wrap items-center gap-3 border-b border-border/60 px-3 py-2 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Pending captures</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{inboxItems.length}</span>
                </div>
                {inboxItems.length > 0 ? (
                  <label className={`ml-auto inline-flex h-7 items-center gap-1.5 rounded px-2 font-mono text-[10px] text-muted-foreground hover:bg-hover ${bulkPending ? "cursor-not-allowed" : "cursor-pointer"}`}>
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={bulkPending}
                      aria-label="Select all pending captures"
                      className="h-3.5 w-3.5 shrink-0 cursor-pointer appearance-auto accent-primary disabled:cursor-not-allowed"
                    />
                    Select all
                  </label>
                ) : null}
              </div>

              {inboxItems.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <p className="text-xs font-medium text-foreground">Inbox is clear.</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">Use Quick Capture to add something new.</p>
                </div>
              ) : (
                <div>
                {inboxItems.map((item, itemIndex) => {
                  const assignedProject = item.project ? projects.find((p) => p.id === item.project) : null;
                  const ready = Boolean(item.project || item.due || item.priority);
                  const priorityAssigned =
                    clearedPriorityIds.has(item.id) && item.priority === "Medium" ? null : item.priority ?? null;
                  const selected = selectedIds.has(item.id);
                  return (
                    <div
                      key={item.id}
                      data-inbox-row="pending-capture"
                      className={`group grid w-full min-w-0 grid-cols-[24px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-border/50 bg-transparent px-3 py-2.5 text-xs transition-colors last:border-b-0 hover:bg-hover/60 xl:grid-cols-[24px_minmax(0,1fr)_minmax(0,220px)_minmax(0,140px)_minmax(0,112px)_minmax(0,168px)] ${selected ? "bg-hover/70" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(item.id)}
                        disabled={bulkPending}
                        aria-label={`Select ${item.title}`}
                        className="h-3.5 w-3.5 shrink-0 cursor-pointer justify-self-start accent-primary disabled:cursor-not-allowed"
                      />
                      <div data-inbox-title-dependency-cell className="min-w-0 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(item.id)}
                          title={item.title}
                          className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap break-words text-left text-xs font-medium text-foreground hover:underline focus:outline-none focus-visible:underline"
                        >
                          {item.title}
                        </button>
                        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                          <DependencyBadge item={item} allItems={workItems} />
                        </span>
                      </div>
                      <div data-inbox-row-controls className="col-span-2 grid min-w-0 grid-cols-1 gap-1.5 pl-9 sm:grid-cols-[minmax(0,1fr)_minmax(0,7rem)_minmax(0,5rem)_minmax(0,auto)] xl:contents xl:pl-0">
                        <ProjectChip
                          className="w-full min-w-0 shrink-0"
                          assigned={assignedProject ? { id: assignedProject.id, name: assignedProject.name, accent: assignedProject.accent, icon: assignedProject.icon } : null}
                          items={projects.map((p) => ({ id: p.id, name: p.name, accent: p.accent, icon: p.icon }))}
                          menuSide={itemIndex === inboxItems.length - 1 ? "top" : "bottom"}
                          onPick={(pid) => { void patchWorkItem(item.id, { project: pid }, { projectId: pid }); }}
                          onClear={() => { void patchWorkItem(item.id, { project: "" }, { projectId: null }); }}
                        />
                        <DueChip
                          className="w-full min-w-0 shrink-0"
                          assigned={item.due ?? null}
                          menuSide={itemIndex === inboxItems.length - 1 ? "top" : "bottom"}
                          onPick={(due) => { void patchWorkItem(item.id, { due }, { dueDate: `${due}T00:00:00.000Z` }); }}
                          onClear={() => { void patchWorkItem(item.id, { due: "" }, { dueDate: null }); }}
                        />
                        <PriorityChip
                          className="w-full min-w-0 shrink-0"
                          assigned={priorityAssigned}
                          menuSide={itemIndex === inboxItems.length - 1 ? "top" : "bottom"}
                          onPick={(p) => {
                            if (blockReadOnlyMutation(isDemoMode)) return;
                            setClearedPriorityIds((current) => {
                              const next = new Set(current);
                              next.delete(item.id);
                              return next;
                            });
                            void patchWorkItem(item.id, { priority: p }, { priority: toApiWorkPriority(p) });
                          }}
                          onClear={() => {
                            if (blockReadOnlyMutation(isDemoMode)) return;
                            setClearedPriorityIds((current) => new Set(current).add(item.id));
                            void patchWorkItem(item.id, { priority: "Medium" }, { priority: toApiWorkPriority("Medium") });
                          }}
                        />
                        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 sm:flex-nowrap">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
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
                            title="Convert to task"
                            className={`${compactPrimaryActionClass} w-auto max-w-[112px] shrink-0 whitespace-nowrap text-[10px] ${ready ? "" : "opacity-90"}`}
                          >
                            <Check className="h-3 w-3" />
                            <span className="xl:hidden">Convert</span>
                            <span className="hidden xl:inline">Convert to task</span>
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
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
                            title="Dismiss"
                            aria-label="Dismiss capture"
                            className="lov-icon-btn h-6 w-6 shrink-0 opacity-100 hover:text-red-600 dark:hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </section>
            {clearAllOpen && (
              <div className="fixed inset-0 z-[90] flex items-center justify-center">
                <div className="absolute inset-0 bg-foreground/30" onClick={clearAllPending ? undefined : () => setClearAllOpen(false)} />
                <div className="relative z-10 w-full max-w-sm rounded-lg border bg-background p-5 shadow-xl">
                  <h2 className="text-[15px] font-semibold">Clear Inbox?</h2>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    This will delete {inboxItems.length} inbox capture{inboxItems.length === 1 ? "" : "s"}. This cannot be undone.
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={() => setClearAllOpen(false)} disabled={clearAllPending} className="lov-btn lov-btn-ghost">Cancel</button>
                    <button type="button" onClick={() => { void clearAll(); }} disabled={clearAllPending} className="lov-btn lov-btn-danger">
                      {clearAllPending ? "Clearing..." : "Clear Inbox"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <TaskDrawer
          readOnly={isDemoMode}
          item={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          membersOverride={members}
          projectsOverride={projects}
          allItems={workItems}
          onItemsReplaced={setWorkItems}
          onSelectItem={setSelectedTaskId}
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
      <button type="button" onClick={() => setOpen((value) => !value)} className="lov-btn">
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
  menuSide = "bottom",
  className = "",
}: {
  assigned: { id: string; name: string; accent: string; icon?: string } | null;
  items: { id: string; name: string; accent: string; icon?: string }[];
  onPick: (id: string) => void;
  onClear: () => void;
  menuSide?: "top" | "bottom";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative flex min-w-0 max-w-full items-center gap-1 ${className}`}>
      <MenuButton
        open={open}
        setOpen={setOpen}
        width="w-56 max-w-[calc(100vw-2rem)]"
        align="left"
        side={menuSide}
        trigger={
          assigned ? (
            <span className="inline-flex min-w-0 max-w-full items-center gap-1 pr-3">
              <ProjectIcon name={assigned.icon} accent={assigned.accent} size={12} />
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{assigned.name}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              Project
              <ChevronDown className="h-3 w-3" />
            </span>
          )
        }
        triggerClassName={compactControlClass}
      >
        {items.map((p) => (
          <button
            type="button"
            key={p.id}
            onClick={() => {
              onPick(p.id);
              setOpen(false);
            }}
            className="lov-menu-item min-w-0"
          >
            <ProjectIcon name={p.icon} accent={p.accent} size={12} />
            <span className="min-w-0 truncate">{p.name}</span>
          </button>
        ))}
      </MenuButton>
      {assigned ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClear();
          }}
          className="lov-icon-btn absolute right-0 h-4 w-4 opacity-0 hover:text-foreground group-hover:opacity-100"
          aria-label="Clear project"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}

function BulkDatePicker({ label, onPick }: { label: string; onPick: (iso: string) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <CompactDateControl value="" onChange={onPick} ariaLabel="Set bulk due date" className="w-28" />
    </label>
  );
}

function CompactDateControl({
  value,
  onChange,
  onClear,
  ariaLabel,
  className = "",
  menuSide = "bottom",
}: {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  ariaLabel: string;
  className?: string;
  menuSide?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const selectedDate = useMemo(() => parseDateValue(value), [value]);
  const [month, setMonth] = useState<Date>(selectedDate ?? new Date());

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setMonth(parseDateValue(value) ?? new Date());
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <div className={`h-7 min-w-0 ${open ? "z-[95]" : ""} ${className}`}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={ariaLabel}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={`${compactControlClass} font-mono text-[10px]`}
          >
            {value ? <span className="truncate">{value}</span> : <span>No date</span>}
            <CalendarDays className="h-3 w-3 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        role="dialog"
        aria-label={ariaLabel}
        align="start"
        side={menuSide}
        sideOffset={4}
        avoidCollisions
        collisionPadding={8}
        className="z-[100] w-auto max-w-[calc(100vw-1rem)] rounded-md border border-border/80 bg-popover p-2 shadow-sm"
      >
        <Calendar
          mode="single"
          selected={selectedDate}
          month={month}
          onMonthChange={setMonth}
          onSelect={(date) => {
            if (!date) return;
            onChange(formatDateValue(date));
            setOpen(false);
          }}
          className="p-0 text-xs [--cell-size:--spacing(7)]"
          classNames={{
            month: "flex flex-col w-full gap-2",
            week: "flex w-full mt-1",
            weekday: "text-muted-foreground rounded-md flex-1 font-normal text-[10px] select-none",
            caption_label: "select-none font-medium text-xs",
            button_previous: "h-7 w-7 p-0",
            button_next: "h-7 w-7 p-0",
          }}
        />
        <div className="mt-2 flex items-center justify-end border-t border-border/60 pt-1.5">
          <button
            type="button"
            onClick={() => {
              if (onClear) onClear();
              else onChange("");
              setOpen(false);
            }}
            className="h-6 rounded-md px-2 text-xs text-muted-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            Clear
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function DueChip({
  assigned,
  onPick,
  onClear,
  className = "",
  menuSide = "bottom",
}: {
  assigned: string | null;
  onPick: (iso: string) => void;
  onClear: () => void;
  className?: string;
  menuSide?: "top" | "bottom";
}) {
  const value = getDatePart(assigned);
  return (
    <div className={`flex min-w-0 items-center gap-1 ${className}`}>
      <CompactDateControl
        value={value}
        onChange={onPick}
        onClear={onClear}
        className="min-w-0 flex-1"
        ariaLabel="Due date"
        menuSide={menuSide}
      />
      {value ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClear();
          }}
          className="lov-icon-btn h-4 w-4 opacity-0 hover:text-foreground group-hover:opacity-100"
          aria-label="Clear due date"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}

function PriorityChip({
  assigned,
  onPick,
  onClear,
  className = "",
  menuSide = "bottom",
}: {
  assigned: Priority | null;
  onPick: (p: Priority) => void;
  onClear: () => void;
  className?: string;
  menuSide?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const priorityTone: Record<Priority, string> = { High: "font-semibold text-foreground", Medium: "text-muted-foreground", Low: "text-muted-foreground/70" };

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <div className={`relative flex min-w-0 items-center gap-1 ${className}`}>
      <div className={`relative min-w-0 flex-1 ${open ? "z-[95]" : ""}`}>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className={compactControlClass}
        >
          {assigned ? (
            <span className={`inline-flex items-center gap-1 whitespace-nowrap pr-3 font-mono text-[10px] ${priorityTone[assigned]}`}>
              {assigned}
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              Priority
              <ChevronDown className="h-3 w-3" />
            </span>
          )}
        </button>
        {open ? (
          <>
            <div className="fixed inset-0 z-[90]" onMouseDown={() => setOpen(false)} />
            <div
              role="menu"
              className={`absolute left-0 ${menuSide === "top" ? "bottom-full mb-1" : "top-full mt-1"} z-[100] w-36 max-w-[calc(100vw-2rem)] rounded-md border border-border/80 bg-popover py-1 shadow-sm`}
            >
              {(["High", "Medium", "Low"] as Priority[]).map((p) => (
                <button
                  type="button"
                  role="menuitem"
                  key={p}
                  onClick={() => {
                    onPick(p);
                    setOpen(false);
                  }}
                  className={`flex h-7 w-full items-center px-2 text-left font-mono text-xs transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none ${priorityTone[p]}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      {assigned ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClear();
          }}
          className="lov-icon-btn h-4 w-4 shrink-0 opacity-0 hover:text-foreground group-hover:opacity-100"
          aria-label="Reset priority"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      ) : null}
    </div>
  );
}
function MenuButton({
  trigger,
  open,
  setOpen,
  children,
  width = "w-44",
  align = "right",
  side = "bottom",
  triggerClassName = "lov-btn lov-btn-ghost h-6 whitespace-nowrap border-dashed/0 px-1.5 text-[11px]",
}: {
  trigger: ReactNode;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: ReactNode;
  width?: string;
  align?: "left" | "right";
  side?: "top" | "bottom";
  triggerClassName?: string;
}) {
  return (
    <div className={`relative w-full min-w-0 ${open ? "z-[85]" : ""}`}>
      <button type="button" onClick={() => setOpen(!open)} className={triggerClassName}>
        {trigger}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onMouseDown={() => setOpen(false)} />
          <div className={`absolute ${align === "left" ? "left-0" : "right-0"} ${side === "top" ? "bottom-full mb-1" : "mt-1"} z-[80] max-h-56 overflow-y-auto ${width} rounded-md border border-border/80 bg-popover py-1 shadow-md`}>{children}</div>
        </>
      )}
    </div>
  );
}
