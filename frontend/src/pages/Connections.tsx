import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import {
  CheckSquare,
  FolderKanban,
  Maximize2,
  Minus,
  Network,
  Plus,
  RotateCcw,
  Search,
  StickyNote,
  Tag,
  User,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  minWidthForPackedRow,
  packGraphRow,
} from "@/lib/connection-graph-layout";
import { zoomPanAtPoint } from "@/lib/graph-zoom";
import { useWorkspace } from "@/store/workspace";
import { useTaskDrawer } from "@/components/TaskDrawer";
import { PageContainer } from "@/components/bits";
import { workspaceNotePath, workspaceProjectPath } from "@/lib/workspace-routes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type NodeType = "project" | "task" | "note" | "person" | "label";
type EdgeType =
  | "contains"
  | "assigned"
  | "tagged"
  | "referenced"
  | "dependency"
  | "related"
  | "hierarchy";
type GraphNode = {
  id: string;
  refId: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  meta?: string;
  accent?: string;
};
type GraphEdge = {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  label?: string;
};

const CANVAS_W = 1560;
const CANVAS_H = 900;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 1.7;
const MAX_TASK_ROWS = 6;
const TASK_COLUMN_GAP = 270;
const NODE_SIZE: Record<NodeType, { width: number; height: number }> = {
  project: { width: 210, height: 58 },
  task: { width: 234, height: 54 },
  note: { width: 196, height: 48 },
  person: { width: 164, height: 44 },
  label: { width: 124, height: 38 },
};
const EDGE_STYLES: Record<
  EdgeType,
  { color: string; width: number; dash?: string }
> = {
  contains: { color: "rgb(37 99 235)", width: 1.25 },
  assigned: { color: "rgb(219 39 119)", width: 1.15, dash: "5 5" },
  tagged: { color: "rgb(22 163 74)", width: 1.1, dash: "4 4" },
  referenced: { color: "rgb(8 145 178)", width: 1.15 },
  dependency: { color: "rgb(217 119 6)", width: 1.55 },
  related: { color: "rgb(124 58 237)", width: 1.15, dash: "6 4" },
  hierarchy: { color: "rgb(79 70 229)", width: 1.25 },
};
const TYPE_STYLE: Record<NodeType, { edge: string }> = {
  project: { edge: "rgb(37 99 235)" },
  task: { edge: "rgb(124 58 237)" },
  note: { edge: "rgb(8 145 178)" },
  person: { edge: "rgb(219 39 119)" },
  label: { edge: "rgb(22 163 74)" },
};
const TYPE_ICON: Record<NodeType, typeof FolderKanban> = {
  project: FolderKanban,
  task: CheckSquare,
  note: StickyNote,
  person: User,
  label: Tag,
};
const GRAPH_LEGEND: Array<{ label: string; color: string }> = [
  { label: "Projects", color: EDGE_STYLES.contains.color },
  { label: "People", color: EDGE_STYLES.assigned.color },
  { label: "Notes", color: EDGE_STYLES.referenced.color },
  { label: "Labels", color: EDGE_STYLES.tagged.color },
  { label: "Blocked", color: EDGE_STYLES.dependency.color },
  { label: "Related", color: EDGE_STYLES.related.color },
  { label: "Hierarchy", color: EDGE_STYLES.hierarchy.color },
];

const edgeLabel = (edge: GraphEdge) =>
  edge.type === "contains"
    ? "has task"
    : edge.type === "referenced"
      ? "has note"
      : edge.type === "assigned"
        ? "assigned to"
        : edge.type === "tagged"
          ? "labeled"
          : edge.type === "related"
            ? "related"
            : edge.type === "hierarchy"
              ? "has child"
              : "blocks";
const edgeColor = (edge: GraphEdge, from: GraphNode, to: GraphNode) => {
  if (edge.type === "tagged") {
    return from.type === "label"
      ? from.accent ?? EDGE_STYLES.tagged.color
      : to.type === "label"
        ? to.accent ?? EDGE_STYLES.tagged.color
        : EDGE_STYLES.tagged.color;
  }
  return EDGE_STYLES[edge.type].color;
};
const pathBetween = (from: GraphNode, to: GraphNode) => {
  const x1 = from.x + from.width / 2;
  const y1 = from.y + from.height;
  const x2 = to.x + to.width / 2;
  const y2 = to.y;
  const bend = Math.max(48, Math.abs(y2 - y1) * 0.42);
  return `M ${x1} ${y1} C ${x1} ${y1 + bend}, ${x2} ${y2 - bend}, ${x2} ${y2}`;
};
const nodeBounds = (nodes: GraphNode[]) =>
  nodes.reduce(
    (bounds, node) => ({
      minX: Math.min(bounds.minX, node.x),
      minY: Math.min(bounds.minY, node.y),
      maxX: Math.max(bounds.maxX, node.x + node.width),
      maxY: Math.max(bounds.maxY, node.y + node.height),
    }),
    { minX: Infinity, minY: Infinity, maxX: 0, maxY: 0 },
  );

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
  const Icon = TYPE_ICON[node.type];
  const accent = node.accent ?? TYPE_STYLE[node.type].edge;
  return (
    <button
      type="button"
      data-connection-node={`${node.type}-${node.refId}`}
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
        borderColor: selected
          ? "hsl(var(--foreground))"
          : related
            ? accent
            : undefined,
        boxShadow: selected
          ? "0 0 0 2px hsl(var(--foreground) / .14)"
          : undefined,
        opacity: dimmed ? 0.28 : 1,
      }}
      aria-label={`Select ${node.type}: ${node.label}${node.meta ? `. ${node.meta}` : ""}`}
      className="absolute flex items-center gap-2 rounded-md border border-border bg-card px-3 text-left shadow-sm transition-[border-color,box-shadow,opacity,transform] hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-accent"
        style={{ color: accent }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-4">
          {node.label}
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-muted-foreground">
          {node.meta}
        </span>
      </span>
    </button>
  );
}

function Connections() {
  const ws = useWorkspace();
  const navigate = useNavigate();
  const { openTask } = useTaskDrawer();
  const [kinds, setKinds] = useState<Record<NodeType, boolean>>({
    project: true,
    task: true,
    note: true,
    person: true,
    label: true,
  });
  const [projectFilter, setProjectFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showLabels, setShowLabels] = useState(false);
  const [showList, setShowList] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const didPanRef = useRef(false);
  const selectedTrigger = useRef<HTMLElement | null>(null);
  const { nodes, edges, canvasWidth } = useMemo(() => {
    const nextNodes: GraphNode[] = [];
    const nextEdges: GraphEdge[] = [];
    const q = query.trim().toLowerCase();
    const match = (text: string) => !q || text.toLowerCase().includes(q);
    const projects = ws.projects
      .filter(
        (project) => projectFilter === "all" || project.id === projectFilter,
      )
      .filter(
        (project) =>
          match(project.name) ||
          ws.tasks.some(
            (task) => task.projectId === project.id && match(task.title),
          ),
      );
    const tasks = ws.tasks.filter((task) =>
      projects.some((project) => project.id === task.projectId),
    );
    const visibleNotes = kinds.note
      ? ws.notes
          .filter(
            (note) =>
              projectFilter === "all" || note.projectId === projectFilter,
          )
          .filter(
            (note) =>
              match(note.title) ||
              tasks.some((task) => task.noteIds?.includes(note.id)),
          )
      : [];
    const visiblePeople = kinds.person
      ? ws.state.people.filter((person) =>
          tasks.some((task) => task.assigneeId === person.id),
        )
      : [];
    const visibleLabels = kinds.label
      ? ws.state.labels.filter((label) =>
          tasks.some((task) => task.labelIds.includes(label.id)),
        )
      : [];
    const taskGroups = new Map(
      projects.map((project) => [
        project.id,
        tasks.filter(
          (task) => task.projectId === project.id && match(task.title),
        ),
      ]),
    );
    const widths = projects.map((project) =>
      Math.max(
        360,
        Math.ceil(
          Math.max(1, taskGroups.get(project.id)?.length ?? 0) / MAX_TASK_ROWS,
        ) *
          TASK_COLUMN_GAP +
          72,
      ),
    );
    const total = widths.reduce((sum, width) => sum + width, 0);
    const contentWidth = Math.max(
      CANVAS_W,
      total,
      minWidthForPackedRow(visibleNotes.length, NODE_SIZE.note.width),
      minWidthForPackedRow(visiblePeople.length, NODE_SIZE.person.width),
      minWidthForPackedRow(visibleLabels.length, NODE_SIZE.label.width),
    );
    let laneStart = (contentWidth - total) / 2;
    projects.forEach((project, index) => {
      const laneWidth = widths[index] ?? 360;
      const center = laneStart + laneWidth / 2;
      const projectTasks = taskGroups.get(project.id) ?? [];
      const taskColumns = Math.max(
        1,
        Math.ceil(projectTasks.length / MAX_TASK_ROWS),
      );
      if (kinds.project) {
        const size = NODE_SIZE.project;
        nextNodes.push({
          id: `project:${project.id}`,
          refId: project.id,
          type: "project",
          label: project.name,
          meta: `${project.status} / due ${project.targetDate ?? "No date"}`,
          x: center - size.width / 2,
          y: 92,
          ...size,
        });
      }
      if (kinds.task)
        projectTasks.forEach((task, taskIndex) => {
          const size = NODE_SIZE.task;
          const column = Math.floor(taskIndex / MAX_TASK_ROWS);
          const row = taskIndex % MAX_TASK_ROWS;
          const id = `task:${task.id}`;
          nextNodes.push({
            id,
            refId: task.id,
            type: "task",
            label: task.title,
            meta: `${task.status.replace("_", " ")} / ${ws.state.people.find((person) => person.id === task.assigneeId)?.name ?? "Unassigned"}`,
            x:
              center -
              size.width / 2 +
              (column - (taskColumns - 1) / 2) * TASK_COLUMN_GAP,
            y: 220 + row * 76,
            ...size,
          });
          if (kinds.project)
            nextEdges.push({
              id: `project:${project.id}->${id}`,
              from: `project:${project.id}`,
              to: id,
              type: "contains",
            });
        });
      laneStart += laneWidth;
    });
    const visibleTaskIds = new Set(
      nextNodes
        .filter((node) => node.type === "task")
        .map((node) => node.refId),
    );
    const taskX = new Map(
      nextNodes
        .filter((node) => node.type === "task")
        .map((node) => [node.refId, node.x + node.width / 2]),
    );
    if (kinds.note)
      visibleNotes.forEach((note, index, list) => {
          const size = NODE_SIZE.note;
          const linkedTasks = tasks.filter((task) =>
            task.noteIds?.includes(note.id),
          );
          const linkedX = linkedTasks
            .map((task) => taskX.get(task.id))
            .filter((x): x is number => x !== undefined);
          const x = linkedX.length
            ? linkedX.reduce((sum, value) => sum + value, 0) / linkedX.length -
              size.width / 2
            : contentWidth * ((index + 0.5) / Math.max(list.length, 1)) -
              size.width / 2;
          nextNodes.push({
            id: `note:${note.id}`,
            refId: note.id,
            type: "note",
            label: note.title,
            meta: "Note",
            x,
            y: 700,
            ...size,
          });
          linkedTasks.forEach((task) => {
            if (visibleTaskIds.has(task.id))
              nextEdges.push({
                id: `task:${task.id}->note:${note.id}`,
                from: `task:${task.id}`,
                to: `note:${note.id}`,
                type: "referenced",
              });
          });
          if (note.projectId && kinds.project)
            nextEdges.push({
              id: `project:${note.projectId}->note:${note.id}`,
              from: `project:${note.projectId}`,
              to: `note:${note.id}`,
              type: "referenced",
            });
      });
    if (kinds.person)
      visiblePeople.forEach((person, index, list) => {
          const size = NODE_SIZE.person;
          nextNodes.push({
            id: `person:${person.id}`,
            refId: person.id,
            type: "person",
            label: person.name,
            meta: person.role,
            x: contentWidth * ((index + 0.5) / list.length) - size.width / 2,
            y: 792,
            ...size,
          });
          tasks
            .filter(
              (task) =>
                task.assigneeId === person.id && visibleTaskIds.has(task.id),
            )
            .forEach((task) =>
              nextEdges.push({
                id: `task:${task.id}->person:${person.id}`,
                from: `task:${task.id}`,
                to: `person:${person.id}`,
                type: "assigned",
              }),
            );
      });
    if (kinds.label)
      visibleLabels.forEach((label, index, list) => {
          const size = NODE_SIZE.label;
          nextNodes.push({
            id: `label:${label.id}`,
            refId: label.id,
            type: "label",
            label: label.name,
            meta: `${tasks.filter((task) => task.labelIds.includes(label.id)).length} tasks`,
            accent: `hsl(${label.color})`,
            x: contentWidth * ((index + 0.5) / list.length) - size.width / 2,
            y: 24,
            ...size,
          });
          tasks
            .filter(
              (task) =>
                task.labelIds.includes(label.id) && visibleTaskIds.has(task.id),
            )
            .forEach((task) =>
              nextEdges.push({
                id: `label:${label.id}->task:${task.id}`,
                from: `label:${label.id}`,
                to: `task:${task.id}`,
                type: "tagged",
              }),
            );
      });
    tasks.forEach((task) => {
      task.dependsOn.forEach((blocker) => {
        if (visibleTaskIds.has(blocker) && visibleTaskIds.has(task.id))
          nextEdges.push({
            id: `blocks:${blocker}:${task.id}`,
            from: `task:${blocker}`,
            to: `task:${task.id}`,
            type: "dependency",
            label: "BLOCKS",
          });
      });
      task.related.forEach((related) => {
        if (visibleTaskIds.has(related) && task.id < related)
          nextEdges.push({
            id: `related:${task.id}:${related}`,
            from: `task:${task.id}`,
            to: `task:${related}`,
            type: "related",
          });
      });
      if (
        task.parentId &&
        visibleTaskIds.has(task.parentId) &&
        visibleTaskIds.has(task.id)
      )
        nextEdges.push({
          id: `parent:${task.parentId}:${task.id}`,
          from: `task:${task.parentId}`,
          to: `task:${task.id}`,
          type: "hierarchy",
        });
    });
    const packedAuxiliaryNodes = new Map(
      (["label", "note", "person"] as NodeType[])
        .flatMap((type) =>
          packGraphRow(
            nextNodes.filter((node) => node.type === type),
            contentWidth,
          ),
        )
        .map((node) => [node.id, node]),
    );
    const positionedNodes = nextNodes.map(
      (node) => packedAuxiliaryNodes.get(node.id) ?? node,
    );
    const visibleNodeIds = new Set(positionedNodes.map((node) => node.id));
    return {
      nodes: positionedNodes,
      edges: nextEdges.filter(
        (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to),
      ),
      canvasWidth: contentWidth,
    };
  }, [ws, kinds, projectFilter, query]);
  const selected = selectedId
    ? (nodes.find((node) => node.id === selectedId) ?? null)
    : null;
  const focusId = hoveredId ?? selectedId;
  const related = useMemo(() => {
    const ids = new Set<string>();
    if (!focusId) return ids;
    ids.add(focusId);
    edges.forEach((edge) => {
      if (edge.from === focusId) ids.add(edge.to);
      if (edge.to === focusId) ids.add(edge.from);
    });
    return ids;
  }, [edges, focusId]);
  const fit = useCallback(
    (target = nodes) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect || !target.length) return;
      const bounds = nodeBounds(target);
      const z = Math.min(
        1.08,
        Math.max(
          MIN_ZOOM,
          Math.min(
            (rect.width - 144) / (bounds.maxX - bounds.minX),
            (rect.height - 144) / (bounds.maxY - bounds.minY),
          ),
        ),
      );
      setZoom(z);
      setPan({
        x: (rect.width - (bounds.maxX - bounds.minX) * z) / 2 - bounds.minX * z,
        y:
          (rect.height - (bounds.maxY - bounds.minY) * z) / 2 - bounds.minY * z,
      });
    },
    [nodes],
  );
  useEffect(() => {
    const frame = requestAnimationFrame(() => fit());
    return () => cancelAnimationFrame(frame);
  }, [fit]);
  const select = (node: GraphNode, trigger?: HTMLElement) => {
    if (trigger) selectedTrigger.current = trigger;
    setSelectedId(node.id);
    const connected = nodes.filter(
      (candidate) =>
        candidate.id === node.id ||
        edges.some(
          (edge) =>
            (edge.from === node.id && edge.to === candidate.id) ||
            (edge.to === node.id && edge.from === candidate.id),
        ),
    );
    fit(connected);
  };
  const zoomBy = useCallback(
    (delta: number, clientPoint?: { x: number; y: number }) => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (!rect) return;
      const anchor = clientPoint
        ? { x: clientPoint.x - rect.left, y: clientPoint.y - rect.top }
        : { x: rect.width / 2, y: rect.height / 2 };
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta));
      if (nextZoom === zoom) return;
      setPan((current) => zoomPanAtPoint(current, zoom, nextZoom, anchor));
      setZoom(nextZoom);
    },
    [zoom],
  );
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomBy(event.deltaY > 0 ? -0.08 : 0.08, {
        x: event.clientX,
        y: event.clientY,
      });
    };
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", handleWheel);
  }, [zoomBy]);
  const openNode = (node: GraphNode, trigger?: HTMLElement) => {
    if (node.type === "task") openTask(node.refId, trigger);
    else if (node.type === "project") navigate(workspaceProjectPath(node.refId));
    else if (node.type === "note") navigate(workspaceNotePath(node.refId));
  };
  const open = () => {
    if (selected) openNode(selected, selectedTrigger.current ?? undefined);
  };
  const rows = edges.flatMap((edge) => {
    const from = nodes.find((node) => node.id === edge.from);
    const to = nodes.find((node) => node.id === edge.to);
    return from && to ? [{ ...edge, from, to }] : [];
  });
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" data-connections-root>
      <PageContainer width="canvas" className="min-w-0 pt-6 sm:pt-8">
        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-semibold uppercase text-muted-foreground">
              Workspace graph
            </p>
            <h1 className="pg-page-title mt-1">
              Connections
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              See how projects, tasks, notes, and people connect.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            <Network className="mr-1 inline h-3.5 w-3.5" />
            {nodes.length} nodes / {edges.length} links
          </div>
        </header>
      </PageContainer>
      <PageContainer width="canvas" className="flex min-h-0 min-w-0 flex-1 flex-col pb-6">
        <Tabs value={showList ? "list" : "map"} onValueChange={(value) => setShowList(value === "list")} className="flex min-h-0 min-w-0 flex-1 flex-col gap-0 overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b bg-background px-3 py-2">
            <label className="relative w-64 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Find a node"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search graph"
                className="h-11 w-full rounded border border-border bg-card pl-8 pr-2 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-8"
              />
            </label>
            <select
              aria-label="Filter by project"
              value={projectFilter}
              onChange={(event) => setProjectFilter(event.target.value)}
              className="h-11 max-w-full rounded border border-border bg-card px-2 text-[12px] lg:h-8"
            >
              <option value="all">All projects</option>
              {ws.projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-1">
              {(Object.keys(kinds) as NodeType[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-label={`${kind} nodes`}
                  aria-pressed={kinds[kind]}
                  onClick={() =>
                    setKinds((value) => ({ ...value, [kind]: !value[kind] }))
                  }
                  className={cn(
                    "h-11 rounded border px-2 text-[12.5px] capitalize lg:h-8",
                    kinds[kind]
                      ? "border-foreground/20 bg-foreground text-background"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {kind}s
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowLabels((value) => !value)}
                className="h-11 rounded border px-2 text-[12.5px] lg:h-8"
              >
                {showLabels ? "Hide labels" : "Show labels"}
              </button>
              <button
                type="button"
                onClick={() => zoomBy(-0.12)}
                aria-label="Zoom out"
                className="h-11 w-11 rounded border lg:h-8 lg:w-8"
              >
                <Minus className="mx-auto h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => fit()}
                aria-label="Fit all nodes"
                className="h-11 w-11 rounded border lg:h-8 lg:w-8"
              >
                <Maximize2 className="mx-auto h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setKinds({
                    project: true,
                    task: true,
                    note: true,
                    person: true,
                    label: true,
                  });
                  setProjectFilter("all");
                  setQuery("");
                  setSelectedId(null);
                  requestAnimationFrame(() => fit());
                }}
                aria-label="Reset layout"
                className="h-11 w-11 rounded border lg:h-8 lg:w-8"
              >
                <RotateCcw className="mx-auto h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => zoomBy(0.12)}
                aria-label="Zoom in"
                className="h-11 w-11 rounded border lg:h-8 lg:w-8"
              >
                <Plus className="mx-auto h-4 w-4" />
              </button>
            </div>
            <TabsList aria-label="View mode" className="h-auto rounded border bg-transparent p-0.5">
              <TabsTrigger value="map" className="h-11 flex-none rounded border-0 bg-transparent px-2 text-xs font-normal shadow-none data-[state=active]:bg-accent data-[state=active]:shadow-none lg:h-8 dark:data-[state=active]:bg-accent">
                Map
              </TabsTrigger>
              <TabsTrigger value="list" className="h-11 flex-none rounded border-0 bg-transparent px-2 text-xs font-normal shadow-none data-[state=active]:bg-accent data-[state=active]:shadow-none lg:h-8 dark:data-[state=active]:bg-accent">
                List
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="list" className="m-0 min-h-0 flex-1">
            <section
              data-connections-list
              aria-label="Relationship list"
              className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-4"
            >
              <h2 className="mb-3 text-sm font-semibold">
                Relationship list ({rows.length})
              </h2>
              <ul className="space-y-1.5">
                {rows.map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-2 rounded border border-border px-2 py-1.5 text-xs"
                  >
                    <strong className="uppercase text-muted-foreground">
                      {edgeLabel({
                        id: row.id,
                        type: row.type,
                        from: "",
                        to: "",
                        label: row.label,
                      })}
                    </strong>
                    <button
                      onClick={(event) => {
                        select(row.from, event.currentTarget);
                        openNode(row.from, event.currentTarget);
                      }}
                      className="inline-flex min-h-11 items-center rounded font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0"
                    >
                      {row.from.label}
                    </button>
                    <span aria-hidden>→</span>
                    <button
                      onClick={(event) => {
                        select(row.to, event.currentTarget);
                        openNode(row.to, event.currentTarget);
                      }}
                      className="inline-flex min-h-11 items-center rounded font-medium hover:underline focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0"
                    >
                      {row.to.label}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </TabsContent>
          <TabsContent value="map" className="m-0 min-h-0 flex-1">
            <div className="grid min-h-0 h-full grid-rows-[minmax(28rem,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-1">
              {/* Pointer panning is supplementary; the adjacent list exposes the same relationships and actions to keyboard users. */}
              {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
              <div
                ref={viewportRef}
                data-connections-graph="true"
                role="region"
                aria-label="Interactive relationship graph"
                className="relative min-h-[28rem] min-w-0 overflow-hidden bg-muted/30"
                onPointerDown={(event) => {
                  if (event.button === 0) {
                    didPanRef.current = false;
                    setDragging(true);
                    dragRef.current = {
                      x: event.clientX,
                      y: event.clientY,
                      panX: pan.x,
                      panY: pan.y,
                    };
                  }
                }}
                onPointerMove={(event) => {
                  if (dragging) {
                    if (
                      Math.abs(event.clientX - dragRef.current.x) > 2 ||
                      Math.abs(event.clientY - dragRef.current.y) > 2
                    )
                      didPanRef.current = true;
                    setPan({
                      x:
                        dragRef.current.panX +
                        event.clientX -
                        dragRef.current.x,
                      y:
                        dragRef.current.panY +
                        event.clientY -
                        dragRef.current.y,
                    });
                  }
                }}
                onPointerUp={() => setDragging(false)}
                onPointerLeave={() => setDragging(false)}
                onClick={() => {
                  if (didPanRef.current) {
                    didPanRef.current = false;
                    return;
                  }
                  setSelectedId(null);
                }}
              >
                <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap gap-1 rounded-lg border border-border/70 bg-card/90 p-1 shadow-sm backdrop-blur">
                  {GRAPH_LEGEND.map((item) => (
                    <span
                      key={item.label}
                      className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12.5px] font-semibold uppercase text-muted-foreground"
                    >
                      <span
                        className="h-1.5 w-4 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden
                      />
                      {item.label}
                    </span>
                  ))}
                </div>
                <div
                  className="absolute left-0 top-0 origin-top-left transition-transform duration-150 ease-out motion-reduce:transition-none"
                  style={{
                    width: canvasWidth,
                    height: CANVAS_H,
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transition: dragging ? "none" : undefined,
                  }}
                >
                  <svg
                    data-graph-edges="true"
                    className="absolute inset-0 h-full w-full overflow-visible"
                    viewBox={`0 0 ${canvasWidth} ${CANVAS_H}`}
                  >
                    <defs>
                      <marker
                        id="graph-arrow"
                        viewBox="0 0 10 10"
                        refX="8"
                        refY="5"
                        markerWidth="5"
                        markerHeight="5"
                        orient="auto"
                      >
                        <path
                          d="M 0 0 L 10 5 L 0 10 z"
                          fill="currentColor"
                          opacity=".55"
                        />
                      </marker>
                    </defs>
                    {edges.map((edge) => {
                      const from = nodes.find((node) => node.id === edge.from);
                      const to = nodes.find((node) => node.id === edge.to);
                      if (!from || !to) return null;
                      const highlighted =
                        !!focusId &&
                        related.has(edge.from) &&
                        related.has(edge.to);
                      const dimmed = !!focusId && !highlighted;
                      const style = EDGE_STYLES[edge.type];
                      const color = edgeColor(edge, from, to);
                      const point = {
                        x: (from.x + from.width / 2 + to.x + to.width / 2) / 2,
                        y:
                          (from.y + from.height / 2 + to.y + to.height / 2) / 2,
                      };
                      const label = edgeLabel(edge);
                      return (
                        <g key={edge.id} color={color}>
                          <path
                            d={pathBetween(from, to)}
                            fill="none"
                            stroke={color}
                            strokeWidth={
                              highlighted ? style.width + 0.8 : style.width
                            }
                            strokeDasharray={style.dash}
                            markerEnd="url(#graph-arrow)"
                            opacity={dimmed ? 0.12 : highlighted ? 0.95 : 0.42}
                          />
                          {(showLabels || highlighted) && !dimmed && (
                            <g data-relationship-edge-label="true">
                              <rect
                                x={point.x - 34}
                                y={point.y - 10}
                                width="68"
                                height="20"
                                rx="4"
                                fill="hsl(var(--card))"
                                stroke="hsl(var(--border))"
                              />
                              <text
                                x={point.x}
                                y={point.y + 3.5}
                                textAnchor="middle"
                                className="fill-muted-foreground text-[12.5px] font-medium"
                              >
                                {label}
                              </text>
                            </g>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                  {nodes.map((node) => (
                    <GraphNodeView
                      key={node.id}
                      node={node}
                      selected={selectedId === node.id}
                      related={related.has(node.id)}
                      dimmed={!!focusId && !related.has(node.id)}
                      onSelect={() =>
                        select(
                          node,
                          document.activeElement instanceof HTMLElement
                            ? document.activeElement
                            : undefined,
                        )
                      }
                      onHover={setHoveredId}
                    />
                  ))}
                </div>
              </div>
              <aside
                aria-label="Inspector"
                className={cn(
                  "min-h-0 overflow-y-auto border-t bg-background p-4 lg:border-l lg:border-t-0",
                  selected &&
                    "fixed inset-x-3 bottom-3 z-30 max-h-[70vh] rounded-lg border shadow-xl lg:static lg:max-h-none lg:rounded-none lg:shadow-none",
                )}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[12.5px] font-semibold uppercase text-muted-foreground">
                      {selected ? selected.type : "Overview"}
                    </p>
                    <h2 className="mt-1 text-base font-semibold">
                      {selected?.label ?? "All projects"}
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selected?.meta ??
                        "Map relationships from projects, tasks, notes, labels, assignments, and task relations."}
                    </p>
                  </div>
                  {selected && (
                    <button
                      onClick={() => {
                        selectedTrigger.current?.focus();
                        setSelectedId(null);
                        fit();
                      }}
                      aria-label="Close inspector"
                      className="h-11 w-11 rounded border lg:h-8 lg:w-8"
                    >
                      <X className="mx-auto h-4 w-4" />
                    </button>
                  )}
                </div>
                {selected ? (
                  <>
                    <p className="mb-2 text-xs font-semibold">
                      Connected ({[...related].length - 1})
                    </p>
                    <ul className="space-y-1">
                      {nodes
                        .filter(
                          (node) =>
                            node.id !== selected.id && related.has(node.id),
                        )
                        .map((node) => (
                          <li key={node.id}>
                            <button
                              onClick={() => select(node)}
                              className="min-h-11 w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent lg:min-h-0"
                            >
                              {node.label}
                            </button>
                          </li>
                        ))}
                    </ul>
                    {["task", "project", "note"].includes(selected.type) && (
                      <button
                        onClick={open}
                        className="mt-4 h-11 w-full rounded bg-primary text-sm font-medium text-primary-foreground lg:h-8"
                      >
                        Open {selected.type}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Select a node to inspect its direct relationships.
                    </p>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Dependency arrows point from blocker to blocked task.
                    </p>
                  </>
                )}
              </aside>
            </div>
          </TabsContent>
        </Tabs>
      </PageContainer>
    </div>
  );
}

export default Connections;
