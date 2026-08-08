import { useEffect, useMemo, useState } from 'react'
import {
  Background, Controls, ReactFlow, ReactFlowProvider, useReactFlow,
  type Edge, type Node, type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Maximize, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildTaskMapRelations, layoutTaskMap, type TaskMapRelationMode } from '@/lib/task-map'
import { useWorkspace } from '@/store/workspace'
import { useTaskDrawer } from '@/components/TaskDrawer'
import { useIsMobile } from '@/hooks/use-mobile'
import type { Task } from '@/types'

interface MapNodeData extends Record<string, unknown> {
  kind: 'task' | 'project'
  task?: Task
  projectName: string
}

function MapNode({ data, selected }: NodeProps<Node<MapNodeData>>) {
  if (data.kind === 'project') {
    return <div className={cn('w-[220px] rounded-md border border-dashed border-border bg-muted/45 px-3 py-2 text-[12px] font-semibold text-muted-foreground', selected && 'ring-2 ring-ring')}>{data.projectName}</div>
  }
  const task = data.task!
  const { projectName } = data
  return (
    <div className={cn('w-[220px] rounded-md border border-border bg-card px-3 py-2 shadow-sm', selected && 'ring-2 ring-ring')}>
      <p className={cn('text-[13px] font-medium leading-snug', task.status === 'done' && 'text-muted-foreground line-through')}>{task.title}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{projectName} · {task.status.replace('_', ' ')}</p>
    </div>
  )
}

const nodeTypes = { task: MapNode }

function TaskMapCanvas({ tasks }: { tasks: Task[] }) {
  const ws = useWorkspace()
  const { openTask } = useTaskDrawer()
  const { fitView } = useReactFlow()
  const [search, setSearch] = useState('')
  const [relationMode, setRelationMode] = useState<TaskMapRelationMode>('all')
  const layout = useMemo(() => layoutTaskMap(tasks, ws.projects), [tasks, ws.projects])
  const nodes = useMemo<Node<MapNodeData>[]>(() => {
    const matching = layout.filter(({ task, projectName }) => !search.trim() || `${task.title} ${projectName}`.toLowerCase().includes(search.trim().toLowerCase()))
    const projectNodes = [...new Map(matching.map(({ projectName, x }) => [projectName, x])).entries()].map(([projectName, x]) => ({
      id: `project-${projectName}`,
      type: 'task',
      position: { x, y: -70 },
      selectable: false,
      data: { kind: 'project' as const, projectName },
    }))
    return [
      ...projectNodes,
      ...matching.map(({ id, task, projectName, x, y }) => ({ id, type: 'task', position: { x, y }, data: { kind: 'task' as const, task, projectName } })),
    ]
  }, [layout, search])
  const edges = useMemo<Edge[]>(() => {
    return buildTaskMapRelations(tasks, ws.projects, new Set(nodes.map((node) => node.id)), relationMode).map((relation) => ({
      ...relation,
      ...(relation.kind === 'structure' ? { type: 'smoothstep', style: { stroke: 'hsl(var(--border))' } } : relation.kind === 'depends' ? { animated: true, style: { stroke: 'hsl(var(--foreground) / .45)' } } : { style: { stroke: 'hsl(var(--foreground) / .25)', strokeDasharray: '4 4' } }),
    }))
  }, [nodes, relationMode, tasks, ws])

  useEffect(() => {
    const frame = requestAnimationFrame(() => fitView({ padding: 0.25, maxZoom: 1, duration: 0 }))
    return () => cancelAnimationFrame(frame)
  }, [fitView, nodes.length])

  const isMobile = useIsMobile()
  if (isMobile) {
    return (
      <div className="rounded-lg border border-border bg-card p-3" aria-label="Task map accessible list">
        <label className="relative block mb-3">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a task" className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring" />
        </label>
        <ul className="space-y-1.5">
          {nodes.filter((node) => node.data.kind === 'task').map((node) => <li key={node.id}><button onClick={(event) => openTask(node.data.task!.id, event.currentTarget)} className="min-h-11 w-full rounded-md border border-border px-3 py-2 text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"><span className="block text-sm font-medium">{node.data.task!.title}</span><span className="text-xs text-muted-foreground">{node.data.projectName}</span></button></li>)}
        </ul>
        {nodes.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No tasks match these filters.</p>}
      </div>
    )
  }

  return (
    <div className="relative min-h-[520px] w-full flex-1 overflow-hidden rounded-lg border border-border bg-card" role="application" aria-label="Task map. Use the task list or a mobile screen for an accessible list.">
      <div className="absolute left-3 top-3 z-10 w-[220px]">
        <label className="relative block"><Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a task" className="h-8 w-full rounded-md border border-input bg-card pl-8 pr-3 text-[13px] outline-none focus:ring-1 focus:ring-ring" /></label>
        <select value={relationMode} onChange={(event) => setRelationMode(event.target.value as typeof relationMode)} aria-label="Map relations" className="mt-2 h-8 w-full rounded-md border border-input bg-card px-2 text-[12px] text-muted-foreground outline-none focus:ring-1 focus:ring-ring"><option value="all">All relationships</option><option value="structure">Project structure</option><option value="dependencies">Task dependencies</option></select>
      </div>
      <button onClick={() => fitView({ padding: 0.25, maxZoom: 1, duration: 200 })} className="absolute right-3 top-3 z-10 inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12px] text-muted-foreground shadow-sm hover:text-foreground"><Maximize className="h-3.5 w-3.5" /> Fit</button>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} onNodeClick={(_, node) => node.data.kind === 'task' && openTask(node.data.task!.id)} nodesConnectable={false} minZoom={0.25} maxZoom={1.5} proOptions={{ hideAttribution: true }}>
        <Background gap={24} size={1} color="hsl(var(--border))" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      {nodes.length === 0 && <div className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted-foreground">No tasks match these filters.</div>}
    </div>
  )
}

export function TaskMap({ tasks }: { tasks: Task[] }) {
  return <ReactFlowProvider><TaskMapCanvas tasks={tasks} /></ReactFlowProvider>
}
