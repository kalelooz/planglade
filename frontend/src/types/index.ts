import type { BackendProject, BackendWorkItem } from '@/lib/api/contracts'

export type Priority = 'none' | 'low' | 'medium' | 'high'

export type TaskStatus = 'backlog' | 'planned' | 'in_progress' | 'in_review' | 'blocked' | 'done'

export type ProjectStatus = 'active' | 'in_review' | 'on_hold' | 'completed' | 'archived'

export interface HistoryEntry {
  at: number
  text: string
}

export interface Task {
  id: string
  title: string
  description: string
  projectId: string | null
  status: TaskStatus
  priority: Priority
  dueDate: string | null // ISO yyyy-MM-dd
  startDate?: string | null // ISO yyyy-MM-dd
  parentId: string | null
  noteIds?: string[]
  dependsOn: string[]
  related: string[]
  labelIds: string[]
  assigneeId: string | null
  position?: number
  createdAt: number
  updatedAt: number
  completedAt: number | null
  history: HistoryEntry[]
  source?: BackendWorkItem
}

export interface Project {
  id: string
  name: string
  description: string
  slug?: string
  color?: string
  icon?: string
  status: ProjectStatus
  focus: string
  targetDate: string | null
  startDate: string | null
  createdAt: number
  source?: BackendProject
}

export interface Note {
  id: string
  title: string
  content: string
  projectId: string | null
  createdAt: number
  updatedAt: number
}

export interface InboxItem {
  id: string
  text: string
  projectId: string | null
  dueDate: string | null
  priority: Priority
  createdAt: number
  source?: BackendWorkItem
}

export interface Person {
  id: string
  name: string
  role: string
}

export interface Label {
  id: string
  name: string
  color: string // hsl triple
}

export type ThemeMode = 'light' | 'dark' | 'system'
export type PriorityDisplay = 'icon' | 'text'

export interface AppSettings {
  theme: ThemeMode
  priorityDisplay: PriorityDisplay
  weekStartsOn: 0 | 1
  hideHomeCompleted: boolean
}

export interface RecentItem {
  type: 'task' | 'project' | 'note'
  id: string
  at: number
}

export interface WorkspaceState {
  workspaceName: string
  userName: string
  projects: Project[]
  tasks: Task[]
  notes: Note[]
  inbox: InboxItem[]
  people: Person[]
  labels: Label[]
  settings: AppSettings
  recents: RecentItem[]
}

export const STATUS_ORDER: TaskStatus[] = ['backlog', 'planned', 'in_progress', 'in_review', 'done']
export const TASK_STATUS_ORDER: TaskStatus[] = ['backlog', 'planned', 'in_progress', 'in_review', 'blocked', 'done']

export const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  planned: 'Planned',
  in_progress: 'In Progress',
  in_review: 'In Review',
  blocked: 'Blocked',
  done: 'Done',
}

export const PRIORITY_LABELS: Record<Priority, string> = {
  none: 'None',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  in_review: 'In review',
  on_hold: 'On hold',
  completed: 'Completed',
  archived: 'Archived',
}
