import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("Calendar task cards use semantic neutral surfaces with restrained status signals", async () => {
  const source = await readProjectFile("src/app/app/calendar/page.tsx")
  const monthCardSource = source.match(/function MonthTaskCard[\s\S]*?function DayOverflowButton/)?.[0] ?? ""
  const inspectorRowSource = source.match(/function TaskChip[\s\S]*?function DayOverflowPopover/)?.[0] ?? ""
  const toneSource = source.match(/const TASK_RAIL_COLOR[\s\S]*?function projectNameFor/)?.[0] ?? ""

  assert.match(toneSource, /border-border\/70 bg-surface\/80 text-foreground hover:bg-hover\/70/)
  assert.match(toneSource, /border-border\/50 bg-surface\/50 text-muted-foreground hover:bg-hover\/60/)
  assert.match(monthCardSource, /border-l-2/)
  assert.match(inspectorRowSource, /border-l-2/)
  assert.match(toneSource, /line-through/)
  assert.match(monthCardSource, /text-muted-foreground/)

  assert.match(toneSource, /overdue:\s*"rgb\(185 28 28\)"/)
  assert.match(toneSource, /blocked:\s*"rgb\(180 83 9\)"/)
  assert.match(toneSource, /text-red-700 dark:text-red-300/)
  assert.match(toneSource, /text-amber-700 dark:text-amber-300/)
  assert.match(toneSource, /isBlockedByOpenTask/)

  assert.doesNotMatch(source, /color-mix\(in oklch, \$\{accent\}/)
  assert.doesNotMatch(source, /function accentFor/)
  assert.doesNotMatch(toneSource, /bg-(?:red|amber|emerald|green|cyan|sky|blue|violet|purple|pink)-/)
  assert.doesNotMatch(toneSource, /border-(?:red|amber|emerald|green|cyan|sky|blue|violet|purple|pink)-/)
  assert.doesNotMatch(inspectorRowSource, /text-(?:emerald|green|cyan|sky|blue|violet|purple|pink)-/)
})

test("Calendar priority remains zinc-intensity metadata, not hue-coded card state", async () => {
  const source = await readProjectFile("src/app/app/calendar/page.tsx")
  const inspectorRowSource = source.match(/function TaskChip[\s\S]*?function DayOverflowPopover/)?.[0] ?? ""

  const titleIndex = inspectorRowSource.indexOf("{item.title}")
  const projectIndex = inspectorRowSource.indexOf("{projectName}")
  const priorityIndex = inspectorRowSource.indexOf("<PriorityIcon")
  const stateIndex = inspectorRowSource.indexOf("{stateLabel}</span>")

  assert.ok(titleIndex > 0, "title must be present")
  assert.ok(projectIndex > titleIndex, "project must follow title")
  assert.ok(priorityIndex > 0, "priority must be present")
  assert.ok(priorityIndex > projectIndex, "priority must follow project")
  assert.ok(stateIndex > priorityIndex, "restrained state must follow priority")
  assert.doesNotMatch(inspectorRowSource, /item\.priority[\s\S]*?(?:red|amber|emerald|green|cyan|sky|blue|violet|purple|pink)/)
})

test("Calendar busy month days use compact rows and calm overflow", async () => {
  const source = await readProjectFile("src/app/app/calendar/page.tsx")
  const monthCardSource = source.match(/function MonthTaskCard[\s\S]*?function DayOverflowButton/)?.[0] ?? ""
  const overflowSource = source.match(/function DayOverflowButton[\s\S]*?function TaskChip/)?.[0] ?? ""
  const inspectorRowSource = source.match(/function TaskChip[\s\S]*?function DayOverflowPopover/)?.[0] ?? ""
  const monthSource = source.match(/const MONTH_VISIBLE[\s\S]*?function WeekView/)?.[0] ?? ""

  assert.match(source, /const MONTH_VISIBLE = 2/)
  assert.doesNotMatch(source, /const MONTH_DESKTOP_VISIBLE/)
  assert.match(monthSource, /const visible = dayItems\.slice\(0, MONTH_VISIBLE\)/)
  assert.match(monthSource, /const hasOverflow = dayItems\.length > MONTH_VISIBLE/)
  assert.match(monthSource, /hasOverflow \? \([\s\S]*?<DayOverflowPopover/)
  assert.match(monthSource, /max-h-\[5\.75rem\] space-y-0\.5 overflow-hidden/)
  assert.match(monthSource, /<MonthTaskCard/)

  assert.match(monthCardSource, /grid-cols-\[minmax\(0,1fr\)_auto\] grid-rows-\[auto_auto\]/)
  assert.match(monthCardSource, /min-w-0 truncate font-medium/)
  assert.match(monthCardSource, /<PriorityIcon p=\{item\.priority\}/)
  assert.match(monthCardSource, /col-span-2 hidden min-w-0 truncate text-\[10px\] text-muted-foreground lg:block/)
  assert.doesNotMatch(monthCardSource, /<Avatar/)
  assert.doesNotMatch(monthCardSource, /<Chip>\{displayLabel\}<\/Chip>/)
  assert.doesNotMatch(monthCardSource, /formatDueLabel|dueLabel|\{dueLabel\}/)
  assert.doesNotMatch(monthCardSource, /DependencyBadge/)

  assert.match(overflowSource, /type="button"/)
  assert.match(overflowSource, /aria-label=\{`View all \$\{total\} tasks for \$\{fullDateLabel\(dateKey\)\}`\}/)
  assert.match(overflowSource, /View all \{total\}/)
  assert.match(overflowSource, /border-border bg-muted/)
  assert.match(overflowSource, /focus-visible:ring-2 focus-visible:ring-ring/)
  assert.match(overflowSource, /onInspect\(dateKey\)/)
  assert.match(inspectorRowSource, /sm:grid-cols-\[minmax\(0,1fr\)_104px_minmax\(5rem,7rem\)\]/)
  assert.match(inspectorRowSource, /block min-w-0 truncate text-\[13px\] font-medium/)

  assert.doesNotMatch(monthSource, /overflow-x-auto|min-w-\[720px\]/)
  assert.doesNotMatch(overflowSource, /bg-(?:red|amber|emerald|green|cyan|sky|blue|violet|purple|pink)-/)
})

test("Calendar busy days open a focused day inspector with all tasks and an add action", async () => {
  const source = await readProjectFile("src/app/app/calendar/page.tsx")
  const monthSource = source.match(/function MonthView[\s\S]*?function WeekView/)?.[0] ?? ""
  const overflowSource = source.match(/function DayOverflowButton[\s\S]*?function TaskChip/)?.[0] ?? ""
  const inspectorSource = source.match(/function DayInspector[\s\S]*?function MonthView/)?.[0] ?? ""
  const inspectorRowSource = source.match(/function TaskChip[\s\S]*?function DayOverflowPopover/)?.[0] ?? ""
  const mainSource = source.match(/function CalendarPageContent[\s\S]*?export default function CalendarPage/)?.[0] ?? ""

  assert.match(monthSource, /const visible = dayItems\.slice\(0, MONTH_VISIBLE\)/)
  assert.match(monthSource, /const hasOverflow = dayItems\.length > MONTH_VISIBLE/)
  assert.match(monthSource, /hasOverflow \? \([\s\S]*?<DayOverflowPopover[\s\S]*total=\{dayItems\.length\}/)
  assert.match(monthSource, /hasOverflow \? \([\s\S]*<DayOverflowPopover[\s\S]*\) : \([\s\S]*<span className="shrink-0 rounded border border-border bg-muted/)

  assert.match(overflowSource, /type="button"/)
  assert.match(overflowSource, /event\.stopPropagation\(\)/)
  assert.match(overflowSource, /aria-label=\{`View all \$\{total\} tasks for \$\{fullDateLabel\(dateKey\)\}`\}/)
  assert.match(overflowSource, /View all \{total\}/)

  assert.match(inspectorSource, /<Dialog open=\{open\}/)
  assert.match(inspectorSource, /<DialogTitle className="truncate text-\[16px\]">\{dateLabel\}<\/DialogTitle>/)
  assert.match(inspectorSource, /\{items\.length\} task/)
  assert.match(inspectorSource, /<button[\s\S]*type="button"[\s\S]*Add task for this day/)
  assert.match(inspectorSource, /border-t border-border\/70 bg-surface\/70/)
  assert.doesNotMatch(inspectorSource, /<CalendarDayAddButton[\s\S]*dateKey=\{dateKey\}/)
  assert.match(inspectorSource, /items\.map\(\(item\) => \(/)
  assert.match(inspectorSource, /<TaskChip/)
  assert.match(inspectorSource, /max-h-\[min\(32rem,calc\(100vh-11rem\)\)\]/)
  assert.match(inspectorSource, /\[scrollbar-width:thin\]/)

  assert.match(mainSource, /const \[inspectedDateKey, setInspectedDateKey\] = useState<string \| null>\(null\)/)
  assert.match(mainSource, /const inspectedDateItems = inspectedDateKey \? \(itemsByKey\[inspectedDateKey\] \?\? \[\]\) : \[\]/)
  assert.match(mainSource, /<DayInspector[\s\S]*items=\{inspectedDateItems\}/)
  assert.match(mainSource, /onInspect=\{setInspectedDateKey\}/)
  assert.match(mainSource, /<DayInspector[\s\S]*onSelect=\{setSelectedId\}/)

  assert.match(inspectorRowSource, /block min-w-0 truncate text-\[13px\] font-medium/)
  assert.match(inspectorRowSource, /mt-0\.5 block min-w-0 truncate text-\[11px\] text-muted-foreground/)
  assert.doesNotMatch(inspectorRowSource, /DependencyBadge/)
  assert.doesNotMatch(monthSource, /overflow-y-auto[\s\S]*<MonthTaskCard/)
  assert.doesNotMatch(source, /PopoverTrigger|PopoverContent/)
})

test("Calendar day add controls remain available for empty, filled, and busy days", async () => {
  const source = await readProjectFile("src/app/app/calendar/page.tsx")
  const addButtonSource = source.match(/function CalendarDayAddButton[\s\S]*?function MonthView/)?.[0] ?? ""
  const monthSource = source.match(/function MonthView[\s\S]*?function WeekView/)?.[0] ?? ""
  const weekSource = source.match(/function WeekView[\s\S]*?function NoDateTask/)?.[0] ?? ""
  const monthCardSource = source.match(/function MonthTaskCard[\s\S]*?function DayOverflowButton/)?.[0] ?? ""
  const overflowSource = source.match(/function DayOverflowButton[\s\S]*?function TaskChip/)?.[0] ?? ""

  assert.match(addButtonSource, /type="button"/)
  assert.match(addButtonSource, /aria-label=\{`Add task for \$\{fullDateLabel\(dateKey\)\}`\}/)
  assert.match(addButtonSource, /event\.stopPropagation\(\)/)
  assert.match(addButtonSource, /onCreate\(dateKey\)/)
  assert.match(addButtonSource, /data-calendar-add="day"/)
  assert.match(addButtonSource, /border-border\/50 bg-transparent/)
  assert.match(addButtonSource, /hover:bg-hover\/60/)

  assert.match(monthSource, /const visible = dayItems\.slice\(0, MONTH_VISIBLE\)/)
  assert.match(monthSource, /const hasOverflow = dayItems\.length > MONTH_VISIBLE/)
  assert.match(monthSource, /hasOverflow \? \([\s\S]*?<DayOverflowPopover/)
  assert.match(monthSource, /<\/div>\s*<CalendarDayAddButton\s+dateKey=\{key\}/)
  assert.match(monthSource, /className="mt-1"/)
  assert.doesNotMatch(monthSource, /opacity-0 group-hover\/day:opacity-100/)
  assert.match(weekSource, /dayItems\.map[\s\S]*?<CalendarDayAddButton dateKey=\{key\}/)
  assert.doesNotMatch(monthSource, /dayItems\.length === 0 &&/)
  assert.doesNotMatch(weekSource, /dayItems\.length === 0 &&/)

  assert.match(overflowSource, /event\.stopPropagation\(\)/)
  assert.match(monthCardSource, /type="button"[\s\S]*onClick=\{\(\) => onSelect\(item\.id\)\}/)
})

test("Calendar selected task state follows the open drawer task id", async () => {
  const source = await readProjectFile("src/app/app/calendar/page.tsx")
  const monthCardSource = source.match(/function MonthTaskCard[\s\S]*?function DayOverflowButton/)?.[0] ?? ""
  const inspectorRowSource = source.match(/function TaskChip[\s\S]*?function DayOverflowPopover/)?.[0] ?? ""
  const noDateSource = source.match(/function NoDateTask[\s\S]*?type CalView/)?.[0] ?? ""
  const monthSource = source.match(/function MonthView[\s\S]*?function WeekView/)?.[0] ?? ""
  const weekSource = source.match(/function WeekView[\s\S]*?function NoDateTask/)?.[0] ?? ""
  const inspectorSource = source.match(/function DayInspector[\s\S]*?function MonthView/)?.[0] ?? ""
  const mainSource = source.match(/function CalendarPageContent[\s\S]*?export default function CalendarPage/)?.[0] ?? ""

  assert.match(source, /function chipStyle\(state: CalendarTaskState, isSelected = false\)/)
  assert.match(source, /isSelected \? "rgb\(63 63 70\)" : TASK_RAIL_COLOR\[state\]/)
  assert.match(source, /function taskTone\(state: CalendarTaskState, isSelected = false\)/)
  assert.match(source, /border-ring bg-hover text-foreground ring-1 ring-ring/)
  assert.match(source, /shadow-\[inset_3px_0_0_var\(--color-ring\)\]/)
  assert.match(source, /function inspectorRowTone\(state: CalendarTaskState, isSelected = false\)/)
  assert.match(source, /border-ring bg-hover text-foreground ring-1 ring-ring/)
  assert.doesNotMatch(source.match(/function taskTone[\s\S]*?function titleTone/)?.[0] ?? "", /red|amber|emerald|green|cyan|sky|blue|violet|purple|pink/)

  assert.match(monthCardSource, /data-selected=\{isSelected \? "true" : "false"\}/)
  assert.match(monthCardSource, /aria-current=\{isSelected \? "true" : undefined\}/)
  assert.match(monthCardSource, /style=\{chipStyle\(state, isSelected\)\}/)
  assert.match(monthCardSource, /taskTone\(state, isSelected\)/)
  assert.match(monthCardSource, /titleTone\(state, isSelected\)/)

  assert.match(inspectorRowSource, /data-selected=\{isSelected \? "true" : "false"\}/)
  assert.match(inspectorRowSource, /aria-current=\{isSelected \? "true" : undefined\}/)
  assert.match(inspectorRowSource, /style=\{chipStyle\(state, isSelected\)\}/)
  assert.match(inspectorRowSource, /inspectorRowTone\(state, isSelected\)/)
  assert.doesNotMatch(inspectorRowSource, /border-zinc-900|ring-zinc-900|shadow-\[inset_3px_0_0_rgb\(24_24_27\)\]/)
  assert.match(noDateSource, /data-selected=\{isSelected \? "true" : "false"\}/)
  assert.match(noDateSource, /aria-current=\{isSelected \? "true" : undefined\}/)
  assert.match(noDateSource, /border-ring bg-muted ring-1 ring-ring/)

  assert.match(monthSource, /selectedId: string \| null/)
  assert.match(monthSource, /isSelected=\{t\.id === selectedId\}/)
  assert.match(weekSource, /selectedId: string \| null/)
  assert.match(weekSource, /isSelected=\{t\.id === selectedId\}/)
  assert.match(inspectorSource, /selectedId: string \| null/)
  assert.match(inspectorSource, /isSelected=\{item\.id === selectedId\}/)
  assert.match(mainSource, /<MonthView[\s\S]*selectedId=\{selectedId\}/)
  assert.match(mainSource, /<WeekView[\s\S]*selectedId=\{selectedId\}/)
  assert.match(mainSource, /<DayInspector[\s\S]*selectedId=\{selectedId\}/)
  assert.match(mainSource, /<NoDateTask[\s\S]*isSelected=\{item\.id === selectedId\}/)
  assert.match(mainSource, /onClose=\{\(\) => \{[\s\S]*setSelectedId\(null\);[\s\S]*setFocusNewTask\(false\);[\s\S]*\}\}/)
})

test("Calendar No date rows use a stable aligned grid with safe truncation", async () => {
  const source = await readProjectFile("src/app/app/calendar/page.tsx")
  const noDateSource = source.match(/function NoDateTask[\s\S]*?type CalView/)?.[0] ?? ""
  const noDateSectionSource = source.match(/\{noDateTasks\.length > 0 && \([\s\S]*?<TaskDrawer/)?.[0] ?? ""

  assert.match(noDateSource, /type="button"/)
  assert.match(noDateSource, /grid min-h-11 w-full min-w-0 grid-cols-\[minmax\(0,1fr\)\] items-center/)
  assert.match(noDateSource, /md:grid-cols-\[minmax\(18rem,1fr\)_minmax\(10rem,16rem\)_96px_minmax\(8rem,12rem\)_96px_88px\]/)
  assert.match(noDateSource, /block truncate font-medium/)
  assert.match(noDateSource, /hidden min-w-0 truncate text-\[11px\] text-muted-foreground md:block/)
  assert.match(noDateSource, /hidden min-w-0 items-center gap-1 text-muted-foreground md:inline-flex/)
  assert.match(noDateSource, /hidden min-w-0 items-center gap-1 text-foreground\/75 md:inline-flex/)
  assert.match(noDateSource, /hidden min-w-0 max-w-full overflow-hidden md:inline-flex \[\&_\*\]:min-w-0 \[\&_\*\]:truncate/)
  assert.match(noDateSource, /hidden shrink-0 text-muted-foreground md:block/)
  assert.match(noDateSource, /focus-visible:ring-2 focus-visible:ring-ring/)
  assert.match(noDateSectionSource, /section className="w-full min-w-0 border-t/)
  assert.match(noDateSectionSource, /div className="w-full min-w-0 border-t/)
  assert.match(noDateSectionSource, /md:grid/)
  assert.match(noDateSectionSource, /<span>Title<\/span>[\s\S]*<span>Project<\/span>[\s\S]*<span>Priority<\/span>[\s\S]*<span>Assignee<\/span>[\s\S]*<span>Status<\/span>[\s\S]*<span>Date<\/span>/)
  assert.doesNotMatch(noDateSource, /overflow-x-auto|min-w-\[720px\]/)
  assert.match(noDateSource, /const displayLabel = item\.status/)
  assert.match(noDateSource, /<Chip>\{displayLabel\}<\/Chip>/)
  assert.doesNotMatch(noDateSource, /DependencyBadge|flex-wrap|item\.label\?/)
  assert.doesNotMatch(noDateSource, /bg-(?:red|amber|emerald|green|cyan|sky|blue|violet|purple|pink)-/)
})
