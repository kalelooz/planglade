"use client";
import { useEffect, useMemo, useState } from "react";
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
  Hash,
  Plus,
  Search,
  Tag,
  User,
  X,
} from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar, ToolButton, Chip } from "@/components/lovable/page";
import { useStore } from "@/lib/store";
import { byInitials, type Priority, type Status } from "@/lib/mock-data";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";

type FilterKey = "all" | "today" | "yesterday" | "week" | "older";
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

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "older", label: "Older" },
];

const ACTION_ICONS: Record<string, typeof ActivityIcon> = {
  created: Plus,
  moved: FolderKanban,
  completed: CheckSquare,
  captured: FileText,
  commented: FileText,
  "changed priority": Flag,
  merged: FolderKanban,
  "added label": Tag,
};

function matchesFilter(date: string, key: FilterKey): boolean {
  if (key === "all") return true;
  if (key === "today") return date === "Today";
  if (key === "yesterday") return date === "Yesterday";
  if (key === "week") return date === "Today" || date === "Yesterday";
  if (key === "older") return date !== "Today" && date !== "Yesterday";
  return true;
}

function InlineTag({ children, mono = false, accent }: { children: React.ReactNode; mono?: boolean; accent?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded border bg-muted px-1.5 py-0.5 text-[11px] text-foreground/80 ${mono ? "font-mono" : ""}`}
      style={accent ? { background: `color-mix(in oklch, ${accent} 15%, var(--color-muted))`, borderColor: `color-mix(in oklch, ${accent} 30%, var(--color-border))` } : undefined}
    >
      {children}
    </span>
  );
}

function splitTarget(target: string): { id: string | null; rest: string } {
  const m = /^(FB-\d+|[a-z]-\d+)\s+(.*)$/i.exec(target);
  if (m) return { id: m[1], rest: m[2] };
  return { id: null, rest: target };
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

function InspectorRow({ icon: Icon, label, value }: { icon: typeof CircleDot; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-[12px]">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate font-medium">{value}</span>
    </div>
  );
}

export default function ActivityPage() {
  const params = useSearchParams();
  const routeProjectId = params.get("project");
  const activity = useStore((s) => s.activity);
  const workItems = useStore((s) => s.workItems);
  const projects = useStore((s) => s.projects);
  const members = useStore((s) => s.members);
  const notes = useStore((s) => s.notes);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);

  useEffect(() => {
    if (routeProjectId && routeProjectId !== settings.activeProjectId) {
      updateSettings({ activeProjectId: routeProjectId });
    }
  }, [routeProjectId, settings.activeProjectId, updateSettings]);
  
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<{ who: string; action: string; target: string; to?: string; time: string } | null>(null);

  const density = settings.density;
  const compact = density === "compact";
  const rowPadding = compact ? "py-2" : "py-2.5";
  const rowGap = compact ? "gap-2" : "gap-3";

  const days = useMemo(() => {
    return activity
      .filter((d) => matchesFilter(d.date, filter))
      .map((d) => ({
        ...d,
        items: d.items.filter(
          (it) =>
            !query ||
            it.target.toLowerCase().includes(query.toLowerCase()) ||
            it.action.toLowerCase().includes(query.toLowerCase()),
        ),
      }))
      .filter((d) => d.items.length > 0);
  }, [activity, filter, query]);

  const totalCount = useMemo(() => days.reduce((sum, d) => sum + d.items.length, 0), [days]);

  const counts = useMemo(() => {
    const all = activity.reduce((s, d) => s + d.items.length, 0);
    const map: Record<FilterKey, number> = { all, today: 0, yesterday: 0, week: 0, older: 0 };
    for (const d of activity) {
      const n = d.items.length;
      if (d.date === "Today") {
        map.today += n;
        map.week += n;
      } else if (d.date === "Yesterday") {
        map.yesterday += n;
        map.week += n;
      } else {
        map.older += n;
      }
    }
    return map;
  }, [activity]);

  const selectedTask = useMemo(() => {
    if (!selectedItem) return null;
    const { id } = splitTarget(selectedItem.target);
    if (!id) return null;
    return workItems.find((w) => w.id === id) ?? null;
  }, [selectedItem, workItems]);

  const selectedProject = useMemo(() => {
    if (!selectedItem) return null;
    const { id, rest } = splitTarget(selectedItem.target);
    if (!id && rest) {
      return projects.find((p) => p.name.toLowerCase().includes(rest.toLowerCase())) ?? null;
    }
    return null;
  }, [selectedItem, projects]);

  const handleSelectItem = (item: { who: string; action: string; target: string; to?: string; time: string }, index: number) => {
    setSelectedItem(item);
    setSelectedId(`item-${index}`);
  };

  const handleClearSelection = () => {
    setSelectedItem(null);
    setSelectedId(null);
  };

  const openItems = workItems.filter((w) => w.status !== "Done").length;
  const doneItems = workItems.filter((w) => w.status === "Done").length;

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
              placeholder="Search activity…"
            />
          </span>
        </Toolbar>
      }
    >
      <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_auto] overflow-hidden lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-1">
        <div className="min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-6 py-6">
            {days.length === 0 && (
              <div className="py-16 text-center text-[13px] text-muted-foreground">
                No activity matches. Try changing the filter or search term.
              </div>
            )}

            {days.map((d) => (
              <section key={d.date} className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {formatActivityDate(d.date)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{d.items.length}</div>
                </div>
                <div className="border-y">
                  {d.items.map((it, i) => {
                    const member = byInitials(it.who);
                    const { id, rest } = splitTarget(it.target);
                    const isSelected = selectedId === `item-${d.date}-${i}`;
                    const ActionIcon = ACTION_ICONS[it.action] || ActivityIcon;
                    
                    return (
                      <button
                        key={`${d.date}-${i}`}
                        type="button"
                        onClick={() => handleSelectItem(it, i)}
                        className={`grid w-full grid-cols-[20px_minmax(0,1fr)_60px] items-center ${rowGap} ${rowPadding} text-left text-[13px] transition-colors hover:bg-[var(--color-hover)]/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${isSelected ? "bg-[var(--color-hover)]/80" : ""} ${i !== d.items.length - 1 ? "border-b border-border/40" : ""}`}
                      >
                        <ActionIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                          <Avatar id={member.id} name={member.name} size={18} />
                          <span className="font-medium">{member.name}</span>
                          <span className="text-muted-foreground">{it.action}</span>
                          {id && (
                            <InlineTag mono accent={settings.accent}>{id}</InlineTag>
                          )}
                          {rest && <span className="truncate min-w-0">{rest}</span>}
                          {it.to && (
                            <>
                              <span className="text-muted-foreground">→</span>
                              <InlineTag>{it.to}</InlineTag>
                            </>
                          )}
                        </span>
                        <span className="text-right font-mono text-[11px] text-muted-foreground">{it.time}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </div>

        <aside className="min-h-0 overflow-y-auto border-t bg-background lg:border-l lg:border-t-0">
          <div className={`border-b px-4 py-4 ${selectedItem ? "" : ""}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {selectedItem ? "Activity details" : "Overview"}
              </div>
              {selectedItem && (
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="lov-icon-btn h-7 w-7"
                  aria-label="Clear selection"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <h2 className="truncate text-[16px] font-semibold tracking-tight">
              {selectedItem ? `${byInitials(selectedItem.who).name} ${selectedItem.action}` : "Activity feed"}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {selectedItem ? selectedItem.target : "Recent actions across your workspace."}
            </p>
          </div>

          <div className="space-y-5 px-4 py-4">
            {!selectedItem ? (
              <>
                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Summary</div>
                  <div className="space-y-1">
                    <InspectorRow icon={Clock3} label="Today" value={`${counts.today} actions`} />
                    <InspectorRow icon={Calendar} label="This week" value={`${counts.week} actions`} />
                    <InspectorRow icon={CheckSquare} label="Open" value={`${openItems} items`} />
                    <InspectorRow icon={ActivityIcon} label="Total" value={`${activity.reduce((s, d) => s + d.items.length, 0)} entries`} />
                  </div>
                </section>
                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tips</div>
                  <div className="space-y-2 text-[12px] text-muted-foreground">
                    <p>Click on any activity to see details about the related item.</p>
                    <p>Activity is logged automatically as you create, move, and complete work items.</p>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Activity</div>
                  <div className="space-y-1">
                    <InspectorRow icon={User} label="Who" value={byInitials(selectedItem.who).name} />
                    <InspectorRow icon={ActivityIcon} label="Action" value={selectedItem.action} />
                    <InspectorRow icon={Clock3} label="Time" value={selectedItem.time} />
                    {selectedItem.to && <InspectorRow icon={FolderKanban} label="To" value={selectedItem.to} />}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Chip>{selectedItem.action}</Chip>
                    {selectedItem.to && <Chip tone="accent">{selectedItem.to}</Chip>}
                  </div>
                </section>

                {selectedTask && (
                  <section>
                    <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>Related task</span>
                      <span>{selectedTask.id}</span>
                    </div>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border bg-card p-3 text-left hover:bg-[var(--color-hover)]"
                      onClick={() => {
                        setSelectedId("task-drawer");
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{selectedTask.title}</div>
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
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Chip tone={priorityTone(selectedTask.priority)}>{selectedTask.priority}</Chip>
                      {selectedTask.label && <Chip>{selectedTask.label}</Chip>}
                      {selectedTask.due && <Chip tone={selectedTask.due < new Date().toISOString().slice(0, 10) ? "danger" : "neutral"}>{localDateLabel(selectedTask.due)}</Chip>}
                    </div>
                  </section>
                )}

                {selectedProject && (
                  <section>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Related project</div>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-md border bg-card p-3 text-left hover:bg-[var(--color-hover)]"
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border"
                        style={{ background: selectedProject.accent }}
                      >
                        <FolderKanban className="h-3.5 w-3.5 text-white" />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{selectedProject.name}</div>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">
                          {selectedProject.status} · Due {localDateLabel(selectedProject.due)}
                        </div>
                      </div>
                    </button>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Chip tone={selectedProject.status === "Active" ? "success" : selectedProject.status === "On Hold" ? "warning" : "neutral"}>
                        {selectedProject.status}
                      </Chip>
                      <Chip>{workItems.filter((w) => w.project === selectedProject.id).length} tasks</Chip>
                    </div>
                  </section>
                )}

                {!selectedTask && !selectedProject && selectedItem.target && (
                  <section>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target</div>
                    <div className="rounded-md border bg-card p-3 text-[12px]">
                      <p className="font-medium">{selectedItem.target}</p>
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
