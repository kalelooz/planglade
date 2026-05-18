"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CheckSquare,
  CircleDot,
  Flag,
  FolderKanban,
  Hash,
  Maximize2,
  Minus,
  Network,
  Plus,
  Search,
  StickyNote,
  Tag,
  User,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/lovable/shell";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";
import { Chip, Toolbar } from "@/components/lovable/page";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { byInitials, type Priority, type Status } from "@/lib/mock-data";
import { useStore } from "@/lib/store";

type NodeType = "project" | "task" | "note" | "person" | "label";
type EdgeType = "contains" | "assigned" | "tagged" | "referenced";

type GraphNode = {
  id: string;
  refId: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  accent?: string;
  meta?: string;
  priority?: Priority;
  status?: Status;
  due?: string;
  count?: number;
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
};

const CANVAS_W = 1560;
const CANVAS_H = 760;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.7;

const FILTERS = [
  { key: "projects", label: "Projects", type: "project" },
  { key: "tasks", label: "Tasks", type: "task" },
  { key: "notes", label: "Notes", type: "note" },
  { key: "people", label: "People", type: "person" },
  { key: "labels", label: "Labels", type: "label" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const NODE_SIZE: Record<NodeType, { width: number; height: number }> = {
  project: { width: 210, height: 58 },
  task: { width: 234, height: 54 },
  note: { width: 196, height: 48 },
  person: { width: 164, height: 44 },
  label: { width: 146, height: 38 },
};

const EDGE_STYLES: Record<EdgeType, { color: string; width: number; dash?: string }> = {
  contains: { color: "var(--color-primary)", width: 1.5 },
  assigned: { color: "var(--color-muted-foreground)", width: 1.15, dash: "5 5" },
  tagged: { color: "#d97706", width: 1.15, dash: "4 4" },
  referenced: { color: "#6366f1", width: 1.2 },
};

function dueTone(due?: string) {
  if (!due) return "neutral" as const;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (due < todayKey) return "danger" as const;
  if (due === todayKey) return "warning" as const;
  return "neutral" as const;
}

function priorityTone(priority?: Priority) {
  if (priority === "High") return "danger" as const;
  if (priority === "Medium") return "warning" as const;
  return "neutral" as const;
}

function NodeGlyph({ type, className }: { type: NodeType; className?: string }) {
  if (type === "project") return <FolderKanban className={className} />;
  if (type === "task") return <CheckSquare className={className} />;
  if (type === "note") return <StickyNote className={className} />;
  if (type === "person") return <User className={className} />;
  return <Tag className={className} />;
}

function pathBetween(from: GraphNode, to: GraphNode) {
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height;
  const x2 = to.x + to.width / 2;
  const y2 = to.y;
  const bend = Math.max(48, Math.abs(y2 - y1) * 0.42);
  return `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
}

function truncateLabel(label: string, max = 28) {
  return label.length > max ? `${label.slice(0, max - 1)}.` : label;
}

function localDateLabel(value?: string) {
  if (!value) return "No date";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function GraphNodeView({
  node,
  selected,
  dimmed,
  related,
  onSelect,
  onHover,
}: {
  node: GraphNode;
  selected: boolean;
  dimmed: boolean;
  related: boolean;
  onSelect: () => void;
  onHover: (id: string | null) => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        borderColor: selected ? "var(--color-primary)" : related ? "color-mix(in oklch, var(--color-primary) 42%, var(--color-border))" : undefined,
        boxShadow: selected ? "0 0 0 3px color-mix(in oklch, var(--color-primary) 18%, transparent)" : undefined,
        opacity: dimmed ? 0.28 : 1,
      }}
      className="absolute flex items-center gap-2 rounded-md border bg-background px-3 text-left shadow-sm transition-[border-color,box-shadow,opacity,transform] hover:-translate-y-0.5 hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border text-foreground"
        style={{ background: node.accent ? `${node.accent}` : "var(--color-muted)", borderColor: node.accent ? "transparent" : undefined }}
      >
        {node.type === "person" ? (
          <Avatar id={node.refId} name={node.label} />
        ) : (
          <NodeGlyph type={node.type} className={`h-3.5 w-3.5 ${node.accent && node.type !== "project" ? "text-background" : ""}`} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-4">{truncateLabel(node.label)}</span>
        <span className="mt-0.5 block truncate text-[10.5px] text-muted-foreground">{node.meta}</span>
      </span>
      {node.type === "task" && node.priority && <PriorityIcon p={node.priority} />}
      {node.count != null && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{node.count}</span>
      )}
    </button>
  );
}

function FilterButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
        active ? "border-foreground/20 bg-foreground text-background" : "border-border bg-card text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
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

export default function GraphPage() {
  const projects = useStore((s) => s.projects);
  const notes = useStore((s) => s.notes);
  const members = useStore((s) => s.members);
  const workItems = useStore((s) => s.workItems);
  const activeProjectId = useStore((s) => s.settings.activeProjectId);

  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) ?? null : null;

  const [filters, setFilters] = useState<Record<FilterKey, boolean>>({
    projects: true,
    tasks: true,
    notes: true,
    people: true,
    labels: true,
  });
  const [scopeMode, setScopeMode] = useState<"workspace" | "project">("workspace");
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragMoved, setDragMoved] = useState(false);
  const [viewport, setViewport] = useState({ w: CANVAS_W, h: CANVAS_H });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const useProjectScope = scopeMode === "project" && activeProjectId != null;
  const scopedProjects = useProjectScope ? projects.filter((p) => p.id === activeProjectId) : projects;
  const scopedWorkItems = useProjectScope ? workItems.filter((w) => w.project === activeProjectId) : workItems;

  const { nodes, edges } = useMemo(() => {
    const nextNodes: GraphNode[] = [];
    const nextEdges: GraphEdge[] = [];
    const queryText = query.trim().toLowerCase();
    const matchesQuery = (text: string) => !queryText || text.toLowerCase().includes(queryText);

    const visibleProjects = scopedProjects.filter((project) => matchesQuery(project.name) || scopedWorkItems.some((item) => item.project === project.id && matchesQuery(item.title)));
    const projectCount = Math.max(visibleProjects.length, 1);
    const laneWidth = CANVAS_W / projectCount;

    visibleProjects.forEach((project, projectIndex) => {
      const laneCenter = laneWidth * projectIndex + laneWidth / 2;
      const projectTasks = scopedWorkItems.filter((item) => item.project === project.id && matchesQuery(item.title));

      if (filters.projects) {
        const size = NODE_SIZE.project;
        nextNodes.push({
          id: `project:${project.id}`,
          refId: project.id,
          type: "project",
          label: project.name,
          meta: `${project.status} / due ${localDateLabel(project.due)}`,
          x: laneCenter - size.width / 2,
          y: 92,
          width: size.width,
          height: size.height,
          accent: project.accent,
          count: projectTasks.length,
        });
      }

      if (filters.tasks) {
        projectTasks.forEach((item, itemIndex) => {
          const size = NODE_SIZE.task;
          const perRow = laneWidth > 460 ? 2 : 1;
          const col = itemIndex % perRow;
          const row = Math.floor(itemIndex / perRow);
          const colOffset = perRow === 1 ? 0 : col === 0 ? -size.width * 0.58 : size.width * 0.58;
          const taskId = `task:${item.id}`;
          nextNodes.push({
            id: taskId,
            refId: item.id,
            type: "task",
            label: item.title,
            meta: `${item.status} / ${byInitials(item.assignee).name}`,
            x: laneCenter - size.width / 2 + colOffset,
            y: 220 + row * 76,
            width: size.width,
            height: size.height,
            priority: item.priority,
            status: item.status,
            due: item.due,
          });
          if (filters.projects) nextEdges.push({ id: `project:${project.id}->${taskId}`, from: `project:${project.id}`, to: taskId, type: "contains" });
        });
      }
    });

    const visibleTaskIds = new Set(nextNodes.filter((node) => node.type === "task").map((node) => node.refId));
    const taskX = new Map(nextNodes.filter((node) => node.type === "task").map((node) => [node.refId, node.x + node.width / 2]));

    if (filters.notes) {
      const relatedNoteIds = new Set<string>();
      scopedWorkItems.forEach((item) => {
        if (!visibleTaskIds.has(item.id)) return;
        (item.noteIds ?? []).forEach((noteId) => relatedNoteIds.add(noteId));
      });
      const visibleNotes = notes.filter((note) => matchesQuery(note.title) || relatedNoteIds.has(note.id));
      visibleNotes.forEach((note, index) => {
        const size = NODE_SIZE.note;
        const linkedTasks = scopedWorkItems.filter((item) => (item.noteIds ?? []).includes(note.id));
        const linkedX = linkedTasks.map((item) => taskX.get(item.id)).filter((x): x is number => typeof x === "number");
        const x = linkedX.length
          ? linkedX.reduce((sum, value) => sum + value, 0) / linkedX.length - size.width / 2
          : CANVAS_W * ((index + 0.5) / Math.max(visibleNotes.length, 1)) - size.width / 2;
        nextNodes.push({
          id: `note:${note.id}`,
          refId: note.id,
          type: "note",
          label: note.title,
          meta: `${note.tag} / updated ${note.updated}`,
          x,
          y: 570,
          width: size.width,
          height: size.height,
          count: linkedTasks.length || undefined,
        });
        linkedTasks.forEach((item) => {
          if (visibleTaskIds.has(item.id)) nextEdges.push({ id: `task:${item.id}->note:${note.id}`, from: `task:${item.id}`, to: `note:${note.id}`, type: "referenced" });
        });
      });
    }

    if (filters.people) {
      const involved = new Set<string>();
      scopedWorkItems.forEach((item) => {
        if (visibleTaskIds.has(item.id)) involved.add(item.assignee);
      });
      scopedProjects.forEach((project) => {
        if (!queryText || matchesQuery(project.name)) involved.add(project.owner);
      });
      const visibleMembers = members.filter((member) => involved.has(member.id) && matchesQuery(member.name));
      visibleMembers.forEach((member, index) => {
        const size = NODE_SIZE.person;
        const assigned = scopedWorkItems.filter((item) => item.assignee === member.id && visibleTaskIds.has(item.id));
        const assignedX = assigned.map((item) => taskX.get(item.id)).filter((x): x is number => typeof x === "number");
        const x = assignedX.length
          ? assignedX.reduce((sum, value) => sum + value, 0) / assignedX.length - size.width / 2
          : CANVAS_W * ((index + 0.5) / Math.max(visibleMembers.length, 1)) - size.width / 2;
        nextNodes.push({
          id: `person:${member.id}`,
          refId: member.id,
          type: "person",
          label: member.name,
          meta: member.role,
          x,
          y: 668,
          width: size.width,
          height: size.height,
          accent: member.color,
          count: assigned.length || undefined,
        });
        assigned.forEach((item) => nextEdges.push({ id: `task:${item.id}->person:${member.id}`, from: `task:${item.id}`, to: `person:${member.id}`, type: "assigned" }));
      });
    }

    if (filters.labels) {
      const labels = new Map<string, number>();
      scopedWorkItems.forEach((item) => {
        if (!visibleTaskIds.has(item.id) || !item.label || !matchesQuery(item.label)) return;
        labels.set(item.label, (labels.get(item.label) ?? 0) + 1);
      });
      Array.from(labels.entries()).forEach(([label, count], index, list) => {
        const size = NODE_SIZE.label;
        nextNodes.push({
          id: `label:${label}`,
          refId: label,
          type: "label",
          label,
          meta: `${count} work item${count === 1 ? "" : "s"}`,
          x: CANVAS_W * ((index + 0.5) / Math.max(list.length, 1)) - size.width / 2,
          y: 24,
          width: size.width,
          height: size.height,
          count,
        });
        scopedWorkItems.forEach((item) => {
          if (item.label === label && visibleTaskIds.has(item.id)) {
            nextEdges.push({ id: `label:${label}->task:${item.id}`, from: `label:${label}`, to: `task:${item.id}`, type: "tagged" });
          }
        });
      });
    }

    return { nodes: nextNodes, edges: nextEdges.filter((edge) => nextNodes.some((node) => node.id === edge.from) && nextNodes.some((node) => node.id === edge.to)) };
  }, [filters, members, notes, query, scopedProjects, scopedWorkItems]);

  const selectedNode = selectedId ? nodes.find((node) => node.id === selectedId) ?? null : null;
  const focusId = hoveredId ?? selectedId;
  const relatedIds = useMemo(() => {
    if (!focusId) return new Set<string>();
    const ids = new Set<string>([focusId]);
    edges.forEach((edge) => {
      if (edge.from === focusId) ids.add(edge.to);
      if (edge.to === focusId) ids.add(edge.from);
    });
    return ids;
  }, [edges, focusId]);

  const connectedNodes = useMemo(() => {
    if (!selectedNode) return [];
    return nodes.filter((node) => node.id !== selectedNode.id && relatedIds.has(node.id));
  }, [nodes, relatedIds, selectedNode]);

  const selectedTask = openTaskId ? workItems.find((item) => item.id === openTaskId) ?? null : null;

  const fitToView = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const bounds = nodes.length
      ? nodes.reduce(
          (acc, node) => ({
            minX: Math.min(acc.minX, node.x),
            minY: Math.min(acc.minY, node.y),
            maxX: Math.max(acc.maxX, node.x + node.width),
            maxY: Math.max(acc.maxY, node.y + node.height),
          }),
          { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: 0, maxY: 0 }
        )
      : { minX: 0, minY: 0, maxX: CANVAS_W, maxY: CANVAS_H };
    const padding = 72;
    const boundsW = Math.max(1, bounds.maxX - bounds.minX);
    const boundsH = Math.max(1, bounds.maxY - bounds.minY);
    const z = Math.min(1.08, Math.max(MIN_ZOOM, Math.min((rect.width - padding * 2) / boundsW, (rect.height - padding * 2) / boundsH)));
    setZoom(z);
    setPan({
      x: (rect.width - boundsW * z) / 2 - bounds.minX * z,
      y: (rect.height - boundsH * z) / 2 - bounds.minY * z,
    });
  }, [nodes]);

  useEffect(() => {
    const frame = requestAnimationFrame(fitToView);
    return () => cancelAnimationFrame(frame);
  }, [fitToView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const resize = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setViewport({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    resize.observe(container);
    return () => resize.disconnect();
  }, []);

  const zoomBy = (delta: number) => {
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
    const cx = viewport.w / 2;
    const cy = viewport.h / 2;
    const ratio = nextZoom / zoom;
    setPan({ x: cx - ratio * (cx - pan.x), y: cy - ratio * (cy - pan.y) });
    setZoom(nextZoom);
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + (event.deltaY > 0 ? -0.08 : 0.08)));
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const ratio = nextZoom / zoom;
    setPan({ x: mx - ratio * (mx - pan.x), y: my - ratio * (my - pan.y) });
    setZoom(nextZoom);
  };

  const handlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    setIsDragging(true);
    setDragMoved(false);
    dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = event.clientX - dragRef.current.x;
    const dy = event.clientY - dragRef.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) setDragMoved(true);
    setPan({ x: dragRef.current.panX + dx, y: dragRef.current.panY + dy });
  };

  const selectNode = (node: GraphNode) => {
    setSelectedId(node.id);
    if (node.type === "task") setOpenTaskId(node.refId);
  };

  const openItems = scopedWorkItems.filter((item) => item.status !== "Done").length;
  const overdue = scopedWorkItems.filter((item) => dueTone(item.due) === "danger" && item.status !== "Done").length;
  const unlinkedNotes = notes.filter((note) => !scopedWorkItems.some((item) => (item.noteIds ?? []).includes(note.id))).length;

  return (
    <AppShell
      title={<span className="font-medium">{useProjectScope && activeProject ? `${activeProject.name} / Graph` : "Workspace Graph"}</span>}
      toolbar={
        <Toolbar>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Network className="h-3.5 w-3.5" />
            <span>{nodes.length} nodes</span>
            <span>/</span>
            <span>{edges.length} links</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Chip tone={overdue ? "danger" : "neutral"}>{overdue} overdue</Chip>
            <Chip>{openItems} open</Chip>
            <Chip tone={unlinkedNotes ? "warning" : "success"}>{unlinkedNotes} unlinked notes</Chip>
          </div>
        </Toolbar>
      }
    >
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_21rem] overflow-hidden">
        <div className="flex min-h-0 flex-col border-r">
          <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
            <div className="relative w-64 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search graph"
                className="h-8 w-full rounded border bg-card pl-8 pr-2 text-[12px] outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-wrap gap-1">
              <FilterButton
                label="All projects"
                active={scopeMode === "workspace"}
                onClick={() => setScopeMode("workspace")}
              />
              <FilterButton
                label="Current project"
                active={scopeMode === "project"}
                onClick={() => setScopeMode("project")}
              />
              {FILTERS.map((filter) => (
                <FilterButton
                  key={filter.key}
                  label={filter.label}
                  active={filters[filter.key]}
                  onClick={() => setFilters((prev) => ({ ...prev, [filter.key]: !prev[filter.key] }))}
                />
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button type="button" onClick={() => zoomBy(-0.12)} className="lov-icon-btn h-8 w-8" aria-label="Zoom out"><Minus className="h-4 w-4" /></button>
              <button type="button" onClick={fitToView} className="lov-icon-btn h-8 w-8" aria-label="Fit to view"><Maximize2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => zoomBy(0.12)} className="lov-icon-btn h-8 w-8" aria-label="Zoom in"><Plus className="h-4 w-4" /></button>
              <span className="w-10 text-right text-[11px] font-medium text-muted-foreground">{Math.round(zoom * 100)}%</span>
            </div>
          </div>

          <div
            ref={containerRef}
            className="relative min-h-0 flex-1 cursor-grab overflow-hidden bg-[linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] bg-[size:48px_48px] active:cursor-grabbing"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={() => setIsDragging(false)}
            onPointerLeave={() => setIsDragging(false)}
            onClick={() => {
              if (!dragMoved) {
                setSelectedId(null);
                setOpenTaskId(null);
              }
            }}
          >
            <div className="pointer-events-none absolute left-3 top-3 z-10 flex gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span className="rounded border bg-background/90 px-2 py-1">Labels</span>
              <span className="rounded border bg-background/90 px-2 py-1">Projects</span>
              <span className="rounded border bg-background/90 px-2 py-1">Work</span>
              <span className="rounded border bg-background/90 px-2 py-1">Notes</span>
              <span className="rounded border bg-background/90 px-2 py-1">People</span>
            </div>

            <div
              className="absolute left-0 top-0 origin-top-left"
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: isDragging ? "none" : "transform 120ms ease-out",
              }}
            >
              <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}>
                <defs>
                  <marker id="graph-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-muted-foreground)" opacity="0.55" />
                  </marker>
                </defs>
                {edges.map((edge) => {
                  const from = nodes.find((node) => node.id === edge.from);
                  const to = nodes.find((node) => node.id === edge.to);
                  if (!from || !to) return null;
                  const highlighted = focusId ? relatedIds.has(edge.from) && relatedIds.has(edge.to) : false;
                  const dimmed = focusId ? !highlighted : false;
                  const style = EDGE_STYLES[edge.type];
                  return (
                    <path
                      key={edge.id}
                      d={pathBetween(from, to)}
                      fill="none"
                      stroke={style.color}
                      strokeWidth={highlighted ? style.width + 0.8 : style.width}
                      strokeDasharray={style.dash}
                      markerEnd="url(#graph-arrow)"
                      opacity={dimmed ? 0.12 : highlighted ? 0.95 : 0.42}
                    />
                  );
                })}
              </svg>

              {nodes.map((node) => (
                <GraphNodeView
                  key={node.id}
                  node={node}
                  selected={selectedId === node.id}
                  related={focusId ? relatedIds.has(node.id) : false}
                  dimmed={focusId ? !relatedIds.has(node.id) : false}
                  onSelect={() => selectNode(node)}
                  onHover={setHoveredId}
                />
              ))}
            </div>
          </div>
        </div>

        <aside className="min-h-0 overflow-y-auto bg-background">
          <div className="border-b px-4 py-4">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {selectedNode ? selectedNode.type : "Overview"}
            </div>
            <h2 className="truncate text-[16px] font-semibold tracking-tight">
              {selectedNode?.label ?? (activeProject?.name ?? "All projects")}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {selectedNode?.meta ?? "Map the relationships FlowBoard can prove from current client state."}
            </p>
          </div>

          <div className="space-y-5 px-4 py-4">
            {!selectedNode ? (
              <>
                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Readiness</div>
                  <div className="space-y-1">
                    <InspectorRow icon={CheckSquare} label="Open" value={`${openItems} work items`} />
                    <InspectorRow icon={Flag} label="Risk" value={`${overdue} overdue`} />
                    <InspectorRow icon={StickyNote} label="Notes" value={`${unlinkedNotes} unlinked`} />
                    <InspectorRow icon={Network} label="Links" value={`${edges.length} explicit links`} />
                  </div>
                </section>
                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Level-up notes</div>
                  <div className="space-y-2 text-[12px] text-muted-foreground">
                    <p>Graph is now useful only where the store has relationships: project ownership, task assignment, labels, and explicit note references.</p>
                    <p>The next upgrade is adding real blockers/dependencies to tasks. That would make this page genuinely strategic instead of just a topology view.</p>
                  </div>
                </section>
              </>
            ) : (
              <>
                <section>
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Details</div>
                  <div className="space-y-1">
                    <InspectorRow icon={Hash} label="Id" value={selectedNode.refId} />
                    <InspectorRow icon={CircleDot} label="Type" value={selectedNode.type} />
                    {selectedNode.due && <InspectorRow icon={Calendar} label="Due" value={localDateLabel(selectedNode.due)} />}
                    {selectedNode.priority && <InspectorRow icon={Flag} label="Priority" value={selectedNode.priority} />}
                    {selectedNode.status && <InspectorRow icon={CheckSquare} label="Status" value={selectedNode.status} />}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedNode.priority && <Chip tone={priorityTone(selectedNode.priority)}>{selectedNode.priority}</Chip>}
                    {selectedNode.due && <Chip tone={dueTone(selectedNode.due)}>{localDateLabel(selectedNode.due)}</Chip>}
                    {selectedNode.count != null && <Chip>{selectedNode.count} linked</Chip>}
                  </div>
                </section>

                <section>
                  <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <span>Connected</span>
                    <span>{connectedNodes.length}</span>
                  </div>
                  <div className="space-y-1">
                    {connectedNodes.length === 0 ? (
                      <p className="rounded border border-dashed px-3 py-5 text-center text-[12px] text-muted-foreground">No explicit relationships found.</p>
                    ) : (
                      connectedNodes.map((node) => {
                        return (
                          <button
                            type="button"
                            key={node.id}
                            onClick={() => selectNode(node)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[var(--color-hover)]"
                          >
                            <NodeGlyph type={node.type} className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="min-w-0 flex-1 truncate">{node.label}</span>
                            <span className="text-[10px] uppercase text-muted-foreground">{node.type}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>

                {selectedNode.type === "task" && (
                  <section>
                    <button
                      type="button"
                      onClick={() => setOpenTaskId(selectedNode.refId)}
                      className="lov-btn w-full justify-center"
                    >
                      Open task drawer
                    </button>
                  </section>
                )}
              </>
            )}
          </div>
        </aside>

        <TaskDrawer item={selectedTask} onClose={() => setOpenTaskId(null)} />
      </div>
    </AppShell>
  );
}
