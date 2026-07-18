"use client"

import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Panel,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
  type Viewport,
  useNodesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  GitBranch,
  LayoutGrid,
  List,
  LockKeyhole,
  Maximize2,
  RotateCcw,
  Save,
  Waypoints,
} from "lucide-react"
import { useTheme } from "next-themes"

import { AppShell } from "@/components/lovable/shell"
import { PageWidth } from "@/components/lovable/page-width"
import { StatusIcon } from "@/components/lovable/icons"
import { ProjectViewTitle, Toolbar } from "@/components/lovable/page"
import { Button } from "@/components/ui/button"
import type { Project, WorkItem } from "@/lib/mock-data"
import { apiFetch } from "@/lib/server-session-client"
import {
  buildTaskMapModel,
  TASK_MAP_VISIBLE_TARGET,
  type TaskMapLayout,
  type TaskMapProjectNode,
  type TaskMapStatusFilter,
  type TaskMapTaskNode,
} from "@/lib/task-map"

type ProjectFlowNode = Node<TaskMapProjectNode["data"], "project">
type TaskFlowNode = Node<TaskMapTaskNode["data"], "task">
type MapFlowNode = ProjectFlowNode | TaskFlowNode
type MapFlowEdge = Edge<{ kind: "hierarchy" | "dependency" }>

type MapState = {
  schemaVersion: 1
  revision: number
  canEditSharedLayout: boolean
  taskPlacements: TaskMapLayout["taskPlacements"]
  projectPlacements: TaskMapLayout["projectPlacements"]
  sections: Array<{
    id: string
    name: string
    sortOrder: number
    x: number
    y: number
    width: number
    height: number
    color: string | null
  }>
  preferences: {
    viewport: Viewport
    statusFilter: TaskMapStatusFilter
    trayOpen: boolean
    collapsedProjectIds: string[]
    collapsedSectionIds: string[]
  }
}

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "conflict" | "failed"

const nodeTypes = {
  project: memo(ProjectNode),
  task: memo(TaskNode),
}
const fitViewOptions = { padding: 0.12, maxZoom: 1 }
const ariaLabelConfig = {
  "node.a11yDescription.default":
    "Press Enter or Space to select this task. Use arrow keys to move an editable selected node.",
  "edge.a11yDescription.default":
    "Press Enter or Space to select this task relationship.",
  "controls.ariaLabel": "Task Map controls",
}
const statusOptions: Array<{ value: TaskMapStatusFilter; label: string }> = [
  { value: "open", label: "Open tasks" },
  { value: "all", label: "All tasks" },
  { value: "completed", label: "Completed" },
  { value: "Backlog", label: "Backlog" },
  { value: "To Do", label: "To Do" },
  { value: "In Progress", label: "In Progress" },
  { value: "In Review", label: "In Review" },
  { value: "Done", label: "Done" },
]

function ProjectNode({ data, selected }: NodeProps<ProjectFlowNode>) {
  return (
    <div
      className={`h-full w-full rounded-xl border bg-muted/35 ${
        selected ? "border-foreground/40 ring-2 ring-foreground/10" : "border-border/80"
      }`}
    >
      <div className="flex h-14 items-center justify-between gap-3 border-b border-border/70 px-5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">
            {data.name}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {data.projectId ? "Project" : "Workspace tasks"}
          </p>
        </div>
        <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {data.taskCount}
        </span>
      </div>
    </div>
  )
}

function priorityClasses(priority: WorkItem["priority"]) {
  if (priority === "High") {
    return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
  }
  if (priority === "Low") return "border-border/70 bg-muted/60 text-muted-foreground"
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
}

function TaskNode({ data, selected }: NodeProps<TaskFlowNode>) {
  return (
    <div
      className={`h-full w-full rounded-lg border bg-card px-3.5 py-3 shadow-sm transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none ${
        selected
          ? "border-foreground/45 ring-2 ring-foreground/10"
          : "border-border hover:border-foreground/25"
      }`}
      data-task-map-node={data.taskId}
    >
      <Handle
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="!h-2 !w-2 !border-2 !border-card !bg-muted-foreground"
      />
      <Handle
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="!h-2 !w-2 !border-2 !border-card !bg-muted-foreground"
      />
      <div className="flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-muted-foreground">
          <StatusIcon s={data.status} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[12px] font-semibold leading-4 text-foreground">
            {data.title}
          </p>
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[10px]">
            <span className={`rounded border px-1.5 py-0.5 font-medium ${priorityClasses(data.priority)}`}>
              {data.priority}
            </span>
            {data.isSubtask ? (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <GitBranch className="h-3 w-3" />
                Subtask
              </span>
            ) : null}
            {data.blocked ? (
              <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-300">
                <LockKeyhole className="h-3 w-3" />
                Blocked
              </span>
            ) : null}
            {data.due ? (
              <span className="ml-auto truncate tabular-nums text-muted-foreground">
                {data.due}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

function useCanvasSupport() {
  const [supported, setSupported] = useState(false)
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px) and (pointer: fine)")
    const update = () => setSupported(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])
  return supported
}

function toFlowNodes(
  nodes: ReturnType<typeof buildTaskMapModel>["nodes"],
  editable: boolean,
): MapFlowNode[] {
  return nodes.map((node) => {
    if (node.type === "project") {
      return {
        id: node.id,
        type: "project",
        data: node.data,
        position: node.position,
        width: node.width,
        height: node.height,
        style: { width: node.width, height: node.height },
        draggable: editable,
        deletable: false,
        selectable: true,
        focusable: true,
        ariaRole: "region",
        ariaLabel: `${node.data.name} container with ${node.data.taskCount} tasks`,
      }
    }
    return {
      id: node.id,
      type: "task",
      data: node.data,
      position: node.position,
      width: node.width,
      height: node.height,
      parentId: node.parentId,
      extent: "parent",
      draggable: editable,
      deletable: false,
      selectable: true,
      focusable: true,
      ariaRole: "group",
      ariaLabel: `${node.data.title}, ${node.data.status}, ${node.data.priority} priority, ${node.data.projectName}`,
    }
  })
}

function mergeNodeLayout(layout: TaskMapLayout, nodes: MapFlowNode[]): TaskMapLayout {
  const tasks = new Map(layout.taskPlacements.map((placement) => [placement.workItemId, placement]))
  const projects = new Map(
    layout.projectPlacements.map((placement) => [placement.projectId ?? "no-project", placement]),
  )
  for (const node of nodes) {
    if (node.type === "task") {
      tasks.set(node.data.taskId, {
        workItemId: node.data.taskId,
        sectionId: tasks.get(node.data.taskId)?.sectionId ?? null,
        x: node.position.x,
        y: node.position.y,
      })
    } else {
      projects.set(node.data.projectId ?? "no-project", {
        projectId: node.data.projectId,
        x: node.position.x,
        y: node.position.y,
      })
    }
  }
  return {
    taskPlacements: [...tasks.values()],
    projectPlacements: [...projects.values()],
  }
}

function MobileMapFallback({
  items,
  edgeCount,
  listHref,
}: {
  items: WorkItem[]
  edgeCount: number
  listHref: string
}) {
  return (
    <div className="h-full overflow-y-auto px-4 py-5" data-task-map-mobile-fallback>
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-lg border border-border bg-muted p-2 text-muted-foreground">
            <Waypoints className="h-4 w-4" />
          </span>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">Map summary</h1>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              The interactive canvas needs a desktop-sized screen and precise pointer.
              The same tasks remain readable here.
            </p>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">
          {items.length} tasks · {edgeCount} relationships
        </p>
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link href={listHref}>
            <List />
            Open task list
          </Link>
        </Button>
      </div>
      <div className="mx-auto mt-4 max-w-2xl overflow-hidden rounded-xl border border-border bg-card">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"
          >
            <span className="mt-0.5 text-muted-foreground">
              <StatusIcon s={item.status} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium">{item.title}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {item.status} · {item.priority} priority
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TaskMap({
  workspaceId,
  projects,
  workItems,
  projectId,
  loading,
  error,
}: {
  workspaceId: string
  projects: Project[]
  workItems: WorkItem[]
  projectId?: string | null
  loading: boolean
  error: string | null
}) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const canvasSupported = useCanvasSupport()
  const [statusFilter, setStatusFilter] = useState<TaskMapStatusFilter>("open")
  const [layout, setLayout] = useState<TaskMapLayout>({
    taskPlacements: [],
    projectPlacements: [],
  })
  const [sections, setSections] = useState<MapState["sections"]>([])
  const [revision, setRevision] = useState(0)
  const [canEdit, setCanEdit] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [flow, setFlow] = useState<ReactFlowInstance<MapFlowNode, MapFlowEdge> | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const preferenceTimer = useRef<number | null>(null)
  const initialViewport = useRef<Viewport>({ x: 0, y: 0, zoom: 1 })
  const viewportAppliedFor = useRef("")

  const mapUrl = useMemo(() => {
    const query = new URLSearchParams({ workspaceId })
    if (projectId) query.set("projectId", projectId)
    return `/api/map?${query.toString()}`
  }, [projectId, workspaceId])

  const loadMap = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await apiFetch(mapUrl, { cache: "no-store", signal })
      if (!response.ok) {
        setCanEdit(false)
        setMapError("Map layout could not be loaded. Tasks are still shown read-only.")
        return
      }
      const state = (await response.json()) as MapState
      setMapError(null)
      setLayout({
        taskPlacements: state.taskPlacements,
        projectPlacements: state.projectPlacements,
      })
      setSections(state.sections)
      setRevision(state.revision)
      setCanEdit(state.canEditSharedLayout)
      setStatusFilter(state.preferences.statusFilter)
      initialViewport.current = state.preferences.viewport
      viewportAppliedFor.current = ""
      setSaveState("idle")
    } catch {
      if (signal?.aborted) return
      setCanEdit(false)
      setMapError("Map layout could not be loaded. Tasks are still shown read-only.")
    }
  }, [mapUrl])

  useEffect(() => {
    const controller = new AbortController()
    const loadTimer = window.setTimeout(() => void loadMap(controller.signal), 0)
    return () => {
      controller.abort()
      window.clearTimeout(loadTimer)
      if (preferenceTimer.current !== null) window.clearTimeout(preferenceTimer.current)
    }
  }, [loadMap])

  const model = useMemo(
    () =>
      buildTaskMapModel({
        projects,
        workItems,
        projectId,
        statusFilter,
        layout,
      }),
    [layout, projectId, projects, statusFilter, workItems],
  )
  const defaultModel = useMemo(
    () =>
      buildTaskMapModel({
        projects,
        workItems,
        projectId,
        statusFilter,
      }),
    [projectId, projects, statusFilter, workItems],
  )
  const initialNodes = useMemo(
    () => toFlowNodes(model.nodes, canEdit),
    [canEdit, model.nodes],
  )
  const [nodes, setNodes, onNodesChange] = useNodesState<MapFlowNode>(initialNodes)
  useEffect(() => {
    setNodes(initialNodes)
  }, [initialNodes, setNodes])
  useEffect(() => {
    if (!flow || viewportAppliedFor.current === mapUrl) return
    viewportAppliedFor.current = mapUrl
    void flow.setViewport(initialViewport.current, { duration: 0 })
  }, [flow, mapUrl, revision])

  const edges = useMemo<MapFlowEdge[]>(
    () =>
      model.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "smoothstep",
        label: edge.label,
        data: { kind: edge.kind },
        deletable: false,
        selectable: true,
        focusable: true,
        ariaLabel:
          edge.kind === "hierarchy"
            ? "Parent to subtask relationship"
            : "Blocking task dependency",
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: edge.kind === "dependency" ? "var(--foreground)" : "var(--muted-foreground)",
        },
        style: {
          stroke: edge.kind === "dependency" ? "var(--foreground)" : "var(--muted-foreground)",
          strokeWidth: edge.kind === "dependency" ? 1.6 : 1.2,
          strokeDasharray: edge.kind === "hierarchy" ? "5 4" : undefined,
        },
        labelStyle: { fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 },
        labelBgStyle: { fill: "var(--card)", fillOpacity: 0.92 },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
      })),
    [model.edges],
  )

  const schedulePreferenceSave = useCallback(
    (viewport: Viewport, nextStatusFilter: TaskMapStatusFilter) => {
      if (preferenceTimer.current !== null) window.clearTimeout(preferenceTimer.current)
      preferenceTimer.current = window.setTimeout(() => {
        void apiFetch(mapUrl, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            schemaVersion: 1,
            viewport,
            statusFilter: nextStatusFilter,
            trayOpen: false,
            collapsedProjectIds: [],
            collapsedSectionIds: [],
          }),
        }).catch(() => undefined)
      }, 400)
    },
    [mapUrl],
  )

  const saveLayout = useCallback(async () => {
    if (!canEdit || saveState === "saving") return
    const captured = mergeNodeLayout(layout, nodes)
    setLayout(captured)
    setSaveState("saving")
    try {
      const response = await apiFetch(mapUrl, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          schemaVersion: 1,
          revision,
          taskPlacements: captured.taskPlacements,
          projectPlacements: captured.projectPlacements,
        }),
      })
      if (response.status === 409) {
        setSaveState("conflict")
        return
      }
      if (!response.ok) {
        setSaveState("failed")
        return
      }
      const payload = (await response.json()) as { revision: number }
      setRevision(payload.revision)
      setSaveState("saved")
    } catch {
      setSaveState("failed")
    }
  }, [canEdit, layout, mapUrl, nodes, revision, saveState])

  const resetLayout = useCallback(() => {
    if (!canEdit) return
    const resetNodes = toFlowNodes(defaultModel.nodes, true)
    setNodes(resetNodes)
    setLayout((current) => mergeNodeLayout(current, resetNodes))
    setSaveState("unsaved")
    if (flow && resetNodes.length > 0) {
      void flow.fitView({ padding: 0.12, duration: 180, maxZoom: 1 })
    }
  }, [canEdit, defaultModel.nodes, flow, setNodes])

  const selectedItem = selectedTaskId
    ? model.items.find((item) => item.id === selectedTaskId) ?? null
    : null
  const activeProject = projectId
    ? projects.find((project) => project.id === projectId) ?? null
    : null
  const listHref = projectId
    ? `/app/tasks?project=${encodeURIComponent(projectId)}`
    : "/app/tasks"
  const boardHref = projectId
    ? `/app/tasks?view=board&project=${encodeURIComponent(projectId)}`
    : "/app/tasks?view=board"

  return (
    <AppShell
      title={<ProjectViewTitle projectName={activeProject?.name} view="Map" />}
      toolbar={
        <Toolbar>
          <div className="lov-segment-group">
            <Link href={listHref} className="lov-segment">
              <List className="h-3.5 w-3.5" />
              <span>List</span>
            </Link>
            <Link href={boardHref} className="lov-segment">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Board</span>
            </Link>
            <span className="lov-segment lov-segment-active">
              <Waypoints className="h-3.5 w-3.5" />
              <span>Map</span>
            </span>
          </div>
          <label className="flex h-7 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="sr-only sm:not-sr-only">Project</span>
            <select
              value={projectId ?? ""}
              onChange={(event) => {
                router.push(
                  event.target.value
                    ? `/app/tasks?view=map&project=${encodeURIComponent(event.target.value)}`
                    : "/app/tasks?view=map",
                )
              }}
              className="h-7 max-w-40 rounded border border-border bg-card px-2 text-[11px] text-foreground"
              aria-label="Choose workspace or project Map"
            >
              <option value="">Workspace Map</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="flex h-7 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="sr-only sm:not-sr-only">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                const next = event.target.value as TaskMapStatusFilter
                setStatusFilter(next)
                schedulePreferenceSave(
                  flow?.getViewport() ?? initialViewport.current,
                  next,
                )
              }}
              className="h-7 max-w-36 rounded border border-border bg-card px-2 text-[11px] text-foreground"
              aria-label="Filter Map by completion or status"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <span className="hidden text-[11px] tabular-nums text-muted-foreground xl:inline">
            {model.totalMatching} tasks · {model.edges.length} links
          </span>
          <span className="sm:ml-auto" />
          {canEdit ? (
            <Button
              type="button"
              size="xs"
              variant={saveState === "unsaved" || saveState === "failed" ? "default" : "outline"}
              onClick={() => void saveLayout()}
              disabled={saveState === "saving" || saveState === "conflict"}
            >
              <Save />
              {saveState === "saving"
                ? "Saving"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "failed"
                    ? "Retry save"
                    : saveState === "unsaved"
                      ? "Save layout"
                      : "Layout saved"}
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Layout read-only</span>
          )}
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={resetLayout}
            disabled={!canEdit || !canvasSupported || model.nodes.length === 0}
            aria-label="Reset visible Map layout"
          >
            <RotateCcw />
            <span className="hidden xl:inline">Reset</span>
          </Button>
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => {
              if (flow) void flow.fitView({ padding: 0.12, duration: 180, maxZoom: 1 })
            }}
            disabled={!canvasSupported || model.nodes.length === 0}
            aria-label="Fit Map to view"
          >
            <Maximize2 />
            <span className="hidden xl:inline">Fit</span>
          </Button>
        </Toolbar>
      }
    >
      <PageWidth mode="canvas" className="relative h-full min-h-0 bg-background" data-task-map>
        {!canvasSupported ? (
          <MobileMapFallback
            items={model.items}
            edgeCount={model.edges.length}
            listHref={listHref}
          />
        ) : model.overHardLimit ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
              <Waypoints className="mx-auto h-5 w-5 text-muted-foreground" />
              <h1 className="mt-3 text-[15px] font-semibold">This Map is too large to open safely.</h1>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                {model.totalMatching} tasks match. Choose a project or narrower status.
              </p>
            </div>
          </div>
        ) : (
          <ReactFlow<MapFlowNode, MapFlowEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onInit={setFlow}
            onNodeDragStop={(_event, draggedNode) => {
              setLayout((current) => mergeNodeLayout(current, [draggedNode]))
              setSaveState("unsaved")
            }}
            onMoveEnd={(_event, viewport) => schedulePreferenceSave(viewport, statusFilter)}
            onSelectionChange={({ nodes: selectedNodes }: OnSelectionChangeParams<MapFlowNode, MapFlowEdge>) => {
              const taskNode = selectedNodes.find(
                (node): node is TaskFlowNode => node.type === "task",
              )
              setSelectedTaskId(taskNode?.data.taskId ?? null)
            }}
            nodesDraggable={canEdit}
            nodesConnectable={false}
            nodesFocusable
            edgesFocusable
            elementsSelectable
            deleteKeyCode={null}
            zoomOnDoubleClick={false}
            fitView
            fitViewOptions={fitViewOptions}
            minZoom={0.2}
            maxZoom={1.5}
            onlyRenderVisibleElements={model.totalMatching > TASK_MAP_VISIBLE_TARGET}
            colorMode={resolvedTheme === "dark" ? "dark" : "light"}
            ariaLabelConfig={ariaLabelConfig}
            className="bg-background"
          >
            <Background gap={24} size={1} color="var(--border)" />
            <Controls showInteractive={false} position="bottom-left" />
            {loading ? (
              <Panel position="top-center" className="m-3">
                <div className="rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground shadow-sm">
                  Loading current tasks…
                </div>
              </Panel>
            ) : null}
            {error || mapError ? (
              <Panel position="top-center" className="m-3">
                <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/80 dark:text-red-200">
                  {error ?? mapError}
                </div>
              </Panel>
            ) : null}
            {saveState === "conflict" ? (
              <Panel position="top-center" className="m-3">
                <div className="flex items-center gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900 shadow-sm dark:border-amber-900 dark:bg-amber-950/80 dark:text-amber-100">
                  <span>The shared layout changed elsewhere. Your local positions are still here.</span>
                  <Button type="button" size="xs" variant="outline" onClick={() => void loadMap()}>
                    Load latest
                  </Button>
                </div>
              </Panel>
            ) : null}
            {model.totalMatching > TASK_MAP_VISIBLE_TARGET ? (
              <Panel position="top-right" className="m-3">
                <div className="max-w-64 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 shadow-sm dark:border-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                  Large Map: off-screen elements render progressively.
                </div>
              </Panel>
            ) : null}
            {model.totalMatching === 0 && !loading ? (
              <Panel position="top-center" className="m-3">
                <div className="rounded-lg border border-dashed border-border bg-card px-5 py-4 text-center">
                  <p className="text-[13px] font-medium">No tasks match this Map.</p>
                </div>
              </Panel>
            ) : null}
            {selectedItem ? (
              <Panel position="bottom-right" className="m-3">
                <div className="w-72 rounded-lg border border-border bg-card/95 p-3 shadow-md backdrop-blur" data-task-map-inspector>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Task truth · read only
                  </p>
                  <p className="mt-1.5 text-[13px] font-semibold leading-5">
                    {selectedItem.title}
                  </p>
                  <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                    Layout changes never change task status, project, hierarchy, or dependencies.
                  </p>
                </div>
              </Panel>
            ) : null}
            {sections.length > 0 ? (
              <Panel position="top-left" className="m-3">
                <div className="rounded-md border border-border bg-card/95 px-2.5 py-1.5 text-[10px] text-muted-foreground shadow-sm">
                  {sections.length} saved visual {sections.length === 1 ? "section" : "sections"}
                </div>
              </Panel>
            ) : null}
          </ReactFlow>
        )}
      </PageWidth>
    </AppShell>
  )
}
