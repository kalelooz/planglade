import type { ReactNode } from 'react'
import { ArrowRight, CalendarDays, Check, Circle, FileText, FolderOpen, Inbox, ListChecks, Sprout } from 'lucide-react'

function SectionIntro({ kicker, title, children }: { kicker: string; title: string; children: ReactNode }) {
  return (
    <div className="max-w-xl">
      <p className="landing-kicker">{kicker}</p>
      <h2 className="landing-section-title mt-3">{title}</h2>
      <p className="landing-section-copy mt-4">{children}</p>
    </div>
  )
}

function CapturePreview() {
  return (
    <div className="landing-product-surface">
      <div className="border-b border-[hsl(var(--landing-rule))] px-4 py-3">
        <p className="text-sm font-semibold">Inbox</p>
        <p className="mt-0.5 text-[12px] text-[hsl(var(--landing-quiet))]">Capture first. Organize when you’re ready.</p>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex min-h-11 items-center gap-2 rounded-md border border-[hsl(var(--landing-rule))] bg-[hsl(var(--landing-paper))] px-3 text-[13px]">
          <Inbox className="size-4 shrink-0 text-[hsl(var(--landing-quiet))]" aria-hidden="true" />
          <span className="text-[hsl(var(--landing-quiet))]">What’s on your mind?</span>
        </div>
        <div className="mt-3 divide-y divide-[hsl(var(--landing-rule))] border-y border-[hsl(var(--landing-rule))]">
          <div className="px-2 py-3">
            <p className="text-[13px] font-medium">Send homepage draft to Mara</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="landing-data-chip"><FolderOpen className="size-3" />Client Refresh</span>
              <span className="landing-data-chip"><CalendarDays className="size-3" />Tomorrow</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-2 py-3">
            <div><p className="text-[13px] font-medium">Confirm launch print dimensions</p><p className="mt-0.5 text-xs text-[hsl(var(--landing-quiet))]">Captured just now</p></div>
            <span className="inline-flex min-h-11 items-center rounded-md bg-[hsl(var(--landing-ink))] px-3 text-[12px] font-medium text-[hsl(var(--landing-paper))]">Ready to clarify</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SharedTaskPreview() {
  return (
    <div className="landing-shared-task" aria-label="One task record used by five views">
      <div className="landing-shared-task-record">
        <span className="landing-kicker">ONE TASK RECORD</span>
        <p className="mt-2 text-base font-semibold">Send homepage draft to Mara</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[hsl(var(--landing-quiet))]"><span>Client Refresh</span><span>Tomorrow</span><span>Inbox</span></div>
      </div>
      <div className="landing-shared-task-views" role="list" aria-label="Available task views">
        {['List', 'Board', 'Timeline', 'Calendar', 'Connections'].map((view) => <div key={view} role="listitem" className="landing-shared-view"><span>{view}</span><ArrowRight className="size-3" aria-hidden="true" /></div>)}
      </div>
    </div>
  )
}

function ProjectPreview() {
  return (
    <div className="landing-product-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[hsl(var(--landing-rule))] px-4 py-4">
        <div><p className="text-xs font-semibold uppercase tracking-[0.13em] text-[hsl(var(--landing-quiet))]">Project</p><p className="mt-1 text-base font-semibold">Client Refresh</p><p className="mt-1 text-[12px] text-[hsl(var(--landing-quiet))]">A clearer homepage for the autumn launch.</p></div>
        <span className="landing-status">Active</span>
      </div>
      <div className="grid divide-y divide-[hsl(var(--landing-rule))] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <section className="p-4" aria-label="Project tasks"><p className="text-[12px] font-semibold">Open tasks</p><div className="mt-3 space-y-3">{['Send homepage draft to Mara', 'Review mobile navigation', 'Prepare launch checklist'].map((task, index) => <div key={task} className="flex items-start gap-2"><Circle className="mt-0.5 size-4 shrink-0 text-[hsl(var(--landing-quiet))]" aria-hidden="true" /><div><p className="text-[12px] font-medium">{task}</p><p className="mt-0.5 text-xs text-[hsl(var(--landing-quiet))]">{index === 0 ? 'Tomorrow' : index === 1 ? 'Friday' : 'No date'}</p></div></div>)}</div></section>
        <section className="p-4" aria-label="Project context"><p className="text-[12px] font-semibold">Context beside the work</p><div className="mt-3 space-y-2"><div className="rounded-md bg-[hsl(var(--landing-soft))] p-3"><FileText className="size-4 text-[hsl(var(--landing-quiet))]" aria-hidden="true" /><p className="mt-2 text-[12px] font-medium">Homepage messaging notes</p><p className="mt-1 text-xs leading-5 text-[hsl(var(--landing-quiet))]">Audience, page order, and the open questions for the next review.</p></div><p className="text-xs text-[hsl(var(--landing-quiet))]">Target: October 18</p></div></section>
      </div>
    </div>
  )
}

function HomePreview() {
  return (
    <div className="landing-product-surface p-4 sm:p-5">
      <div className="flex items-end justify-between gap-3 border-b border-[hsl(var(--landing-rule))] pb-4"><div><p className="text-base font-semibold">Good morning.</p><p className="mt-1 text-[12px] text-[hsl(var(--landing-quiet))]">Tuesday, September 19</p></div><Sprout className="size-5 text-[hsl(var(--landing-quiet))]" aria-hidden="true" /></div>
      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_13rem]">
        <section aria-label="Items needing attention"><div className="flex items-center justify-between"><p className="text-[12px] font-semibold">What needs your attention</p><span className="text-xs text-[hsl(var(--landing-quiet))]">1</span></div><div className="mt-2 flex items-start gap-2 border-y border-[hsl(var(--landing-rule))] py-3"><Circle className="mt-0.5 size-4 shrink-0" aria-hidden="true" /><div><p className="text-[12px] font-medium">Send homepage draft to Mara</p><p className="mt-1 text-xs text-[hsl(var(--landing-quiet))]">Client Refresh · Tomorrow</p></div></div></section>
        <section aria-label="Inbox summary"><div className="flex items-center justify-between"><p className="text-[12px] font-semibold">Inbox</p><span className="text-xs text-[hsl(var(--landing-quiet))]">2</span></div><div className="mt-2 space-y-2 border-y border-[hsl(var(--landing-rule))] py-3 text-xs"><p>Confirm print dimensions</p><p>Confirm launch print dimensions</p></div></section>
      </div>
      <div className="mt-5 flex items-start gap-2 rounded-md bg-[hsl(var(--landing-soft))] px-3 py-3 text-[12px] leading-5 text-[hsl(var(--landing-quiet))]"><Sprout className="mt-0.5 size-4 shrink-0" aria-hidden="true" />Start with one small thing. The rest can wait its turn.</div>
    </div>
  )
}

export function ProductStory() {
  return (
    <>
      <section id="product" aria-labelledby="capture-first-title" className="landing-section landing-shell scroll-mt-24">
        <div className="landing-story-grid">
          <div><p className="landing-kicker">CAPTURE FIRST</p><h2 id="capture-first-title" className="landing-section-title mt-3">Give loose thoughts somewhere calm to land.</h2><p className="landing-section-copy mt-4">Use natural shorthand while the thought is fresh. Inbox holds it without demanding a full plan, then gives you a quiet place to add the project, date, and priority when you are ready.</p><ul className="mt-6 space-y-3 text-sm leading-6"><li className="flex gap-2"><Check className="mt-1 size-4 shrink-0" aria-hidden="true" />Capture without leaving the work in front of you.</li><li className="flex gap-2"><Check className="mt-1 size-4 shrink-0" aria-hidden="true" />Triage one item at a time instead of planning everything at once.</li></ul></div>
          <CapturePreview />
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="one-task-title" className="landing-ink-section scroll-mt-24">
        <div className="landing-shell landing-section">
          <SectionIntro kicker="THE LIVING PROJECT LEDGER" title="One task. Every useful view.">PlanGlade does not ask you to rebuild the same plan in several tools. List, Board, Timeline, Calendar, and Connections are different readings of one shared task record.</SectionIntro>
          <div className="mt-10"><SharedTaskPreview /></div>
        </div>
      </section>

      <section aria-labelledby="project-context-title" className="landing-section landing-shell">
        <div className="landing-story-grid landing-story-grid-reverse">
          <ProjectPreview />
          <div><p className="landing-kicker">PROJECT CONTEXT</p><h2 id="project-context-title" className="landing-section-title mt-3">Keep the reason beside the work.</h2><p className="landing-section-copy mt-4">A project is more than a task bucket. Keep the brief, working notes, open tasks, and target date in one place so the plan still makes sense when you return to it.</p><p className="mt-6 flex items-center gap-2 text-sm font-medium"><FolderOpen className="size-4" aria-hidden="true" />Tasks, notes, dates, and relationships stay in context.</p></div>
        </div>
      </section>

      <section aria-labelledby="daily-rhythm-title" className="landing-section landing-shell border-t border-[hsl(var(--landing-rule))]">
        <div className="landing-story-grid">
          <div><p className="landing-kicker">A CALMER DAILY RHYTHM</p><h2 id="daily-rhythm-title" className="landing-section-title mt-3">Home shows what deserves attention, then gets out of the way.</h2><p className="landing-section-copy mt-4">See what is overdue, due today, coming up, or waiting in Inbox. The daily view stays concise so you can choose the next useful action and return to the work itself.</p><p className="mt-6 flex items-center gap-2 text-sm font-medium"><ListChecks className="size-4" aria-hidden="true" />Attention, upcoming work, project focus, and recently opened context.</p></div>
          <HomePreview />
        </div>
      </section>
    </>
  )
}
