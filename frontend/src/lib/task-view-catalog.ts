import { ChartNoAxesGantt, LayoutGrid, List } from 'lucide-react'
import type { TaskView } from '@/lib/task-views'

export const TASK_VIEW_CATALOG: Array<{ view: TaskView; label: string; detail: string; requirement: string; icon: typeof List; section: 'Everyday' | 'Deeper analysis' }> = [
  { view: 'list', label: 'List', detail: 'Scan and organize tasks', requirement: 'Works with every task', icon: List, section: 'Everyday' },
  { view: 'board', label: 'Board', detail: 'Move work through stages', requirement: 'Uses task status', icon: LayoutGrid, section: 'Everyday' },
  { view: 'timeline', label: 'Timeline', detail: 'Plan spans and dependencies', requirement: 'Needs due dates; start dates add spans', icon: ChartNoAxesGantt, section: 'Deeper analysis' },
]
