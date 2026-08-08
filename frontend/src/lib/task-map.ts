import type { Project, Task } from '@/types'

export interface TaskMapNode {
  id: string
  task: Task
  projectName: string
  x: number
  y: number
}

export type TaskMapRelationMode = 'all' | 'structure' | 'dependencies'
export type TaskMapRelation = { id: string; source: string; target: string; kind: 'structure' | 'depends' | 'related' }

export function buildTaskMapRelations(tasks: Task[], projects: Project[], visible: Set<string>, mode: TaskMapRelationMode): TaskMapRelation[] {
  const projectNames = new Map(projects.map((project) => [project.id, project.name]))
  const structure = mode === 'dependencies' ? [] : tasks.flatMap((task) => {
    const source = `project-${task.projectId ? projectNames.get(task.projectId) ?? 'Project' : 'No project'}`
    return visible.has(source) && visible.has(task.id) ? [{ id: `project-${task.id}`, source, target: task.id, kind: 'structure' as const }] : []
  })
  const dependencies = mode === 'structure' ? [] : tasks.flatMap((task) => [
    ...task.dependsOn.filter((source) => visible.has(source) && visible.has(task.id)).map((source) => ({ id: `depends-${source}-${task.id}`, source, target: task.id, kind: 'depends' as const })),
    ...task.related.filter((target) => task.id < target && visible.has(target) && visible.has(task.id)).map((target) => ({ id: `related-${task.id}-${target}`, source: task.id, target, kind: 'related' as const })),
  ])
  return [...structure, ...dependencies]
}

// ponytail: this is a deterministic local-only layout; persistent placement belongs to the approved Map work.
export function layoutTaskMap(tasks: Task[], projects: Project[]): TaskMapNode[] {
  const projectNames = new Map(projects.map((project) => [project.id, project.name]))
  const groups = new Map<string, Task[]>()
  for (const task of tasks.filter((item) => !item.parentId)) {
    const key = task.projectId ?? 'unassigned'
    groups.set(key, [...(groups.get(key) ?? []), task])
  }

  let column = 0
  return [...groups.entries()].flatMap(([projectId, group]) => {
    const currentColumn = column++
    return [...group]
      .sort((a, b) => a.status.localeCompare(b.status) || a.title.localeCompare(b.title))
      .map((task, row) => ({
        id: task.id,
        task,
        projectName: projectId === 'unassigned' ? 'No project' : projectNames.get(projectId) ?? 'Project',
        x: currentColumn * 300,
        y: row * 120,
      }))
  })
}
