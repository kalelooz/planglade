"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  CheckSquare,
  CircleDot,
  ClipboardList,
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
  X,
} from "lucide-react";

import { AppShell } from "@/components/lovable/shell";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";
import { Chip, Toolbar } from "@/components/lovable/page";
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
const CANVAS_H = 900;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 1.7;
const MAX_TASK_ROWS = 6;
const TASK_COLUMN_GAP = 270;

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
  label: { width: 124, height: 38 },
};

const EDGE_STYLES: Record<EdgeType, { color: string; width: number; dash?: string }> = {
  contains: { color: "var(--color-primary)", width: 1.5 },
  assigned: { color: "var(--color-muted-foreground)", width: 1.15, dash: "5 5" },
  tagged: { color: "#d97706", width: 1.15, dash: "4 4" },
  referenced: { color: "#6366f1", width: 1.2 },
};

const TYPE_STYLE: Record<NodeType, { label: string; tone: string; border: string; bg: string; text: string; ring: string }> = {
  project: {
    label: "Project",
    tone: "oklch(0.52 0.09 195)",
    border: "border-teal-500/35",
    bg: "bg-teal-50 dark:bg-teal-950/30",
    text: "text-teal-700 dark:text-teal-300",
    ring: "shadow-[inset_3px_0_0_oklch(0.52_0.09_195)]",
  },
  task: {
    label: "Task",
    tone: "oklch(0.45 0.02 260)",
    border: "border-slate-400/45",
    bg: "bg-slate-50 dark:bg-slate-900/35",
    text: "text-slate-700 dark:text-slate-300",
    ring: "shadow-[inset_3px_0_0_oklch(0.45_0.02_260)]",
  },
  note: {
    label: "Note",
    tone: "oklch(0.72 0.14 75)",
    border: "border-amber-500/40",
    bg: "bg-amber-50 dark:bg-amber-950/25",
    text: "text-amber-700 dark:text-amber-300",
    ring: "shadow-[inset_3px_0_0_oklch(0.72_0.14_75)]",
  },
  person: {
    label: "Person",
    tone: "oklch(0.58 0.14 280)",
    border: "border-violet-500/35",
    bg: "bg-violet-50 dark:bg-violet-950/25",
    text: "text-violet-700 dark:text-violet-300",
    ring: "shadow-[inset_3px_0_0_oklch(0.58_0.14_280)]",
  },
  label: {
    label: "Label",
    tone: "oklch(0.6 0.14 145)",
    border: "border-emerald-500/35",
    bg: "bg-emerald-50 dark:bg-emerald-950/25",
    text: "text-emerald-700 dark:text-emerald-300",
    ring: "shadow-[inset_3px_0_0_oklch(0.6_0.14_145)]",
  },
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

function TypePill({ type }: { type: NodeType }) {
  const style = TYPE_STYLE[type];
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider ${style.border} ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
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

function nodeBounds(nodes: GraphNode[]) {
  return nodes.reduce(
    (acc, node) => ({
      minX: Math.min(acc.minX, node.x),
      minY: Math.min(acc.minY, node.y),
      maxX: Math.max(acc.maxX, node.x + node.width),
      maxY: Math.max(acc.maxY, node.y + node.height),
    }),
    { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: 0, maxY: 0 }
  );
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
  const typeStyle = TYPE_STYLE[node.type];

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
      className={`absolute flex items-center gap-2 rounded-md border bg-background px-3 text-left shadow-sm transition-[border-color,box-shadow,opacity,transform] hover:-translate-y-0.5 hover:bg-card focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${typeStyle.border} ${typeStyle.ring}`}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border text-foreground"
        style={{ background: node.accent ? `${node.accent}` : typeStyle.tone, borderColor: "transparent" }}
      >
        {node.type === "person" ? (
          <Avatar id={node.refId} name={node.label} />
        ) : (
          <NodeGlyph type={node.type} className="h-3.5 w-3.5 text-white" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-0.5 flex items-center gap-1.5">
          <TypePill type={node.type} />
          <span className="truncate text-[12.5px] font-medium leading-4">{truncateLabel(node.label, node.type === "label" ? 16 : 28)}</span>
        </span>
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
  const [isDragging, setIsDragging] = useState(false);
  const [dragMoved, setDragMoved] = useState(false);
  const [viewport, setViewport] = useState({ w: CANVAS_W, h: CANVAS_H });
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const useProjectScope = scopeMode === "project" && activeProjectId != null;
  const scopedProjects = useProjectScope ? projects.filter((p) => p.id === activeProjectId) : projects;
  const scopedWorkItems = useProjectScope ? workItems.filter((w) => w.project === activeProjectId) : workItems;

  const { nodes, edges, canvasWidth, canvasHeight } = useMemo(() => {
    const nextNodes: GraphNode[] = [];
    const nextEdges: GraphEdge[] = [];
    const queryText = query.trim().toLowerCase();
    const matchesQuery = (text: string) => !queryText || text.toLowerCase().includes(queryText);

    const visibleProjects = scopedProjects.filter((project) => matchesQuery(project.name) || scopedWorkItems.some((item) => item.project === project.id && matchesQuery(item.title)));
    const projectTaskMap = new Map(visibleProjects.map((project) => [
      project.id,
      scopedWorkItems.filter((item) => item.project === project.id && matchesQuery(item.title)),
    ]));
    const laneWidths = visibleProjects.map((project) => {
      const columnCount = Math.max(1, Math.ceil((projectTaskMap.get(project.id)?.length ?? 0) / MAX_TASK_ROWS));
      return Math.max(360, columnCount * TASK_COLUMN_GAP + 72);
    });
    const contentWidth = Math.max(CANVAS_W, laneWidths.reduce((sum, width) => sum + width, 0));
    let laneStart = (contentWidth - laneWidths.reduce((sum, width) => sum + width, 0)) / 2;

    visibleProjects.forEach((project, projectIndex) => {
      const laneWidth = laneWidths[projectIndex] ?? 360;
      const laneCenter = laneStart + laneWidth / 2;
      const projectTasks = projectTaskMap.get(project.id) ?? [];
      const taskColumns = Math.max(1, Math.ceil(projectTasks.length / MAX_TASK_ROWS));

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
          const col = Math.floor(itemIndex / MAX_TASK_ROWS);
          const row = itemIndex % MAX_TASK_ROWS;
          const colOffset = (col - (taskColumns - 1) / 2) * TASK_COLUMN_GAP;
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

      laneStart += laneWidth;
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
          : contentWidth * ((index + 0.5) / Math.max(visibleNotes.length, 1)) - size.width / 2;
        nextNodes.push({
          id: `note:${note.id}`,
          refId: note.id,
          type: "note",
          label: note.title,
          meta: `${note.tag} / updated ${note.updated}`,
          x,
          y: 700,
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
        nextNodes.push({
          id: `person:${member.id}`,
          refId: member.id,
          type: "person",
          label: member.name,
          meta: member.role,
          x: contentWidth * ((index + 0.5) / Math.max(visibleMembers.length, 1)) - size.width / 2,
          y: 792,
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
          x: contentWidth * ((index + 0.5) / Math.max(list.length, 1)) - size.width / 2,
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

    return {
      nodes: nextNodes,
      edges: nextEdges.filter((edge) => nextNodes.some((node) => node.id === edge.from) && nextNodes.some((node) => node.id === edge.to)),
      canvasWidth: contentWidth,
      canvasHeight: CANVAS_H,
    };
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

  const selectedProject = selectedNode?.type === "project" ? projects.find((project) => project.id === selectedNode.refId) ?? null : null;
  const selectedTask = selectedNode?.type === "task" ? workItems.find((item) => item.id === selectedNode.refId) ?? null : null;
  const selectedNote = selectedNode?.type === "note" ? notes.find((note) => note.id === selectedNode.refId) ?? null : null;
  const selectedMember = selectedNode?.type === "person" ? members.find((member) => member.id === selectedNode.refId) ?? null : null;
  const selectedLabelItems = selectedNode?.type === "label" ? scopedWorkItems.filter((item) => item.label === selectedNode.refId) : [];

  const fitBoundsToView = useCallback((bounds: ReturnType<typeof nodeBounds>, padding = 72, maxZoom = 1.08) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const boundsW = Math.max(1, bounds.maxX - bounds.minX);
    const boundsH = Math.max(1, bounds.maxY - bounds.minY);
    const z = Math.min(maxZoom, Math.max(MIN_ZOOM, Math.min((rect.width - padding * 2) / boundsW, (rect.height - padding * 2) / boundsH)));
    setZoom(z);
    setPan({
      x: (rect.width - boundsW * z) / 2 - bounds.minX * z,
      y: (rect.height - boundsH * z) / 2 - bounds.minY * z,
    });
  }, []);

  const fitToView = useCallback(() => {
    fitBoundsToView(nodes.length ? nodeBounds(nodes) : { minX: 0, minY: 0, maxX: canvasWidth, maxY: canvasHeight });
  }, [canvasHeight, canvasWidth, fitBoundsToView, nodes]);

  const fitToRelated = useCallback((nodeId: string) => {
    const ids = new Set<string>([nodeId]);
    edges.forEach((edge) => {
      if (edge.from === nodeId) ids.add(edge.to);
      if (edge.to === nodeId) ids.add(edge.from);
    });

    const relatedNodes = nodes.filter((node) => ids.has(node.id));
    if (relatedNodes.length === 0) return;
    fitBoundsToView(nodeBounds(relatedNodes), relatedNodes.length === 1 ? 180 : 104, relatedNodes.length <= 3 ? 1.45 : 1.22);
  }, [edges, fitBoundsToView, nodes]);

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
    fitToRelated(node.id);
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
      <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_22rem] overflow-hidden lg:grid-cols-[minmax(0,1fr)_26rem] lg:grid-rows-1">
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
                width: canvasWidth,
                height: canvasHeight,
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transition: isDragging ? "none" : "transform 120ms ease-out",
              }}
            >
              <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`}>
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

        <aside className="min-h-0 overflow-y-auto border-t bg-background lg:border-l lg:border-t-0">
          <div className={`border-b px-4 py-4 ${selectedNode ? TYPE_STYLE[selectedNode.type].bg : ""}`}>
            <div className="mb-2 flex items-center justify-between gap-2">
              {selectedNode ? <TypePill type={selectedNode.type} /> : (
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Overview</div>
              )}
              {selectedNode && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(null);
                    fitToView();
                  }}
                  className="lov-icon-btn h-7 w-7"
                  aria-label="Close details"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <h2 className="truncate text-[16px] font-semibold tracking-tight">
              {selectedNode?.label ?? (useProjectScope && activeProject ? activeProject.name : "All projects")}
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
                    {selectedProject && <InspectorRow icon={User} label="Owner" value={byInitials(selectedProject.owner).name} />}
                    {selectedProject && <InspectorRow icon={Calendar} label="Due" value={localDateLabel(selectedProject.due)} />}
                    {selectedProject && <InspectorRow icon={ClipboardList} label="Status" value={selectedProject.status} />}
                    {selectedTask && <InspectorRow icon={FolderKanban} label="Project" value={projects.find((project) => project.id === selectedTask.project)?.name ?? selectedTask.project} />}
                    {selectedTask && <InspectorRow icon={User} label="Assignee" value={byInitials(selectedTask.assignee).name} />}
                    {selectedNode.due && <InspectorRow icon={Calendar} label="Due" value={localDateLabel(selectedNode.due)} />}
                    {selectedNode.priority && <InspectorRow icon={Flag} label="Priority" value={selectedNode.priority} />}
                    {selectedNode.status && <InspectorRow icon={CheckSquare} label="Status" value={selectedNode.status} />}
                    {selectedTask && <InspectorRow icon={Tag} label="Label" value={selectedTask.label} />}
                    {selectedNote && <InspectorRow icon={Tag} label="Tag" value={selectedNote.tag} />}
                    {selectedNote && <InspectorRow icon={Calendar} label="Updated" value={selectedNote.updated} />}
                    {selectedMember && <InspectorRow icon={User} label="Role" value={selectedMember.role} />}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedProject && <Chip tone={selectedProject.status === "Active" ? "success" : selectedProject.status === "On Hold" ? "warning" : "neutral"}>{selectedProject.status}</Chip>}
                    {selectedTask && <Chip>{selectedTask.id}</Chip>}
                    {selectedNode.priority && <Chip tone={priorityTone(selectedNode.priority)}>{selectedNode.priority}</Chip>}
                    {selectedNode.due && <Chip tone={dueTone(selectedNode.due)}>{localDateLabel(selectedNode.due)}</Chip>}
                    {selectedNode.count != null && <Chip>{selectedNode.count} linked</Chip>}
                  </div>
                </section>

                {selectedTask && (
                  <section>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Task Drawer</div>
                    <div className="rounded-md border bg-card p-3 text-[12px]">
                      <p className="text-muted-foreground">{selectedTask.description || "No description yet."}</p>
                      {selectedTask.checklist && selectedTask.checklist.length > 0 && (
                        <div className="mt-3 space-y-1.5">
                          {selectedTask.checklist.map((item) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <span className={`h-3 w-3 rounded-sm border ${item.done ? "bg-foreground" : "bg-background"}`} />
                              <span className={item.done ? "text-muted-foreground line-through" : ""}>{item.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                {selectedProject && (
                  <section>
                    <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>Project Work</span>
                      <span>{workItems.filter((item) => item.project === selectedProject.id).length}</span>
                    </div>
                    <div className="space-y-1">
                      {workItems.filter((item) => item.project === selectedProject.id).slice(0, 8).map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            const taskNode = nodes.find((node) => node.id === `task:${item.id}`);
                            if (taskNode) selectNode(taskNode);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[var(--color-hover)]"
                        >
                          <PriorityIcon p={item.priority} />
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                          <span className="text-[10px] text-muted-foreground">{item.status}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {selectedNote && (
                  <section>
                    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Note Preview</div>
                    <div className="rounded-md border bg-card p-3 text-[12px] text-muted-foreground">
                      {selectedNote.excerpt}
                    </div>
                  </section>
                )}

                {selectedMember && (
                  <section>
                    <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>Assigned Work</span>
                      <span>{workItems.filter((item) => item.assignee === selectedMember.id).length}</span>
                    </div>
                    <div className="space-y-1">
                      {workItems.filter((item) => item.assignee === selectedMember.id).slice(0, 8).map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            const taskNode = nodes.find((node) => node.id === `task:${item.id}`);
                            if (taskNode) selectNode(taskNode);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[var(--color-hover)]"
                        >
                          <PriorityIcon p={item.priority} />
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                          <span className="text-[10px] text-muted-foreground">{item.status}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {selectedNode.type === "label" && (
                  <section>
                    <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <span>Tagged Work</span>
                      <span>{selectedLabelItems.length}</span>
                    </div>
                    <div className="space-y-1">
                      {selectedLabelItems.slice(0, 10).map((item) => (
                        <button
                          type="button"
                          key={item.id}
                          onClick={() => {
                            const taskNode = nodes.find((node) => node.id === `task:${item.id}`);
                            if (taskNode) selectNode(taskNode);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[12px] hover:bg-[var(--color-hover)]"
                        >
                          <PriorityIcon p={item.priority} />
                          <span className="min-w-0 flex-1 truncate">{item.title}</span>
                          <span className="text-[10px] text-muted-foreground">{item.status}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}

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

              </>
            )}
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
