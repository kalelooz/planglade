import type { WorkspaceState, Task, Project, Note, InboxItem, TaskStatus, Priority } from '@/types'
import { daysFromToday } from '@/lib/dates'

let seq = 0
const id = (p: string) => `${p}-${(++seq).toString(36)}${Math.random().toString(36).slice(2, 6)}`
const now = Date.now()
const ago = (mins: number) => now - mins * 60000

interface TaskSpec {
  title: string
  project?: string // index key
  status?: TaskStatus
  priority?: Priority
  due?: number | null // days from today
  description?: string
  dependsOnTitles?: string[]
  relatedTitles?: string[]
  labels?: string[]
  assignee?: string
  completedDaysAgo?: number
  createdMinsAgo?: number
}

function buildSeed(): WorkspaceState {
  seq = 0

  const projects: Project[] = [
    {
      id: id('prj'),
      name: 'PlanGlade Public Alpha',
      description: 'Getting the open alpha ready for its first public release.',
      status: 'active',
      focus: 'Finish the onboarding flow and freeze the alpha scope.',
      targetDate: daysFromToday(21),
      startDate: daysFromToday(-34),
      createdAt: ago(60 * 24 * 34),
    },
    {
      id: id('prj'),
      name: 'Client Website Refresh',
      description: "Reworking Mara's pottery studio site: new photos, simpler pages.",
      status: 'active',
      focus: 'Waiting on final photography before the homepage build.',
      targetDate: daysFromToday(16),
      startDate: daysFromToday(-20),
      createdAt: ago(60 * 24 * 20),
    },
    {
      id: id('prj'),
      name: 'Research Notes',
      description: 'Reading and synthesis on calm, sustainable software design.',
      status: 'active',
      focus: 'Summarize the attention-residue paper.',
      targetDate: null,
      startDate: daysFromToday(-90),
      createdAt: ago(60 * 24 * 90),
    },
    {
      id: id('prj'),
      name: 'Personal Admin',
      description: 'Life logistics: paperwork, money, appointments.',
      status: 'active',
      focus: 'Get the tax folder sorted before the end of the month.',
      targetDate: null,
      startDate: daysFromToday(-200),
      createdAt: ago(60 * 24 * 200),
    },
    {
      id: id('prj'),
      name: 'Portfolio Update',
      description: 'Refresh the portfolio with two recent case studies.',
      status: 'on_hold',
      focus: 'Paused until the client site ships.',
      targetDate: null,
      startDate: daysFromToday(-45),
      createdAt: ago(60 * 24 * 45),
    },
    {
      id: id('prj'),
      name: 'Summer Travel Plan',
      description: 'Two weeks in Portugal in late August. Slow trains, no laptops.',
      status: 'active',
      focus: 'Book the Lisbon hotel before prices jump.',
      targetDate: daysFromToday(40),
      startDate: daysFromToday(-12),
      createdAt: ago(60 * 24 * 12),
    },
  ]
  const P = Object.fromEntries(projects.map((p) => [p.name, p.id]))

  const people = [
    { id: id('per'), name: 'Mara Lopes', role: 'Client — pottery studio' },
    { id: id('per'), name: 'Jonas Weber', role: 'Friend — print shop' },
    { id: id('per'), name: 'Priya Nair', role: 'Design peer review' },
  ]
  const PE = Object.fromEntries(people.map((p) => [p.name, p.id]))

  const labels = [
    { id: id('lbl'), name: 'writing', color: '215 60% 48%' },
    { id: id('lbl'), name: 'design', color: '280 45% 52%' },
    { id: id('lbl'), name: 'dev', color: '190 70% 36%' },
    { id: id('lbl'), name: 'admin', color: '35 70% 42%' },
    { id: id('lbl'), name: 'errand', color: '340 55% 50%' },
    { id: id('lbl'), name: 'waiting', color: '220 10% 55%' },
  ]
  const L = Object.fromEntries(labels.map((l) => [l.name, l.id]))

  const specs: TaskSpec[] = [
    // PlanGlade Public Alpha
    { title: 'Draft alpha announcement post', project: 'PlanGlade Public Alpha', status: 'in_progress', priority: 'high', due: 0, labels: ['writing'], description: 'Short, honest post for the blog and the fediverse. Lead with what works today, not the roadmap.' },
    { title: 'Finish onboarding empty states', project: 'PlanGlade Public Alpha', status: 'in_progress', priority: 'high', due: 1, labels: ['design', 'dev'], description: 'The first-run experience should feel calm, not empty. Three screens: capture, organize, done.' },
    { title: 'Write the quick-start guide', project: 'PlanGlade Public Alpha', status: 'planned', priority: 'medium', due: 4, labels: ['writing'], dependsOnTitles: ['Finish onboarding empty states'] },
    { title: 'Fix board drag glitch on Firefox', project: 'PlanGlade Public Alpha', status: 'planned', priority: 'medium', due: 3, labels: ['dev'], description: 'Cards jump two columns when dragged slowly. Reproduce, then check the drop-collision logic.' },
    { title: 'Cut the 0.9.0 release build', project: 'PlanGlade Public Alpha', status: 'blocked', priority: 'high', due: 6, labels: ['dev'], dependsOnTitles: ['Fix board drag glitch on Firefox', 'Finish onboarding empty states'], description: 'Tag, changelog, sign the release, upload artifacts.' },
    { title: 'Set up alpha feedback inbox', project: 'PlanGlade Public Alpha', status: 'done', priority: 'low', completedDaysAgo: 2, labels: ['admin'] },
    { title: 'Triage crash report from TestFlight', project: 'PlanGlade Public Alpha', status: 'planned', priority: 'high', due: -1, labels: ['dev'], description: 'One report, looks like a race in the local store. Repro steps attached in the email.' },
    { title: 'Decide license for the docs theme', project: 'PlanGlade Public Alpha', status: 'backlog', priority: 'low', labels: ['admin'] },

    // Client Website Refresh
    { title: 'Send homepage draft to Mara', project: 'Client Website Refresh', status: 'in_progress', priority: 'high', due: 0, labels: ['design'], assignee: 'Mara Lopes', description: 'Attach the two layout options. Ask her to pick one direction, not mix them.' },
    { title: 'Chase final product photos', project: 'Client Website Refresh', status: 'blocked', priority: 'medium', due: -2, labels: ['waiting'], assignee: 'Mara Lopes', dependsOnTitles: ['Send homepage draft to Mara'], description: 'Photographer said Thursday. It is no longer Thursday.' },
    { title: 'Rebuild contact page with new map', project: 'Client Website Refresh', status: 'planned', priority: 'medium', due: 5, labels: ['dev'], dependsOnTitles: ['Chase final product photos'] },
    { title: 'Compress and tag gallery images', project: 'Client Website Refresh', status: 'backlog', priority: 'low', labels: ['dev'], dependsOnTitles: ['Chase final product photos'] },
    { title: 'Invoice deposit for phase two', project: 'Client Website Refresh', status: 'done', priority: 'medium', completedDaysAgo: 5, labels: ['admin'] },

    // Research Notes
    { title: 'Summarize attention-residue paper', project: 'Research Notes', status: 'in_progress', priority: 'medium', due: 2, labels: ['writing'], description: 'Three paragraphs max. What it means for context switching in solo work.' },
    { title: 'Read chapter 4 of "A Pattern Language"', project: 'Research Notes', status: 'backlog', priority: 'low', labels: ['writing'] },
    { title: 'Clip quotes from calm-tech essays', project: 'Research Notes', status: 'backlog', priority: 'none', labels: ['writing'] },

    // Personal Admin
    { title: 'File Q2 tax paperwork', project: 'Personal Admin', status: 'planned', priority: 'high', due: 1, labels: ['admin'], description: 'Folder is on the desk. Scan, name properly, upload to the accountant portal.' },
    { title: 'Renew driver\'s license', project: 'Personal Admin', status: 'planned', priority: 'medium', due: 9, labels: ['errand'] },
    { title: 'Book dentist appointment', project: 'Personal Admin', status: 'backlog', priority: 'low', labels: ['errand'] },
    { title: 'Cancel unused streaming subscription', project: 'Personal Admin', status: 'done', priority: 'low', completedDaysAgo: 1, labels: ['admin'] },

    // Portfolio Update
    { title: 'Write case study: bakery rebrand', project: 'Portfolio Update', status: 'backlog', priority: 'medium', labels: ['writing'] },
    { title: 'Collect feedback from Priya', project: 'Portfolio Update', status: 'blocked', priority: 'low', labels: ['waiting'], assignee: 'Priya Nair', dependsOnTitles: ['Write case study: bakery rebrand'] },

    // Summer Travel Plan
    { title: 'Book Lisbon hotel', project: 'Summer Travel Plan', status: 'planned', priority: 'high', due: 2, labels: ['errand'], description: 'Near the metro, quiet street, refundable. Budget: under 120 a night.' },
    { title: 'Reserve train seats Lisbon to Porto', project: 'Summer Travel Plan', status: 'backlog', priority: 'medium', due: 12, labels: ['errand'], dependsOnTitles: ['Book Lisbon hotel'] },
    { title: 'Check passport validity', project: 'Summer Travel Plan', status: 'done', priority: 'high', completedDaysAgo: 3, labels: ['admin'] },
    { title: 'Make a loose day-by-day outline', project: 'Summer Travel Plan', status: 'backlog', priority: 'none', labels: ['writing'] },
  ]

  const tasks: Task[] = specs.map((s) => {
    const completed = s.status === 'done'
    const createdAt = ago(s.createdMinsAgo ?? 60 * 24 * (s.completedDaysAgo ?? 4) + 180)
    return {
      id: id('tsk'),
      title: s.title,
      description: s.description ?? '',
      projectId: s.project ? P[s.project] : null,
      status: s.status ?? 'backlog',
      priority: s.priority ?? 'none',
      dueDate: s.due === null || s.due === undefined ? null : daysFromToday(s.due),
      parentId: null,
      dependsOn: [],
      related: [],
      labelIds: (s.labels ?? []).map((n) => L[n]),
      assigneeId: s.assignee ? PE[s.assignee] : null,
      createdAt,
      updatedAt: createdAt,
      completedAt: completed ? ago(60 * 24 * (s.completedDaysAgo ?? 1)) : null,
      history: [{ at: createdAt, text: 'Created' }],
    }
  })
  const byTitle = new Map(tasks.map((t) => [t.title, t]))
  specs.forEach((s, i) => {
    const t = tasks[i]
    t.dependsOn = (s.dependsOnTitles ?? []).map((x) => byTitle.get(x)!.id)
    t.related = (s.relatedTitles ?? []).map((x) => byTitle.get(x)!.id)
  })

  // Subtasks
  const sub = (parentTitle: string, title: string, done: boolean): Task => {
    const parent = byTitle.get(parentTitle)!
    return {
      id: id('tsk'),
      title,
      description: '',
      projectId: parent.projectId,
      status: done ? 'done' : parent.status === 'done' ? 'done' : 'planned',
      priority: parent.priority,
      dueDate: null,
      parentId: parent.id,
      dependsOn: [],
      related: [],
      labelIds: [],
      assigneeId: null,
      createdAt: ago(60 * 20),
      updatedAt: ago(60 * 20),
      completedAt: done ? ago(60 * 18) : null,
      history: [{ at: ago(60 * 20), text: 'Created' }],
    }
  }
  const subtasks = [
    sub('Finish onboarding empty states', 'Sketch three first-run screens', true),
    sub('Finish onboarding empty states', 'Write microcopy for each screen', true),
    sub('Finish onboarding empty states', 'Wire screens into the router', false),
    sub('Draft alpha announcement post', 'Outline what ships in the alpha', true),
    sub('Draft alpha announcement post', 'Add two screenshots', false),
    sub('File Q2 tax paperwork', 'Scan receipts folder', false),
    sub('File Q2 tax paperwork', 'Export bank statements', false),
    sub('Book Lisbon hotel', 'Shortlist three neighborhoods', true),
    sub('Book Lisbon hotel', 'Compare refundable rates', false),
  ]
  tasks.push(...subtasks)

  const notes: Note[] = [
    {
      id: id('nte'),
      title: 'Alpha scope — what ships, what waits',
      projectId: P['PlanGlade Public Alpha'],
      createdAt: ago(60 * 24 * 6),
      updatedAt: ago(60 * 5),
      content: `## Ships in the alpha\n\n- Capture (inbox + quick add)\n- Tasks with list and board\n- Projects, notes, calendar\n- Local-first storage, no account needed\n\n## Waits for later\n\n- Sync between devices\n- Reminders and notifications\n- Mobile apps\n\n> Rule of thumb: if it needs a server, it waits.\n\nThe announcement post should say this plainly. People forgive a small scope; they do not forgive surprises.`,
    },
    {
      id: id('nte'),
      title: 'Meeting notes — Mara, site refresh',
      projectId: P['Client Website Refresh'],
      createdAt: ago(60 * 24 * 3),
      updatedAt: ago(60 * 26),
      content: `## Decisions\n\n- Two layout options for the homepage, she picks **one**\n- Gallery stays, but smaller and faster\n- Map on the contact page, not the homepage\n\n## Open questions\n\n1. Does she want a booking form this phase? (leaning no)\n2. Who writes the new About page copy?\n\nNext check-in: end of the week.`,
    },
    {
      id: id('nte'),
      title: 'Attention residue — reading notes',
      projectId: P['Research Notes'],
      createdAt: ago(60 * 24 * 10),
      updatedAt: ago(60 * 48),
      content: `Core claim: switching tasks leaves part of your attention stuck on the previous task, and the residue is worse when the first task is unfinished.\n\n## Why it matters here\n\n- Solo work has no external structure, so self-imposed boundaries matter more\n- A "park it properly" habit (write the next step down) reduces the residue\n- This is basically the argument for capture-first tools\n\n## To summarize\n\n- [ ] Method in one paragraph\n- [ ] The unfinished-task effect\n- [ ] What it suggests for daily planning`,
    },
    {
      id: id('nte'),
      title: 'Portugal — loose ideas',
      projectId: P['Summer Travel Plan'],
      createdAt: ago(60 * 24 * 9),
      updatedAt: ago(60 * 24 * 2),
      content: `| Stop | Nights | Why |\n| --- | --- | --- |\n| Lisbon | 4 | Arrive, decompress, bookshops |\n| Coimbra | 2 | Break the train ride north |\n| Porto | 4 | Port, river, that one bakery |\n| Coast near Aveiro | 3 | Do absolutely nothing |\n\nKeep it refundable until July. Trains beat renting a car.`,
    },
    {
      id: id('nte'),
      title: 'Design principles for calm software',
      projectId: P['Research Notes'],
      createdAt: ago(60 * 24 * 15),
      updatedAt: ago(60 * 24 * 4),
      content: `1. **Quiet by default.** Badges and counts only where they change a decision.\n2. **One obvious next action.** Not a dashboard of twelve.\n3. **Forgiving.** Everything reversible, nothing punitive.\n4. **Fast feels calm.** Latency reads as anxiety.\n\n*Related: the attention-residue notes.*`,
    },
    {
      id: id('nte'),
      title: 'Accountant portal checklist',
      projectId: P['Personal Admin'],
      createdAt: ago(60 * 24 * 2),
      updatedAt: ago(60 * 24 * 2),
      content: `Uploads needed:\n\n- [ ] Receipts, scanned and renamed\n- [ ] Bank statements (both accounts)\n- [x] Last year's return (already there)\n- [ ] Home-office worksheet\n\nPortal link is in the password manager under "Taxes".`,
    },
    {
      id: id('nte'),
      title: 'Ideas parking lot',
      projectId: null,
      createdAt: ago(60 * 24 * 30),
      updatedAt: ago(60 * 8),
      content: `Not projects yet. Maybe never. That's fine.\n\n- A tiny CLI that turns meeting notes into calendar holds\n- Print zine about solo software maintenance\n- "One screen" budgeting spreadsheet, opinionated\n- Talk: what solo builders can skip\n\nReview monthly. Delete without mercy.`,
    },
    {
      id: id('nte'),
      title: 'Weekly reset template',
      projectId: null,
      createdAt: ago(60 * 24 * 21),
      updatedAt: ago(60 * 24 * 7),
      content: `Every Friday, twenty minutes:\n\n1. Empty the inbox (convert or dismiss, no snoozing)\n2. Look at next week's calendar\n3. Pick the **one thing** that makes the week a win\n4. Archive what is done\n\n> The point is not a clean app. The point is a clear head.`,
    },
  ]

  const inbox: InboxItem[] = [
    { id: id('inx'), text: 'Ask Jonas for a print quote on the zine', projectId: null, dueDate: null, priority: 'none', createdAt: ago(60 * 3) },
    { id: id('inx'), text: 'Idea: keyboard-first command bar screencast for the launch', projectId: null, dueDate: null, priority: 'none', createdAt: ago(60 * 7) },
    { id: id('inx'), text: 'Renew library books', projectId: null, dueDate: daysFromToday(1), priority: 'low', createdAt: ago(60 * 26) },
    { id: id('inx'), text: 'Read the localization issue someone opened on GitHub', projectId: P['PlanGlade Public Alpha'], dueDate: null, priority: 'medium', createdAt: ago(60 * 30) },
    { id: id('inx'), text: 'Look into e-invoicing rules for next year', projectId: null, dueDate: null, priority: 'none', createdAt: ago(60 * 50) },
    { id: id('inx'), text: 'Mara sent a link to a photographer she likes', projectId: P['Client Website Refresh'], dueDate: null, priority: 'none', createdAt: ago(60 * 55) },
  ]

  return {
    workspaceName: 'Northstar Studio',
    userName: 'Alex',
    projects,
    tasks,
    notes,
    inbox,
    people,
    labels,
    settings: { theme: 'system', priorityDisplay: 'icon', weekStartsOn: 1, hideHomeCompleted: true },
    recents: [],
  }
}

export const seedWorkspace = buildSeed
