import {
  ArrowUpDown,
  CalendarDays,
  CheckSquare,
  Circle,
  CircleUserRound,
  CreditCard,
  FolderOpen,
  Github,
  Home,
  Inbox,
  LifeBuoy,
  List,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Rows3,
  Search,
  Settings,
  SlidersHorizontal,
  StickyNote,
  Waypoints,
} from 'lucide-react'

const navItems = [
  [Home, 'Home'],
  [Inbox, 'Inbox'],
  [CheckSquare, 'Tasks'],
  [FolderOpen, 'Projects'],
  [StickyNote, 'Notes'],
  [CalendarDays, 'Calendar'],
  [Waypoints, 'Connections'],
  [Settings, 'Settings'],
] as const

function PreviewMark() {
  return (
    <svg className="size-7 shrink-0" viewBox="0 0 64 64" fill="none">
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <g className="stroke-primary-foreground" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4.5" transform="translate(8 8) scale(2)">
        <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" />
        <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" />
        <path d="M5 21h14" />
      </g>
    </svg>
  )
}

function PreviewTaskRow({ title, project, due }: { title: string; project: string; due: string }) {
  return (
    <div className="flex min-h-14 items-start gap-2.5 px-2 py-2.5">
      <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium leading-5 text-foreground">{title}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] leading-[1.125rem] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1"><FolderOpen className="size-3 shrink-0" />{project}</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="size-3 shrink-0" />{due}</span>
        </div>
      </div>
      <span className="shrink-0 rounded-md border border-border bg-secondary px-1.5 py-0.5 text-xs font-medium text-secondary-foreground">Task</span>
    </div>
  )
}

function PreviewSidebar() {
  return (
    <aside className="hidden w-[228px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex" data-sidebar-preview>
      <div className="flex h-14 items-center gap-2 px-4">
        <PreviewMark />
        <div className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-semibold text-foreground">Northstar Studio</span>
          <span className="block truncate text-[12.5px] capitalize text-muted-foreground">Owner</span>
        </div>
      </div>
      <div className="px-2 pb-1">
        <div className="flex h-9 items-center gap-2 rounded-md bg-primary px-2.5 text-[13px] font-medium text-primary-foreground shadow-xs">
          <Plus className="size-4" />Quick capture
        </div>
        <div className="mt-1.5 flex h-8 items-center gap-2 px-2.5 text-[13px] text-muted-foreground">
          <Search className="size-4" />Search<span className="ml-auto rounded bg-secondary px-1 text-xs">⌘K</span>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-hidden px-2 py-2">
        {navItems.map(([Icon, label], index) => (
          <div key={label} className={`relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] ${index === 0 ? 'bg-accent font-medium text-foreground' : 'text-sidebar-foreground'}`}>
            {index === 0 && <span className="absolute left-0 h-4 w-[2.5px] rounded-full bg-foreground/70" />}
            <Icon className="size-4 opacity-80" />
            <span>{label}</span>
            {label === 'Inbox' && <span className="ml-auto rounded-full border border-border bg-secondary px-1.5 text-xs tabular-nums text-secondary-foreground">2</span>}
          </div>
        ))}
      </nav>
      <div className="space-y-1 border-t border-sidebar-border p-2">
        <div className="flex h-8 items-center gap-2 px-2 text-[12.5px] text-muted-foreground"><CreditCard className="size-4" />Plans<span className="ml-auto rounded-full bg-secondary px-1.5 text-xs">Free</span></div>
        <div className="flex h-8 items-center gap-2 px-2 text-[12.5px] text-muted-foreground"><LifeBuoy className="size-4" />Help &amp; support</div>
        <div className="mt-2 rounded-lg border border-sidebar-border bg-card p-2 shadow-sm" data-sidebar-account-card>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent"><CircleUserRound className="size-5 text-muted-foreground" /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold leading-4 text-foreground">Mo Hamed</span>
              <span className="mt-1 block truncate text-xs leading-4 text-muted-foreground">Owner · Free</span>
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-1 pt-1 text-muted-foreground" data-sidebar-utilities>
          <span className="grid h-8 place-items-center"><Github className="size-4" /></span>
          <span className="grid h-8 place-items-center"><Moon className="size-4" /></span>
          <span className="grid h-8 place-items-center"><PanelLeftClose className="size-4" /></span>
        </div>
      </div>
    </aside>
  )
}

function HomeAttentionCard() {
  return (
    <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-xs">
      <div className="flex min-h-10 items-center justify-between gap-3 px-4 pt-3">
        <h3 className="text-[13px] font-semibold leading-5 text-foreground/90">What needs your attention</h3>
        <span className="rounded-full border border-border bg-secondary px-1.5 text-xs tabular-nums text-secondary-foreground">2</span>
      </div>
      <div className="px-3 pb-3">
        <div className="divide-y divide-border/60 border-y border-border/60">
          <PreviewTaskRow title="Send homepage draft to Mara" project="Client Refresh" due="Today" />
          <PreviewTaskRow title="Review mobile navigation" project="Website" due="Tomorrow" />
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="flex min-h-10 items-center gap-2 px-4 pt-3">
          <h3 className="text-[13px] font-semibold leading-5 text-foreground/90">Coming up this week</h3>
          <span className="rounded-full border border-border bg-secondary px-1.5 text-xs tabular-nums text-secondary-foreground">1</span>
        </div>
        <div className="px-3 pb-3"><div className="border-y border-border/60"><PreviewTaskRow title="Prepare launch checklist" project="Client Refresh" due="Friday" /></div></div>
      </div>
    </section>
  )
}

function HomeSupportColumn() {
  return (
    <div className="min-w-0 space-y-4">
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-xs">
        <div className="flex min-h-10 items-center justify-between px-4 pt-3"><h3 className="text-[13px] font-semibold">Inbox</h3><span className="text-xs text-muted-foreground">Open →</span></div>
        <div className="px-3 pb-3"><div className="divide-y divide-border/60 border-y border-border/60">
          <div className="px-2 py-2"><p className="truncate text-sm font-medium">Confirm print dimensions</p><p className="mt-0.5 text-[12.5px] text-muted-foreground">20 minutes ago</p></div>
          <div className="px-2 py-2"><p className="truncate text-sm font-medium">Book review room</p><p className="mt-0.5 text-[12.5px] text-muted-foreground">1 hour ago</p></div>
        </div></div>
      </section>
      <section className="overflow-hidden rounded-lg border border-border/70 bg-card shadow-xs">
        <div className="flex min-h-10 items-center justify-between px-4 pt-3"><h3 className="text-[13px] font-semibold">Recent notes</h3><span className="text-xs text-muted-foreground">All notes →</span></div>
        <div className="px-3 pb-3"><div className="border-y border-border/60 px-2 py-2"><p className="truncate text-sm font-medium">Homepage messaging notes</p><p className="mt-0.5 text-[12.5px] text-muted-foreground">Client Refresh · 2h ago</p></div></div>
      </section>
    </div>
  )
}

function HomeContent({ condensed = false }: { condensed?: boolean }) {
  return (
    <div className={condensed ? 'p-4 sm:p-5' : 'p-5 sm:p-7'}>
      <header className="mb-5 flex items-end justify-between gap-3">
        <div><h2 className="text-[22px] font-semibold leading-tight text-foreground">Good morning, Mo.</h2><p className="mt-0.5 text-sm leading-5 text-muted-foreground">Tuesday, September 1</p></div>
        <span className="grid size-8 place-items-center text-muted-foreground"><MoreHorizontal className="size-4" /></span>
      </header>
      <div className="mb-6 overflow-hidden rounded-lg border border-border/70 bg-card shadow-xs">
        <div className="flex h-11 items-center gap-2.5 px-3.5"><Inbox className="size-4 shrink-0 text-muted-foreground" /><span className="text-sm text-muted-foreground">Capture something - organize it later</span></div>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(240px,0.55fr)]">
        <div className="space-y-4">
          <HomeAttentionCard />
          {!condensed && <section className="rounded-lg border border-border/70 bg-card p-4 shadow-xs"><div className="flex items-center justify-between"><h3 className="text-[13px] font-semibold">Project focus</h3><span className="text-xs text-muted-foreground">All projects →</span></div><div className="mt-3 border-y border-border/60 px-2 py-2.5"><div className="flex items-center justify-between gap-3"><span className="text-sm font-medium">Client Refresh</span><span className="text-[12.5px] tabular-nums text-muted-foreground">2/5 done</span></div><div className="mt-2 h-1 rounded-full bg-secondary"><div className="h-full w-2/5 rounded-full bg-primary" /></div></div></section>}
        </div>
        <HomeSupportColumn />
      </div>
    </div>
  )
}

export function HomeWorkspacePreview() {
  return (
    <section className="landing-app-preview overflow-hidden rounded-xl border border-border shadow-sm" aria-label="PlanGlade Home workspace preview">
      <div className="flex min-h-[640px] bg-background text-foreground">
        <PreviewSidebar />
        <div className="min-w-0 flex-1"><HomeContent condensed /></div>
      </div>
    </section>
  )
}

export function InboxWorkspacePreview() {
  return (
    <section className="landing-app-preview overflow-hidden rounded-lg border border-border bg-background p-4 text-foreground shadow-sm sm:p-6" aria-label="PlanGlade Inbox preview">
      <header className="mb-5"><h3 className="text-[22px] font-semibold leading-tight">Inbox</h3><p className="mt-0.5 text-sm text-muted-foreground">Capture first. Organize when you're ready.</p></header>
      <div className="mb-4 rounded-lg border border-border bg-card shadow-xs"><div className="flex h-11 items-center gap-2.5 px-3.5"><Inbox className="size-4 text-muted-foreground" /><span className="text-sm text-muted-foreground">What's on your mind?</span></div></div>
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
        <div className="flex min-h-10 items-center gap-3 border-b border-border bg-muted/30 px-3 py-2"><span className="size-4 rounded border border-input" /><span className="text-[12.5px] font-medium text-muted-foreground">2 items to organize</span></div>
        <div className="divide-y divide-border/60">
          <div className="px-3 py-3"><p className="text-sm font-medium">Send homepage draft to Mara</p><p className="mt-1 text-[12.5px] text-muted-foreground">Capture · 10 minutes ago</p></div>
          <div className="px-3 py-3"><p className="text-sm font-medium">Confirm print dimensions</p><p className="mt-1 text-[12.5px] text-muted-foreground">Capture · 20 minutes ago</p></div>
        </div>
      </div>
    </section>
  )
}

export function TasksWorkspacePreview() {
  return (
    <section className="landing-app-preview overflow-hidden rounded-xl border border-border bg-background text-foreground shadow-sm" aria-label="PlanGlade Tasks preview">
      <div className="p-4 sm:p-6">
        <header className="mb-5">
          <div className="flex items-center gap-3"><div className="mr-auto"><h3 className="text-[22px] font-semibold leading-tight">Tasks</h3><p className="mt-0.5 text-sm text-muted-foreground">Plan, review, and present work from one place.</p></div><span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground"><Plus className="size-4" />New task</span></div>
          <div className="mt-4 flex flex-wrap gap-1.5 rounded-xl border border-border/50 bg-card/45 p-1 shadow-xs">
            {['Open 3', 'Backlog 1', 'In progress 1', 'In review 0', 'Done 4'].map((item) => <span key={item} className="rounded-lg px-2 py-1 text-[12.5px] tabular-nums text-muted-foreground">{item}</span>)}
          </div>
          <div className="mt-4 flex min-w-0 flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-card/80 p-1.5 shadow-sm">
            <div className="flex gap-1">
              <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-2 text-[12px] text-accent-foreground shadow-[inset_0_0_0_1px_hsl(var(--border)/0.75)]"><List className="size-3.5" />List</span>
              <span className="inline-flex h-8 items-center gap-1.5 px-2 text-[12px] text-muted-foreground"><Rows3 className="size-3.5" />Board</span>
              <span className="inline-flex h-8 items-center gap-1.5 px-2 text-[12px] text-muted-foreground"><CalendarDays className="size-3.5" />Timeline</span>
            </div>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background/80 px-2 text-[12px] text-muted-foreground"><Search className="size-3.5" />Search tasks</span>
            <span className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background/80 px-2 text-[12px] text-muted-foreground"><SlidersHorizontal className="size-3.5" />Filter</span>
            <span className="inline-flex h-8 items-center gap-1 rounded-md border border-input bg-background/80 px-2 text-[12px] text-muted-foreground"><ArrowUpDown className="size-3.5" />Due</span>
            <span className="inline-flex size-8 items-center justify-center rounded-md border border-input bg-background/80 text-muted-foreground"><Rows3 className="size-3.5" /></span>
            <span className="ml-auto inline-flex min-h-8 items-center gap-2 rounded-md border border-input bg-background/80 px-2.5 text-[12.5px] font-medium"><span>Show completed</span><span className="relative h-[1.15rem] w-8 rounded-full border border-border/70 bg-muted-foreground/25"><span className="absolute left-px top-px size-4 rounded-full border border-border/60 bg-background shadow-sm" /></span></span>
          </div>
        </header>
        <div className="border-y border-border/60"><PreviewTaskRow title="Send homepage draft to Mara" project="Client Refresh" due="Today" /><div className="border-t border-border/50"><PreviewTaskRow title="Review mobile navigation" project="Website" due="Tomorrow" /></div></div>
      </div>
    </section>
  )
}

export function HomeOverviewPreview() {
  return <section className="landing-app-preview overflow-hidden rounded-lg border border-border bg-background text-foreground shadow-sm" aria-label="PlanGlade daily Home preview"><HomeContent /></section>
}
