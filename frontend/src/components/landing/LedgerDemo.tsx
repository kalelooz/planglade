import { useState, type FormEvent } from 'react'
import { CalendarDays, Circle, FolderOpen, Link2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  LANDING_DEMO_INPUT,
  parseLandingDemoInput,
  type DemoTask,
} from '@/components/landing/ledger-demo-model'

const demoViews = ['List', 'Board', 'Timeline', 'Calendar', 'Connections'] as const

function TaskMeta({ task }: { task: DemoTask }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[hsl(var(--landing-quiet))]">
      <span className="inline-flex items-center gap-1"><FolderOpen className="size-3" aria-hidden="true" />{task.project ?? 'No project'}</span>
      <span className="inline-flex items-center gap-1"><CalendarDays className="size-3" aria-hidden="true" />{task.due ?? 'No date'}</span>
    </div>
  )
}

function ListView({ task }: { task: DemoTask }) {
  return (
    <div className="landing-view-frame" aria-label="List view preview">
      <div className="landing-view-toolbar"><span>Tasks</span><span>1 open</span></div>
      <div className="flex min-h-24 items-start gap-3 px-3 py-4 sm:px-4">
        <Circle className="mt-0.5 size-[18px] shrink-0 text-[hsl(var(--landing-quiet))]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-5">{task.title}</p>
          <div className="mt-2"><TaskMeta task={task} /></div>
        </div>
        <span className="landing-status">{task.state}</span>
      </div>
    </div>
  )
}

function BoardView({ task }: { task: DemoTask }) {
  return (
    <div className="landing-view-frame overflow-x-auto" aria-label="Board view preview">
      <div className="grid min-w-[34rem] grid-cols-3 gap-2 p-3">
        {['Inbox', 'Planned', 'In progress'].map((column) => (
          <section key={column} aria-label={`${column} column`} className="min-h-36 rounded-md bg-[hsl(var(--landing-soft))] p-2">
            <p className="text-xs font-semibold">{column}</p>
            {column === task.state ? (
              <div className="mt-2 rounded-md border border-[hsl(var(--landing-rule))] bg-[hsl(var(--landing-paper))] p-3">
                <p className="text-[13px] font-medium leading-5">{task.title}</p>
                <div className="mt-3"><TaskMeta task={task} /></div>
              </div>
            ) : <p className="mt-5 text-center text-xs text-[hsl(var(--landing-quiet))]">Nothing here</p>}
          </section>
        ))}
      </div>
    </div>
  )
}

function TimelineView({ task }: { task: DemoTask }) {
  return (
    <div className="landing-view-frame overflow-x-auto" aria-label="Timeline view preview">
      <div className="min-w-[34rem]">
        <div className="grid grid-cols-[11rem_repeat(4,1fr)] border-b border-[hsl(var(--landing-rule))] bg-[hsl(var(--landing-soft))] text-xs font-medium text-[hsl(var(--landing-quiet))]">
          <span className="p-2">Task</span>{['Today', 'Tomorrow', 'Wed', 'Thu'].map((day) => <span key={day} className="border-l border-[hsl(var(--landing-rule))] p-2 text-center">{day}</span>)}
        </div>
        <div className="grid min-h-28 grid-cols-[11rem_repeat(4,1fr)] items-center">
          <span className="px-3 text-xs font-medium">{task.title}</span>
          {task.due ? (
            <>
              <span className="h-full border-l border-[hsl(var(--landing-rule))]" aria-hidden="true" />
              <span className="relative flex h-full items-center border-l border-[hsl(var(--landing-rule))] px-1"><span className="w-full rounded-md bg-[hsl(var(--landing-ink))] px-2 py-2 text-center text-xs font-medium text-[hsl(var(--landing-paper))]">Due {task.due.toLowerCase()}</span></span>
              <span className="h-full border-l border-[hsl(var(--landing-rule))]" aria-hidden="true" />
              <span className="h-full border-l border-[hsl(var(--landing-rule))]" aria-hidden="true" />
            </>
          ) : (
            <span className="col-span-4 border-l border-[hsl(var(--landing-rule))] px-4 text-center text-xs text-[hsl(var(--landing-quiet))]">No date set — not placed on the timeline.</span>
          )}
        </div>
      </div>
    </div>
  )
}

function CalendarView({ task }: { task: DemoTask }) {
  return (
    <div className="landing-view-frame overflow-x-auto">
      <table className="w-full min-w-[32rem] table-fixed text-left" aria-label="Calendar view preview">
        <thead><tr>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day) => <th key={day} scope="col" className="border-b border-r border-[hsl(var(--landing-rule))] bg-[hsl(var(--landing-soft))] px-2 py-2 text-xs font-medium text-[hsl(var(--landing-quiet))] last:border-r-0">{day}</th>)}</tr></thead>
        <tbody><tr className="h-32 align-top">{['18', '19', '20', '21', '22'].map((date, index) => <td key={date} className="border-r border-[hsl(var(--landing-rule))] p-2 last:border-r-0"><span className="text-xs text-[hsl(var(--landing-quiet))]">{date}</span>{task.due && index === 1 && <span className="mt-2 block rounded-md bg-[hsl(var(--landing-ink))] px-2 py-1.5 text-xs leading-4 text-[hsl(var(--landing-paper))]">{task.title}</span>}</td>)}</tr></tbody>
      </table>
      {!task.due && <p className="border-t border-[hsl(var(--landing-rule))] px-3 py-2 text-center text-xs text-[hsl(var(--landing-quiet))]">No date set — not placed on the calendar.</p>}
    </div>
  )
}

function ConnectionsView({ task }: { task: DemoTask }) {
  const caption = task.project && task.due
    ? <>The same task connects {task.project} with its {task.due.toLowerCase()} due date.</>
    : task.project
      ? <>The task connects to {task.project}; no date connection is shown.</>
      : task.due
        ? <>The task connects to its {task.due.toLowerCase()} due date; no project connection is shown.</>
        : <>No project or date connections yet.</>

  return (
    <figure className="landing-view-frame p-3" aria-labelledby="connections-preview-caption">
      <div className="relative mx-auto h-44 max-w-xl" aria-hidden="true">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 560 176" fill="none">
          {task.project && <path d="M280 88 C230 88 214 45 150 45" stroke="currentColor" strokeOpacity=".35" strokeWidth="2" />}
          {task.due && <path d="M280 88 C330 88 346 131 410 131" stroke="currentColor" strokeOpacity=".35" strokeWidth="2" />}
        </svg>
        <div className="absolute left-1/2 top-1/2 w-48 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-[hsl(var(--landing-ink))] bg-[hsl(var(--landing-paper))] p-3 text-center text-xs font-medium">{task.title}</div>
        {task.project && <div className="absolute left-2 top-4 w-36 rounded-md border border-[hsl(var(--landing-rule))] bg-[hsl(var(--landing-soft))] p-3 text-center text-xs"><span className="block text-xs uppercase tracking-[0.12em] text-[hsl(var(--landing-quiet))]">Project</span>{task.project}</div>}
        {task.due && <div className="absolute bottom-3 right-2 w-32 rounded-md border border-[hsl(var(--landing-rule))] bg-[hsl(var(--landing-soft))] p-3 text-center text-xs"><span className="block text-xs uppercase tracking-[0.12em] text-[hsl(var(--landing-quiet))]">Due</span>{task.due}</div>}
      </div>
      <figcaption id="connections-preview-caption" className="flex items-center justify-center gap-1.5 text-center text-xs text-[hsl(var(--landing-quiet))]"><Link2 className="size-3" aria-hidden="true" />{caption}</figcaption>
    </figure>
  )
}

export function LedgerDemo() {
  const [captureText, setCaptureText] = useState(LANDING_DEMO_INPUT)
  const [task, setTask] = useState<DemoTask>(() => parseLandingDemoInput(LANDING_DEMO_INPUT)!)
  const [captureVersion, setCaptureVersion] = useState(0)

  function captureTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextTask = parseLandingDemoInput(captureText)
    if (!nextTask) return
    setTask(nextTask)
    setCaptureVersion((version) => version + 1)
  }

  return (
    <div className="landing-demo-card landing-reveal">
      <form onSubmit={captureTask} className="border-b border-[hsl(var(--landing-rule))] p-3 sm:p-4">
        <label htmlFor="landing-quick-capture" className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--landing-quiet))]">Quick capture</label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            id="landing-quick-capture"
            value={captureText}
            onChange={(event) => setCaptureText(event.target.value)}
            className="min-h-11 min-w-0 flex-1 rounded-md border border-[hsl(var(--landing-rule))] bg-[hsl(var(--landing-paper))] px-3 text-base text-[hsl(var(--landing-ink))] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-[hsl(var(--landing-ink))] focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(var(--landing-paper))] sm:text-sm"
          />
          <button type="submit" disabled={!captureText.trim()} className="min-h-11 cursor-pointer rounded-md bg-[hsl(var(--landing-ink))] px-4 text-sm font-medium text-[hsl(var(--landing-paper))] disabled:cursor-not-allowed disabled:opacity-40">Capture</button>
        </div>
      </form>

      <div key={captureVersion} className="landing-demo-structured border-b border-[hsl(var(--landing-rule))] p-3 sm:p-4" aria-live="polite">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 size-[18px] shrink-0 rounded-full border-2 border-[hsl(var(--landing-quiet))]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{task.title}</p>
            <div className="mt-2"><TaskMeta task={task} /></div>
          </div>
          <span className="landing-status">{task.state}</span>
        </div>
      </div>

      <Tabs defaultValue="List" className="gap-0">
        <div className="overflow-x-auto border-b border-[hsl(var(--landing-rule))] px-2 py-2 sm:px-3">
          <TabsList aria-label="Ways to view the same task" className="h-auto min-w-max bg-[hsl(var(--landing-soft))] p-1">
            {demoViews.map((view) => <TabsTrigger key={view} value={view} className="min-h-11 px-3 text-xs data-[state=active]:bg-[hsl(var(--landing-paper))]">{view}</TabsTrigger>)}
          </TabsList>
        </div>
        <TabsContent value="List" className="m-0 p-3 sm:p-4"><ListView task={task} /></TabsContent>
        <TabsContent value="Board" className="m-0 p-3 sm:p-4"><BoardView task={task} /></TabsContent>
        <TabsContent value="Timeline" className="m-0 p-3 sm:p-4"><TimelineView task={task} /></TabsContent>
        <TabsContent value="Calendar" className="m-0 p-3 sm:p-4"><CalendarView task={task} /></TabsContent>
        <TabsContent value="Connections" className="m-0 p-3 sm:p-4"><ConnectionsView task={task} /></TabsContent>
      </Tabs>
    </div>
  )
}
