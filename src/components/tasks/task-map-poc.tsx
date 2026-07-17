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
  useNodesState,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { memo, useCallback, useEffect, useMemo, useState } from "react"
import {
  GitBranch,
  LayoutGrid,
  List,
  LockKeyhole,
  Maximize2,
  RotateCcw,
  Waypoints,
} from "lucide-react"
import { useTheme } from "next-themes"

import { AppShell } from "@/components/lovable/shell"
import { StatusIcon } from "@/components/lovable/icons"
import { ProjectViewTitle, Toolbar } from "@/components/lovable/page"
import { Button } from "@/components/ui/button"
import type { Project, WorkItem } from "@/lib/mock-data"
import {
  buildTaskMapPocModel,
  TASK_MAP_VISIBLE_TARGET,
  type TaskMapProjectNode,
  type TaskMapStatusFilter,
  type TaskMapTaskNode,
} from "@/lib/task-map-poc"

type ProjectFlowNode = Node<TaskMapProjectNode["data"], "project">
type TaskFlowNode = Node<TaskMapTaskNode["data"], "task">
type MapFlowNode = ProjectFlowNode | TaskFlowNode
type MapFlowEdge = Edge<{ kind: "hierarchy" | "dependency" }>

const nodeTypes = {
  project: memo(ProjectNode),
  task: memo(TaskNode),
}

const fitViewOptions = { padding: 0.12, maxZoom: 1 }

const ariaLabelConfig = {
  "node.a11yDescription.default":
    "Press Enter or Space to select this task. Use arrow keys to move selected task nodes.",
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

function ProjectNode({ data }: NodeProps<ProjectFlowNode>) {
  return (
    <div className="h-full w-full rounded-xl border border-border/80 bg-muted/35 shadow-[inset_0_1px_0_color-mix(in_oklab,var(--background)_70%,transparent)]">
      <div className="flex h-14 items-center justify-between gap-3 border-b border-border/70 px-5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-tight text-foreground">{data.name}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Project container</p>
        </div>
        <span className="rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
          {data.taskCount}
        </span>
      </div>
    </div>
  )
}

function priorityClasses(priority: WorkItem["priority"]) {
  if (priority === "High") return "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
  if (priority === "Low") return "border-border/70 bg-muted/60 text-muted-foreground"
  return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300"
}

function TaskNode({ data, selected }: NodeProps<TaskFlowNode>) {
  return (
    <div
      className={`h-full w-full rounded-lg border bg-card px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none ${
        selected
          ? "border-foreground/45 shadow-[0_0_0_3px_color-mix(in_oklab,var(--foreground)_12%,transparent)]"
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
          <p className="line-clamp-2 text-[12px] font-semibold leading-4 text-foreground">{data.title}</p>
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
            {data.due ? <span className="ml-auto truncate tabular-nums text-muted-foreground">{data.due}</span> : null}
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
  nodes: ReturnType<typeof buildTaskMapPocModel>["nodes"],
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
        draggable: false,
        deletable: false,
        selectable: false,
        focusable: true,
        ariaRole: "region",
        ariaLabel: `${node.data.name} project container with ${node.data.taskCount} tasks`,
        domAttributes: {
          "aria-roledescription": "project map container",
          "data-project-map-container": node.data.projectId,
        },
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
      draggable: true,
      deletable: false,
      selectable: true,
      focusable: true,
      ariaRole: "group",
      ariaLabel: `${node.data.title}, ${node.data.status}, ${node.data.priority} priority, ${node.data.projectName}`,
      domAttributes: {
        "aria-roledescription": "draggable task map node",
        "data-task-map-id": node.data.taskId,
      },
    }
  })
}

function MobileMapFallback({
  items,
  edges,
  listHref,
}: {
  items: WorkItem[]
  edges: MapFlowEdge[]
  listHref: string
}) {
  const hierarchyCount = edges.filter((edge) => edge.data?.kind === "hierarchy").length
  const dependencyCount = edges.filter((edge) => edge.data?.kind === "dependency").length

  return (
    <div className="h-full overflow-y-auto px-4 py-5" data-task-map-mobile-fallback>
      <div className="mx-auto max-w-2xl rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-lg border border-border bg-muted p-2 text-muted-foreground">
            <Waypoints className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight">Map summary</h1>
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
              Full Map interaction needs a desktop-sized screen and a precise pointer. This summary keeps the same tasks and relationships readable here.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
          <span className="rounded border border-border bg-muted/50 px-2 py-1">{items.length} tasks</span>
          <span className="rounded border border-border bg-muted/50 px-2 py-1">{hierarchyCount} parent links</span>
          <span className="rounded border border-border bg-muted/50 px-2 py-1">{dependencyCount} dependencies</span>
        </div>
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link href={listHref}>
            <List />
            Open task list
          </Link>
        </Button>
      </div>
      <div className="mx-auto mt-4 max-w-2xl overflow-hidden rounded-xl border border-border bg-card">
        {items.length === 0 ? (
          <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">No tasks match the current Map filters.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-start gap-3 border-b border-border/70 px-4 py-3 last:border-b-0">
              <span className="mt-0.5 text-muted-foreground"><StatusIcon s={item.status} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{item.title}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.status} · {item.priority} priority</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export function TaskMapPoc({
  projects,
  workItems,
  projectId,
  loading,
  error,
}: {
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
  const [flow, setFlow] = useState<ReactFlowInstance<MapFlowNode, MapFlowEdge> | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  const model = useMemo(
    () => buildTaskMapPocModel({ projects, workItems, projectId, statusFilter }),
    [projectId, projects, statusFilter, workItems],
  )
  const initialNodes = useMemo(() => toFlowNodes(model.nodes), [model.nodes])
  const [nodes, setNodes, onNodesChange] = useNodesState<MapFlowNode>(initialNodes)
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
        labelStyle: {
          fill: "var(--muted-foreground)",
          fontSize: 10,
          fontWeight: 500,
        },
        labelBgStyle: {
          fill: "var(--card)",
          fillOpacity: 0.92,
        },
        labelBgPadding: [4, 2],
        labelBgBorderRadius: 4,
      })),
    [model.edges],
  )

  useEffect(() => {
    setNodes(initialNodes)
    if (flow && initialNodes.length > 0) {
      window.requestAnimationFrame(() => {
        void flow.fitView({ padding: 0.12, duration: 180, maxZoom: 1 })
      })
    }
  }, [flow, initialNodes, setNodes])

  const resetLayout = useCallback(() => {
    setNodes(initialNodes)
    if (flow && initialNodes.length > 0) {
      void flow.fitView({ padding: 0.12, duration: 180, maxZoom: 1 })
    }
  }, [flow, initialNodes, setNodes])

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams<MapFlowNode, MapFlowEdge>) => {
      const taskNode = selectedNodes.find((node): node is TaskFlowNode => node.type === "task")
      setSelectedTaskId(taskNode?.data.taskId ?? null)
    },
    [],
  )

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

  const changeProject = (nextProjectId: string) => {
    router.push(
      nextProjectId
        ? `/app/tasks?view=map&project=${encodeURIComponent(nextProjectId)}`
        : "/app/tasks?view=map",
    )
  }

  return (
    <AppShell
      title={<ProjectViewTitle projectName={activeProject?.name} view="Task Map POC" />}
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
              onChange={(event) => changeProject(event.target.value)}
              className="h-7 max-w-40 rounded border border-border bg-card px-2 text-[11px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Filter Map by project"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>
          <label className="flex h-7 items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="sr-only sm:not-sr-only">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as TaskMapStatusFilter)}
              className="h-7 max-w-36 rounded border border-border bg-card px-2 text-[11px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={resetLayout}
            disabled={!canvasSupported || model.nodes.length === 0}
            aria-label="Reset Map layout"
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
            <span className="hidden xl:inline">Fit view</span>
          </Button>
        </Toolbar>
      }
    >
      <div className="relative h-full min-h-0 bg-background" data-task-map-poc>
        {!canvasSupported ? (
          <MobileMapFallback items={model.items} edges={edges} listHref={listHref} />
        ) : model.overHardLimit ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-md rounded-xl border border-border bg-card p-6 text-center">
              <Waypoints className="mx-auto h-5 w-5 text-muted-foreground" />
              <h1 className="mt-3 text-[15px] font-semibold">This Map is too large to open safely.</h1>
              <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
                {model.totalMatching} tasks match. Choose a project or narrower status before opening the canvas.
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
            onSelectionChange={onSelectionChange}
            nodesDraggable
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
            <Panel position="top-left" className="m-3">
              <div className="rounded-md border border-border/80 bg-card/95 px-2.5 py-1.5 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
                POC · positions stay in memory only
              </div>
            </Panel>
            {loading ? (
              <Panel position="top-center" className="m-3">
                <div className="rounded-md border border-border bg-card px-3 py-2 text-[11px] text-muted-foreground shadow-sm">
                  Loading current tasks…
                </div>
              </Panel>
            ) : null}
            {error ? (
              <Panel position="top-center" className="m-3">
                <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-[11px] text-red-700 shadow-sm dark:border-red-900 dark:bg-red-950/80 dark:text-red-200">
                  {error}
                </div>
              </Panel>
            ) : null}
            {model.totalMatching > TASK_MAP_VISIBLE_TARGET ? (
              <Panel position="top-right" className="m-3">
                <div className="max-w-64 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-800 shadow-sm dark:border-amber-900 dark:bg-amber-950/80 dark:text-amber-200">
                  Large Map: off-screen elements render progressively. A project filter will be easier to scan.
                </div>
              </Panel>
            ) : null}
            {model.totalMatching === 0 && !loading ? (
              <Panel position="top-center" className="m-3">
                <div className="rounded-lg border border-dashed border-border bg-card px-5 py-4 text-center">
                  <p className="text-[13px] font-medium">No tasks match this Map.</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Change the project or status filter.</p>
                </div>
              </Panel>
            ) : null}
            {selectedItem ? (
              <Panel position="bottom-right" className="m-3">
                <div className="w-72 rounded-lg border border-border bg-card/95 p-3 shadow-md backdrop-blur" data-task-map-inspector>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Task truth · read only</p>
                  <p className="mt-1.5 text-[13px] font-semibold leading-5 text-foreground">{selectedItem.title}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5">{selectedItem.status}</span>
                    <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5">{selectedItem.priority}</span>
                    {selectedItem.due ? <span className="rounded border border-border bg-muted/50 px-1.5 py-0.5">Due {selectedItem.due}</span> : null}
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
                    Dragging changes only this temporary layout. It does not update the task, project, status, or relationships.
                  </p>
                </div>
              </Panel>
            ) : null}
          </ReactFlow>
        )}
      </div>
    </AppShell>
  )
}
