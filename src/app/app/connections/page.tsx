"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, FolderKanban, GitBranch, Link2, Maximize2, Minus, Network, Plus, RotateCcw } from "lucide-react"

import { AppShell } from "@/components/lovable/shell"
import { apiFetch, getServerSession } from "@/lib/server-session-client"
import {
  buildConnectionsGraphModel,
  buildConnectionsModel,
  type Connection,
  type ConnectionProject,
  type ConnectionRelation,
  type ConnectionWorkItem,
} from "@/lib/connections"

type LoadState = "loading" | "ready" | "error" | "unauthorized"
type RelationFilter = Connection["kind"]

export function ConnectionsPageContent({ basePath = "/app" }: { basePath?: "/app" | "/demo" }) {
  const [state, setState] = useState<LoadState>("loading")
  const [projects, setProjects] = useState<ConnectionProject[]>([])
  const [workItems, setWorkItems] = useState<ConnectionWorkItem[]>([])
  const [relations, setRelations] = useState<ConnectionRelation[]>([])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const session = await getServerSession()
        const query = `workspaceId=${encodeURIComponent(session.workspace.id)}`
        const responses = await Promise.all([
          apiFetch(`/api/projects?${query}`, { cache: "no-store" }),
          apiFetch(`/api/work-items?${query}`, { cache: "no-store" }),
          apiFetch(`/api/work-item-relations?${query}`, { cache: "no-store" }),
        ])
        if (!active) return
        if (responses.some((response) => response.status === 401 || response.status === 403)) {
          setState("unauthorized")
          return
        }
        if (responses.some((response) => !response.ok)) throw new Error("Connections request failed")
        const [projectPayload, workItemPayload, relationPayload] = await Promise.all(responses.map((response) => response.json()))
        setProjects(projectPayload.projects)
        setWorkItems(workItemPayload.workItems)
        setRelations(relationPayload.relations)
        setState("ready")
      } catch {
        if (active) setState("error")
      }
    })()
    return () => { active = false }
  }, [])

  const model = buildConnectionsModel({ projects, workItems, relations })

  return (
    <AppShell title={<span className="font-medium">Connections</span>}>
      <main className="flex w-full max-w-none flex-col gap-5 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8" aria-live="polite">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace relationships</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Connections</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">See dependencies and parent work without duplicating the tasks that define them.</p>
        </header>

        {state === "loading" && <StateMessage icon={Network} title="Loading connections" body="Gathering workspace relationships." />}
        {state === "error" && <StateMessage icon={AlertTriangle} title="Unable to load connections" body="Try refreshing the page. Your workspace data was not changed." />}
        {state === "unauthorized" && <StateMessage icon={AlertTriangle} title="You do not have access to these connections" body="Ask a workspace administrator to confirm your membership." />}

        {state === "ready" && model.connections.length === 0 && (
          <StateMessage icon={GitBranch} title="No connections yet" body="Add a dependency or a child task from a task's details. Connections will appear here automatically." />
        )}

        {state === "ready" && model.connections.length > 0 && (
          <>
            <section className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card md:grid-cols-5" aria-label="Relationship summary">
              <Summary label="Connections" value={model.summary.total} />
              <Summary label="Blocking" value={model.summary.blocking} />
              <Summary label="Related" value={model.summary.related} />
              <Summary label="Parent / child" value={model.summary.hierarchy} />
              <Summary label="Projects" value={model.summary.projects} />
            </section>

            <section className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(22rem,.85fr)]">
              <ConnectionsGraph basePath={basePath} connections={model.connections} />
              <RelationshipList basePath={basePath} connections={model.connections} />
            </section>
          </>
        )}
      </main>
    </AppShell>
  )
}

function ConnectionsGraph({ basePath, connections }: { basePath: "/app" | "/demo"; connections: Connection[] }) {
  const [filters, setFilters] = useState<Record<RelationFilter, boolean>>({ blocking: true, related: true, hierarchy: true })
  const [projectId, setProjectId] = useState("all")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const graphRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  const projectOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const connection of connections) {
      if (connection.sourceProject) map.set(connection.sourceProject.id, connection.sourceProject.name)
      if (connection.targetProject) map.set(connection.targetProject.id, connection.targetProject.name)
    }
    return [...map].map(([id, name]) => ({ id, name }))
  }, [connections])
  const visibleConnections = connections.filter((connection) =>
    filters[connection.kind] && (projectId === "all" || connection.sourceProject?.id === projectId || connection.targetProject?.id === projectId)
  )
  const graph = useMemo(() => buildConnectionsGraphModel(visibleConnections), [visibleConnections])
  const selectedNode = graph.nodes.find((node) => node.id === selectedId) ?? null

  const fitGraph = useCallback(() => {
    const rect = graphRef.current?.getBoundingClientRect()
    if (!rect || graph.nodes.length === 0) return
    const nextZoom = Math.min(1, Math.max(0.3, Math.min((rect.width - 64) / graph.width, (rect.height - 64) / graph.height)))
    setZoom(nextZoom)
    setPan({ x: (rect.width - graph.width * nextZoom) / 2, y: (rect.height - graph.height * nextZoom) / 2 })
  }, [graph.height, graph.nodes.length, graph.width])

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(fitGraph)
    return () => cancelAnimationFrame(frame)
  }, [fitGraph])

  const zoomBy = (amount: number) => {
    const nextZoom = Math.min(1.7, Math.max(0.3, zoom + amount))
    const rect = graphRef.current?.getBoundingClientRect()
    if (!rect) return
    const ratio = nextZoom / zoom
    setPan({ x: rect.width / 2 - ratio * (rect.width / 2 - pan.x), y: rect.height / 2 - ratio * (rect.height / 2 - pan.y) })
    setZoom(nextZoom)
  }
  const resetGraph = () => {
    setFilters({ blocking: true, related: true, hierarchy: true })
    setProjectId("all")
    setSelectedId(null)
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border bg-card" aria-labelledby="connection-graph-title">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div className="mr-auto min-w-0">
          <h2 id="connection-graph-title" className="text-sm font-semibold">Relationship graph</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Pan the map, choose a node, or use the relationship list beside it.</p>
        </div>
        <select value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Filter graph by project" className="h-8 max-w-40 rounded border bg-background px-2 text-xs">
          <option value="all">All projects</option>
          {projectOptions.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <div className="flex items-center gap-1" aria-label="Graph view controls">
          <button type="button" onClick={() => zoomBy(-0.12)} className="lov-icon-btn h-8 w-8" aria-label="Zoom out"><Minus className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={fitGraph} className="lov-icon-btn h-8 w-8" aria-label="Fit graph to view"><Maximize2 className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={resetGraph} className="lov-icon-btn h-8 w-8" aria-label="Reset graph view"><RotateCcw className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => zoomBy(0.12)} className="lov-icon-btn h-8 w-8" aria-label="Zoom in"><Plus className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 border-b px-4 py-2" aria-label="Filter relationship types">
        {(["blocking", "related", "hierarchy"] as const).map((kind) => (
          <button key={kind} type="button" aria-pressed={filters[kind]} onClick={() => setFilters((current) => ({ ...current, [kind]: !current[kind] }))} className={`rounded border px-2 py-1 text-[11px] font-medium ${filters[kind] ? "bg-muted text-foreground" : "text-muted-foreground"}`}>
            {kind === "blocking" ? "Blocking" : kind === "related" ? "Related" : "Parent / child"}
          </button>
        ))}
      </div>
      <div
        ref={graphRef}
        data-connection-graph="true"
        role="region"
        aria-label="Interactive relationship graph"
        className="relative h-[28rem] min-h-[22rem] touch-none overflow-hidden bg-muted/30 sm:h-[32rem]"
        onWheel={(event) => { event.preventDefault(); zoomBy(event.deltaY > 0 ? -0.08 : 0.08) }}
        onPointerDown={(event) => { if (event.target !== event.currentTarget) return; setDragging(true); dragRef.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y }; event.currentTarget.setPointerCapture(event.pointerId) }}
        onPointerMove={(event) => { if (!dragging) return; setPan({ x: dragRef.current.panX + event.clientX - dragRef.current.x, y: dragRef.current.panY + event.clientY - dragRef.current.y }) }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
      >
        {graph.nodes.length === 0 ? <p className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">No relationships match these filters.</p> : (
          <div className="absolute left-0 top-0 origin-top-left" style={{ width: graph.width, height: graph.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transition: dragging || reducedMotion ? "none" : "transform 120ms ease-out" }}>
            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${graph.width} ${graph.height}`} aria-hidden="true">
              <defs><marker id="connections-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
              {graph.edges.map((edge) => {
                const source = graph.nodes.find((node) => node.id === edge.sourceId)
                const target = graph.nodes.find((node) => node.id === edge.targetId)
                if (!source || !target) return null
                const startX = source.x + 220, startY = source.y + 36, endX = target.x, endY = target.y + 36
                const midpointX = (startX + endX) / 2, midpointY = (startY + endY) / 2
                const stroke = edge.kind === "blocking" ? "text-amber-700" : edge.kind === "hierarchy" ? "text-sky-700" : "text-muted-foreground"
                return <g key={edge.id} className={stroke}><title>{edge.ariaLabel}</title><path d={`M ${startX} ${startY} C ${midpointX} ${startY}, ${midpointX} ${endY}, ${endX} ${endY}`} fill="none" stroke="currentColor" strokeWidth={edge.kind === "blocking" ? 2 : 1.4} strokeDasharray={edge.kind === "related" ? "5 4" : undefined} markerEnd="url(#connections-arrow)" /><text x={midpointX} y={midpointY - 7} textAnchor="middle" className="fill-current text-[10px] font-medium">{edge.label}</text></g>
              })}
            </svg>
            {graph.nodes.map((node) => (
              <div key={node.id} className="absolute w-[220px]" style={{ left: node.x, top: node.y }}>
                <button type="button" onPointerDown={(event) => event.stopPropagation()} onClick={() => setSelectedId(node.id)} aria-pressed={selectedId === node.id} aria-label={`Select ${node.title}, ${node.projectName}, ${node.status}`} className={`w-full rounded-md border bg-background px-3 py-2 pr-8 text-left shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedId === node.id ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-foreground/30"}`}>
                  <span className="block truncate text-[12px] font-semibold">{node.title}</span><span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{node.projectName} · {node.status.replaceAll("_", " ")}</span>
                </button>
                <Link href={`${basePath}/tasks?task=${encodeURIComponent(node.id)}`} onPointerDown={(event) => event.stopPropagation()} aria-label={`Open task in graph: ${node.title}`} className="absolute right-1 top-1 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowRight className="h-3.5 w-3.5" /></Link>
              </div>
            ))}
          </div>
        )}
      </div>
      {selectedNode && <div className="flex flex-wrap items-center gap-2 border-t px-4 py-3 text-xs"><span className="font-medium">{selectedNode.title}</span><span className="text-muted-foreground">{selectedNode.projectName} · {selectedNode.status.replaceAll("_", " ")}</span><Link href={`${basePath}/tasks?task=${encodeURIComponent(selectedNode.id)}`} className="ml-auto rounded-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open task</Link></div>}
    </section>
  )
}

function RelationshipList({ basePath, connections }: { basePath: "/app" | "/demo"; connections: Connection[] }) {
  return <section className="min-w-0 overflow-hidden rounded-lg border bg-card" aria-labelledby="connection-list-title"><div className="border-b px-4 py-3"><h2 id="connection-list-title" className="text-sm font-semibold">Relationship list</h2><p className="mt-0.5 text-xs text-muted-foreground">Text labels are the authoritative description of each relationship.</p></div><div className="divide-y">{connections.map((connection) => <article key={connection.id} className="grid min-w-0 gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center"><ConnectionSide basePath={basePath} item={connection.source} project={connection.sourceProject} /><span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground md:justify-center">{connection.kind === "blocking" ? <AlertTriangle className="h-3.5 w-3.5" /> : connection.kind === "hierarchy" ? <GitBranch className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}{connection.label}<ArrowRight className="h-3 w-3" aria-hidden="true" /></span><ConnectionSide basePath={basePath} item={connection.target} project={connection.targetProject} /></article>)}</div></section>
}

function ConnectionSide({ basePath, item, project }: { basePath: "/app" | "/demo"; item: ConnectionWorkItem; project: ConnectionProject | null }) {
  return <div className="flex min-w-0 flex-col gap-0.5"><Link href={`${basePath}/tasks?task=${encodeURIComponent(item.id)}`} className="min-w-0 truncate rounded-sm text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{item.title}</Link>{project ? <Link href={`${basePath}/projects/${encodeURIComponent(project.id)}`} className="inline-flex min-w-0 items-center gap-1 self-start rounded-sm text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><FolderKanban className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{project.name}</span></Link> : <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/70"><FolderKanban className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">No project</span></span>}</div>
}

function Summary({ label, value }: { label: string; value: number }) { return <div className="border-b border-r p-3 last:border-r-0 md:border-b-0"><div className="text-lg font-semibold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div> }
function StateMessage({ icon: Icon, title, body }: { icon: typeof Network; title: string; body: string }) { return <section className="rounded-lg border border-dashed bg-card px-6 py-12 text-center"><Icon className="mx-auto h-6 w-6 text-muted-foreground" /><h2 className="mt-3 text-sm font-semibold">{title}</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p></section> }

export default function ConnectionsPage() { return <ConnectionsPageContent /> }
