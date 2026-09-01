import type { BackendNote, BackendProject, BackendWorkItem, BackendWorkItemRelation, Session } from '@/lib/api/contracts'
import type { AppSettings, InboxItem, Note, Project, ProjectStatus, Task, TaskStatus, WorkspaceState } from '@/types'

const projectStatus: Record<BackendProject['status'], ProjectStatus> = {
  ACTIVE: 'active',
  IN_REVIEW: 'in_review',
  ON_HOLD: 'on_hold',
  ARCHIVED: 'archived',
}

const taskStatus: Record<BackendWorkItem['status'], TaskStatus> = {
  BACKLOG: 'backlog',
  TODO: 'planned',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  DONE: 'done',
}

const taskPriority: Record<BackendWorkItem['priority'], Task['priority']> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'high',
}

function day(value: string | null) {
  return value ? value.slice(0, 10) : null
}

function noteIds(value: unknown) {
  return Array.isArray(value) && value.every((id): id is string => typeof id === 'string') ? value : []
}

export function adaptProject(source: BackendProject): Project {
  return {
    id: source.id,
    name: source.name,
    description: source.description ?? '',
    slug: source.slug,
    color: source.color ?? undefined,
    icon: source.icon ?? undefined,
    status: projectStatus[source.status],
    focus: '',
    targetDate: day(source.dueDate),
    startDate: day(source.startDate),
    createdAt: Date.parse(source.createdAt),
    source,
  }
}

export function adaptTask(source: BackendWorkItem): Task {
  return {
    id: source.id,
    title: source.title,
    description: source.description ?? '',
    projectId: source.projectId,
    status: taskStatus[source.status],
    priority: taskPriority[source.priority],
    dueDate: day(source.dueDate),
    startDate: day(source.startDate),
    parentId: source.parentId,
    noteIds: noteIds(source.noteIds),
    dependsOn: [],
    related: [],
    labelIds: source.labels.map(({ label }) => label.id),
    assigneeId: source.assigneeId,
    position: source.position,
    createdAt: Date.parse(source.createdAt),
    updatedAt: Date.parse(source.updatedAt),
    completedAt: source.completedAt ? Date.parse(source.completedAt) : null,
    history: [],
    source,
  }
}

export function adaptNote(source: BackendNote): Note {
  return {
    id: source.id,
    title: source.title,
    content: source.body ?? '',
    projectId: source.projectId,
    createdAt: Date.parse(source.createdAt),
    updatedAt: Date.parse(source.updatedAt),
  }
}

export function applyWorkItemRelations(tasks: Task[], relations: BackendWorkItemRelation[]) {
  const next: Task[] = tasks.map((task) => ({ ...task, dependsOn: [], related: [] }))
  const byId = new Map(next.map((task) => [task.id, task]))
  const relatedPairs = new Set<string>()

  const addDependency = (blockerId: string, blockedId: string) => {
    const blocked = byId.get(blockedId)
    if (blocked && !blocked.dependsOn.includes(blockerId)) blocked.dependsOn.push(blockerId)
  }

  for (const relation of relations) {
    if (relation.relationType === 'BLOCKS') {
      addDependency(relation.sourceId, relation.targetId)
    } else if (relation.relationType === 'BLOCKED_BY') {
      addDependency(relation.targetId, relation.sourceId)
    } else if (relation.relationType === 'RELATES_TO') {
      const [firstId, secondId] = [relation.sourceId, relation.targetId].sort()
      const pair = JSON.stringify([firstId, secondId])
      if (firstId !== secondId && !relatedPairs.has(pair)) {
        relatedPairs.add(pair)
        const first = byId.get(firstId)
        const second = byId.get(secondId)
        if (first && second) {
          first.related.push(secondId)
          second.related.push(firstId)
        }
      }
    }
  }

  return next
}

export function adaptInboxItem(source: BackendWorkItem): InboxItem {
  const task = adaptTask(source)
  return { id: task.id, text: task.title, projectId: task.projectId, dueDate: task.dueDate, priority: task.priority, createdAt: task.createdAt, source }
}

export function buildApiWorkspaceState(
  session: Session,
  backendProjects: BackendProject[],
  backendTasks: BackendWorkItem[],
  backendInbox: BackendWorkItem[],
  backendNotes: BackendNote[],
  backendRelations: BackendWorkItemRelation[],
  settings: AppSettings,
): WorkspaceState {
  const labels = Array.from(
    new Map(
      backendTasks.flatMap((task) => task.labels.map(({ label }) => [label.id, label] as const)),
    ).values(),
  ).map((label) => ({ id: label.id, name: label.name, color: label.color ?? 'currentColor' }))

  return {
    workspaceName: session.workspace.name,
    userName: session.user.name ?? session.user.email,
    projects: backendProjects.map(adaptProject),
    tasks: applyWorkItemRelations(backendTasks.map(adaptTask), backendRelations),
    notes: backendNotes.map(adaptNote),
    inbox: backendInbox.map(adaptInboxItem),
    people: (session.members ?? []).map((member) => ({ id: member.id, name: member.name, role: member.role })),
    labels,
    settings,
    recents: [],
  }
}
