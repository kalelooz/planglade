"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity as ActivityIcon,
  Calendar,
  CheckSquare,
  CircleDot,
  Clock3,
  FileText,
  Flag,
  FolderKanban,
  Plus,
  Search,
  Tag,
  User,
  X,
} from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar, ToolButton, Chip } from "@/components/lovable/page";
import { useStore } from "@/lib/store";
import { type Priority, type Project, type Status, type WorkItem } from "@/lib/mock-data";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";
import { getServerSession } from "@/lib/server-session-client";
import {
  type ApiProject,
  type ApiWorkItem,
  toUiProject,
  toUiWorkItem,
  toUiWorkStatus,
} from "@/lib/server-ui-mappers";

type FilterKey = "all" | "today" | "yesterday" | "week" | "older";
type ActivityEvent = {
  id: string;
  action: "CREATED" | "UPDATED" | "MOVED" | "COMPLETED" | "DELETED" | "COMMENTED" | "ASSIGNED" | "UNASSIGNED";
  entityType: "WORKSPACE" | "PROJECT" | "WORK_ITEM" | "NOTE" | "COMMENT";
  entityId: string;
  summary: string | null;
  metadata: unknown;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
  target: string;
  workItemId: string | null;
  projectId: string | null;
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "older", label: "Older" },
];

const ACTION_ICONS: Record<ActivityEvent["action"], typeof ActivityIcon> = {
  CREATED: Plus,
  MOVED: FolderKanban,
  COMPLETED: CheckSquare,
  COMMENTED: FileText,
  UPDATED: Flag,
  DELETED: X,
  ASSIGNED: User,
  UNASSIGNED: User,
};

function formatFilterLabel(key: FilterKey): string {
  const today = new Date();
  if (key === "today") return `Today, ${today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  if (key === "yesterday") {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    return `Yesterday, ${yesterday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  if (key === "week") return "This week";
  if (key === "older") return "Older";
  return "All";
}

function actionLabel(action: ActivityEvent["action"]) {
  if (action === "CREATED") return "created";
  if (action === "UPDATED") return "updated";
  if (action === "MOVED") return "moved";
  if (action === "COMPLETED") return "completed";
  if (action === "DELETED") return "deleted";
  if (action === "COMMENTED") return "commented on";
  if (action === "ASSIGNED") return "assigned";
  return "unassigned";
}

function prettyActionLabel(action: ActivityEvent["action"]) {
  if (action === "CREATED") return "Created";
  if (action === "UPDATED") return "Updated";
  if (action === "MOVED") return "Moved";
  if (action === "COMPLETED") return "Completed";
  if (action === "DELETED") return "Deleted";
  if (action === "COMMENTED") return "Commented";
  if (action === "ASSIGNED") return "Assigned";
  return "Unassigned";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function eventTimeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function eventDateBucket(value: string): FilterKey {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "older";
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((startToday.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return "week";
  return "older";
}

function groupLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  const bucket = eventDateBucket(value);
  if (bucket === "today") return "Today";
  if (bucket === "yesterday") return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function matchesFilter(value: string, key: FilterKey) {
  if (key === "all") return true;
  return eventDateBucket(value) === key;
}

function localDateLabel(value?: string) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatActivityDate(dateStr: string): string {
  if (dateStr === "Today") {
    return `Today, ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  if (dateStr === "Yesterday") {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return `Yesterday, ${yesterday.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  return dateStr;
}

function priorityTone(priority?: Priority) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function InlineTag({ children, mono = false, accent }: { children: React.ReactNode; mono?: boolean; accent?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border bg-muted px-1.5 py-0.5 text-[11px] text-foreground/80 ${mono ? "font-mono" : ""}`}
      style={
        accent
          ? {
              background: `color-mix(in oklch, ${accent} 15%, var(--color-muted))`,
              borderColor: `color-mix(in oklch, ${accent} 30%, var(--color-border))`,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

function InspectorRow({ icon: Icon, label, value }: { icon: typeof CircleDot; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-[12px]">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}

function ActivityPageContent() {
  const params = useSearchParams();
  const routeProjectId = params.get("project");
  const settings = useStore((s) => s.settings);

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const session = await getServerSession();
        if (!active) return;

        setMembers((session.members ?? []).map((member) => ({ id: member.id, name: member.name || member.email })));

        const activityUrl = new URL("/api/activity", window.location.origin);
        activityUrl.searchParams.set("workspaceId", session.workspace.id);
        if (routeProjectId) {
          activityUrl.searchParams.set("projectId", routeProjectId);
        }

        const [activityRes, workItemsRes, projectsRes] = await Promise.all([
          fetch(activityUrl.toString(), {
            cache: "no-store",
            headers: { "x-flowboard-user-id": session.user.id },
          }),
          fetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, {
            cache: "no-store",
          }),
          fetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, {
            cache: "no-store",
          }),
        ]);

        if (!activityRes.ok) throw new Error("Failed to load activity");
        if (!workItemsRes.ok) throw new Error("Failed to load work items");
        if (!projectsRes.ok) throw new Error("Failed to load projects");

        const activityPayload = (await activityRes.json()) as { events: ActivityEvent[] };
        const workItemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        if (!active) return;

        setEvents(activityPayload.events ?? []);
        setWorkItems(workItemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id)));
        setProjects(projectsPayload.projects.map((project) => toUiProject(project, session.user.id)));
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load activity");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [routeProjectId]);

  const density = settings.density;
  const compact = density === "compact";
  const rowPadding = compact ? "py-2" : "py-2.5";
  const rowGap = compact ? "gap-2" : "gap-3";

  const filteredEvents = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((event) => {
      if (!matchesFilter(event.createdAt, filter)) return false;
      if (!q) return true;
      const actor = (event.actor?.name ?? event.actor?.email ?? "system").toLowerCase();
      const action = actionLabel(event.action).toLowerCase();
      const summary = (event.summary ?? "").toLowerCase();
      return (
        event.target.toLowerCase().includes(q) ||
        action.includes(q) ||
        actor.includes(q) ||
        summary.includes(q)
      );
    });
  }, [events, filter, query]);

  const days = useMemo(() => {
    const grouped = new Map<string, ActivityEvent[]>();
    for (const event of filteredEvents) {
      const label = groupLabel(event.createdAt);
      const current = grouped.get(label) ?? [];
      current.push(event);
      grouped.set(label, current);
    }
    return Array.from(grouped.entries()).map(([date, items]) => ({ date, items }));
  }, [filteredEvents]);

  const counts = useMemo(() => {
    const map: Record<FilterKey, number> = { all: events.length, today: 0, yesterday: 0, week: 0, older: 0 };
    for (const event of events) {
      const bucket = eventDateBucket(event.createdAt);
      map[bucket] += 1;
    }
    return map;
  }, [events]);

  const openItems = workItems.filter((w) => w.status !== "Done").length;
  const doneItems = workItems.filter((w) => w.status === "Done").length;

  const selectedEvent = useMemo(
    () => (selectedEventId ? events.find((event) => event.id === selectedEventId) ?? null : null),
    [selectedEventId, events]
  );

  const selectedTask = useMemo(
    () => (selectedEvent?.workItemId ? workItems.find((item) => item.id === selectedEvent.workItemId) ?? null : null),
    [selectedEvent, workItems]
  );

  const selectedProject = useMemo(
    () => (selectedEvent?.projectId ? projects.find((project) => project.id === selectedEvent.projectId) ?? null : null),
    [selectedEvent, projects]
  );

  const selectedActor = selectedEvent?.actor?.name ?? selectedEvent?.actor?.email ?? "System";
  const selectedAction = selectedEvent ? actionLabel(selectedEvent.action) : null;
  const selectedMetadata = asRecord(selectedEvent?.metadata);
  const selectedStatusTo = asString(selectedMetadata?.newStatus);
  const selectedStatusToLabel =
    selectedStatusTo && ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].includes(selectedStatusTo)
      ? toUiWorkStatus(selectedStatusTo as ApiWorkItem["status"])
      : null;
  const selectedAssigneeTo = asString(selectedMetadata?.newAssigneeId);
  const selectedAssigneeToName =
    selectedAssigneeTo ? members.find((member) => member.id === selectedAssigneeTo)?.name ?? selectedAssigneeTo : null;

  return (
    <AppShell
      title={<span className="font-medium">Activity</span>}
      toolbar={
        <Toolbar>
          <div className="flex items-center gap-1">
            {FILTERS.map((f) => (
              <ToolButton key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
                <span>{formatFilterLabel(f.key)}</span>
                <span className="ml-1.5 text-[10px] text-muted-foreground">{counts[f.key]}</span>
              </ToolButton>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 text-muted-foreground">
            <span className="text-[11px]">{openItems} open / {doneItems} done</span>
          </div>
          <span className="flex h-7 items-center gap-1.5 rounded border bg-sidebar px-2 text-[12px] text-muted-foreground">
            <Search className="h-3 w-3" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-40 bg-transparent outline-none"
              placeholder="Search activity."
            />
          </span>
        </Toolbar>
      }
    >
      <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-1">
        <div className="min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6">
            {error && (
              <div className="mb-4 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                {error}
              </div>
            )}
            {loading && (
              <div className="py-16 text-center text-[13px] text-muted-foreground">Loading activity...</div>
            )}
            {!loading && days.length === 0 && (
              <div className="py-16 text-center text-[13px] text-muted-foreground">
                No activity matches. Try changing the filter or search term.
              </div>
            )}

            {days.map((day) => (
              <section key={day.date} className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {formatActivityDate(day.date)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{day.items.length}</div>
                </div>
                <div className="border-y">
                  {day.items.map((event, index) => {
                    const actorName = event.actor?.name ?? event.actor?.email ?? "System";
                    const ActionIcon = ACTION_ICONS[event.action] || ActivityIcon;
                    const isSelected = selectedEventId === event.id;
                    const metadata = asRecord(event.metadata);
                    const movedTo = asString(metadata?.newStatus);
                    const movedToLabel =
                      movedTo && ["BACKLOG", "TODO", "IN_PROGRESS", "IN_REVIEW", "DONE"].includes(movedTo)
                        ? toUiWorkStatus(movedTo as ApiWorkItem["status"])
                        : null;

                    return (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelectedEventId(event.id)}
                        className={`grid w-full grid-cols-[20px_minmax(0,1fr)_60px] items-center ${rowGap} ${rowPadding} text-left text-[13px] transition-colors hover:bg-[var(--color-hover)]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? "bg-[var(--color-hover)]/80" : ""} ${index !== day.items.length - 1 ? "border-b border-border/40" : ""}`}
                      >
                        <ActionIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                          <Avatar id={event.actor?.id ?? "system"} name={actorName} size={18} />
                          <span className="font-medium">{actorName}</span>
                          <span className="text-muted-foreground">{actionLabel(event.action)}</span>
                          {event.workItemId && <InlineTag mono accent={settings.accent}>{event.workItemId}</InlineTag>}
                          <span className="min-w-0 truncate">{event.target}</span>
                          {movedToLabel && (
                            <>
                              <span className="text-muted-foreground">·</span>
                              <InlineTag>{movedToLabel}</InlineTag>
                            </>
                          )}
                        </span>
                        <span className="text-right font-mono text-[11px] text-muted-foreground">
                          {eventTimeLabel(event.createdAt)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="min-h-0 overflow-y-auto border-t bg-background lg:border-l lg:border-t-0">
          <div className="border-b px-4 py-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {selectedEvent ? "Activity details" : "Overview"}
              </div>
              {selectedEvent && (
                <button type="button" onClick={() => setSelectedEventId(null)} className="lov-icon-btn h-7 w-7" aria-label="Clear selection">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <h2 className="truncate text-[16px] font-semibold tracking-tight">
              {selectedEvent ? `${selectedActor} ${selectedAction}` : "Activity feed"}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {selectedEvent ? selectedEvent.target : "Recent actions across your workspace."}
            </p>
          </div>

          <div className="space-y-5 px-4 py-4">
            {!selectedEvent ? (
              <>
                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</div>
                  <div className="space-y-1">
                    <InspectorRow icon={Clock3} label="Today" value={`${counts.today} actions`} />
                    <InspectorRow icon={Calendar} label="This week" value={`${counts.week + counts.today + counts.yesterday} actions`} />
                    <InspectorRow icon={CheckSquare} label="Open" value={`${openItems} items`} />
                    <InspectorRow icon={ActivityIcon} label="Total" value={`${events.length} entries`} />
                  </div>
                </section>
              </>
            ) : (
              <>
                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Activity</div>
                  <div className="space-y-1">
                    <InspectorRow icon={User} label="Who" value={selectedActor} />
                    <InspectorRow icon={ActivityIcon} label="Action" value={prettyActionLabel(selectedEvent.action)} />
                    <InspectorRow icon={Clock3} label="Time" value={new Date(selectedEvent.createdAt).toLocaleString()} />
                    {selectedStatusToLabel && <InspectorRow icon={FolderKanban} label="To" value={selectedStatusToLabel} />}
                    {!selectedStatusToLabel && selectedAssigneeToName && (
                      <InspectorRow icon={FolderKanban} label="To" value={selectedAssigneeToName} />
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip>{prettyActionLabel(selectedEvent.action)}</Chip>
                    {selectedStatusToLabel && <Chip tone="accent">{selectedStatusToLabel}</Chip>}
                    {!selectedStatusToLabel && selectedAssigneeToName && <Chip tone="accent">{selectedAssigneeToName}</Chip>}
                  </div>
                </section>

                {selectedTask && (
                  <section>
                    <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>Related task</span>
                      <span>{selectedTask.id}</span>
                    </div>
                    <div className="flex w-full items-center gap-2 rounded-md border bg-card p-3 text-left">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{selectedTask.title}</div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{selectedTask.status}</span>
                          {selectedTask.due && (
                            <>
                              <span>·</span>
                              <span>Due {localDateLabel(selectedTask.due)}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <PriorityIcon p={selectedTask.priority} />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Chip tone={priorityTone(selectedTask.priority)}>{selectedTask.priority}</Chip>
                      {selectedTask.label && <Chip>{selectedTask.label}</Chip>}
                      {selectedTask.due && (
                        <Chip tone={selectedTask.due < new Date().toISOString().slice(0, 10) ? "danger" : "neutral"}>
                          {localDateLabel(selectedTask.due)}
                        </Chip>
                      )}
                    </div>
                  </section>
                )}

                {selectedProject && (
                  <section>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Related project</div>
                    <div className="flex w-full items-center gap-2 rounded-md border bg-card p-3 text-left">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border" style={{ background: selectedProject.accent }}>
                        <FolderKanban className="h-3.5 w-3.5 text-white" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13px] font-medium">{selectedProject.name}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {selectedProject.status} · Due {localDateLabel(selectedProject.due)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Chip tone={selectedProject.status === "Active" ? "success" : selectedProject.status === "On Hold" ? "warning" : "neutral"}>
                        {selectedProject.status}
                      </Chip>
                      <Chip>{workItems.filter((item) => item.project === selectedProject.id).length} tasks</Chip>
                    </div>
                  </section>
                )}

                {!selectedTask && !selectedProject && selectedEvent.target && (
                  <section>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target</div>
                    <div className="rounded-md border bg-card p-3 text-[12px]">
                      <p className="font-medium">{selectedEvent.target}</p>
                      <p className="mt-1 text-muted-foreground">This item may have been deleted or is no longer accessible.</p>
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={null}>
      <ActivityPageContent />
    </Suspense>
  );
}
