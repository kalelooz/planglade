import { useMemo } from 'react'
import { startOfDay } from 'date-fns'
import { AlertTriangle, CalendarClock, CheckCircle2, CircleDashed } from 'lucide-react'
import type { Task, TaskStatus } from '@/types'
import { STATUS_LABELS, TASK_STATUS_ORDER } from '@/types'
import { useWorkspace } from '@/store/workspace'
import { useTaskDrawer } from '@/components/TaskDrawer'
import { CountBadge } from '@/components/bits'
import { buildTaskOverview } from '@/lib/task-analytical-models'

export function TaskOverview({ tasks }: { tasks: Task[] }) {
  const ws = useWorkspace()
  const { openTask } = useTaskDrawer()
  const today = startOfDay(new Date())
  const data = useMemo(() => buildTaskOverview(tasks, (task) => ws.isBlocked(task), today), [tasks, today, ws])

  const stats = [
    { label: 'Open', value: data.open.length, icon: CircleDashed, detail: 'Still moving' },
    { label: 'Done', value: data.done.length, icon: CheckCircle2, detail: 'In this scope' },
    { label: 'Due this week', value: data.upcoming.length, icon: CalendarClock, detail: 'Next seven days' },
    { label: 'At risk', value: new Set([...data.overdue, ...data.blocked].map((task) => task.id)).size, icon: AlertTriangle, detail: 'Overdue or blocked' },
  ]
  const maxStatus = Math.max(1, ...TASK_STATUS_ORDER.map((status) => tasks.filter((task) => task.status === status).length))

  const risk = [...data.overdue, ...data.blocked.filter((task) => !data.overdue.some((item) => item.id === task.id))].slice(0, 6)

  return (
    <div className="pb-10">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, detail }) => (
          <article key={label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between"><Icon className="size-4 text-muted-foreground" /><span className="text-[26px] font-semibold tabular-nums">{value}</span></div>
            <h2 className="mt-6 text-[13px] font-semibold">{label}</h2><p className="text-[12.5px] text-muted-foreground">{detail}</p>
          </article>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-lg border border-border bg-card p-4" aria-labelledby="overview-flow">
          <h2 id="overview-flow" className="text-[13px] font-semibold">Work by stage</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">A count, not a productivity score.</p>
          <div className="mt-5 space-y-3">
            {TASK_STATUS_ORDER.map((status: TaskStatus) => {
              const count = tasks.filter((task) => task.status === status).length
              return <div key={status} className="grid grid-cols-[88px_minmax(0,1fr)_24px] items-center gap-3"><span className="text-[12.5px] text-muted-foreground">{STATUS_LABELS[status]}</span><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-foreground/75" style={{ width: `${(count / maxStatus) * 100}%` }} /></div><span className="text-right text-[12.5px] font-medium tabular-nums">{count}</span></div>
            })}
          </div>
        </section>
        <section className="overflow-hidden rounded-lg border border-border bg-card" aria-labelledby="overview-risk">
          <header className="flex min-h-11 items-center gap-2 border-b border-border/60 bg-muted/20 px-3"><h2 id="overview-risk" className="text-[13px] font-semibold">Needs attention</h2><CountBadge count={risk.length} label={`${risk.length} tasks need attention`} /></header>
          {risk.length === 0 ? <p className="p-5 text-[13px] text-muted-foreground">No overdue or blocked tasks in this view.</p> : risk.map((task) => <button key={task.id} onClick={(event) => openTask(task.id, event.currentTarget)} className="flex min-h-12 w-full items-center gap-3 border-b border-border/50 px-3 text-left last:border-b-0 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{task.title}</span><span className="text-[12.5px] text-muted-foreground">{data.overdue.some((item) => item.id === task.id) ? 'Overdue' : 'Blocked'}</span></button>)}
        </section>
      </div>
    </div>
  )
}
