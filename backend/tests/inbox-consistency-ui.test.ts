import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const inboxPath = path.join(process.cwd(), "src/app/app/inbox/page.tsx")

test("Inbox uses flat Home-style rows and compact metadata", async () => {
  const inbox = await readFile(inboxPath, "utf8")

  assert.doesNotMatch(inbox, /import \{ FlowRow \}/)
  assert.match(inbox, /data-inbox-row="pending-capture"/)
  assert.match(inbox, /border-b border-border\/50 bg-transparent/)
  assert.match(inbox, /hover:bg-hover\/60/)
  assert.match(inbox, /text-xs/)
  assert.match(inbox, /font-mono text-\[10px\]/)
})

test("Inbox capture and pending list use quiet workspace surfaces", async () => {
  const inbox = await readFile(inboxPath, "utf8")

  assert.match(inbox, /data-inbox-surface="quick-capture"[^>]*border border-border\/70 bg-surface\/60/)
  assert.match(inbox, /data-inbox-surface="pending-captures"[^>]*border border-border\/70 bg-surface\/40/)
  assert.match(inbox, /border border-border\/70 bg-background/)
  assert.doesNotMatch(inbox, /border-y border-zinc-200 bg-white/)
})

test("Inbox normal convert actions use shared compact accent primary styling", async () => {
  const inbox = await readFile(inboxPath, "utf8")
  const compactPrimaryAction = inbox.match(/const compactPrimaryActionClass[\s\S]*?;/)?.[0] ?? ""
  const convertSelected = inbox.match(/Convert selected to tasks[\s\S]*?<\/button>/)?.[0] ?? ""
  const rowConvert = inbox.match(/title="Convert to task"[\s\S]*?<\/button>/)?.[0] ?? ""
  const normalConvertActions = `${convertSelected}\n${rowConvert}`

  assert.match(compactPrimaryAction, /lov-btn lov-btn-primary/)
  assert.match(compactPrimaryAction, /h-7/)
  assert.match(compactPrimaryAction, /px-2/)
  assert.match(compactPrimaryAction, /text-\[11px\]/)
  assert.match(normalConvertActions, /compactPrimaryActionClass/)
  assert.doesNotMatch(inbox, /zincPrimaryActionClass/)
  assert.doesNotMatch(normalConvertActions, /bg-zinc-900|hover:bg-zinc-800|text-white/)
})

test("Inbox priority stays zinc-only", async () => {
  const inbox = await readFile(inboxPath, "utf8")
  const priorityChip = inbox.match(/function PriorityChip[\s\S]*?function MenuButton/)?.[0] ?? ""
  const priorityTone = priorityChip.match(/const priorityTone[\s\S]*?};/)?.[0] ?? ""

  assert.match(priorityChip, /High: "font-semibold text-foreground"/)
  assert.match(priorityChip, /Medium: "text-muted-foreground"/)
  assert.match(priorityChip, /Low: "text-muted-foreground\/70"/)
  assert.match(priorityChip, /Priority\s*<ChevronDown/)
  assert.doesNotMatch(priorityChip, /\+ priority/)
  assert.doesNotMatch(priorityChip, /<select|appearance-auto|appearance-none/)
  assert.doesNotMatch(priorityTone, /text-(?:red|amber|emerald|blue|green)-/)
  assert.doesNotMatch(priorityChip, /(?:red|amber|emerald|green)-/)
})

test("Inbox uses direct triage terminology and Quick Capture guidance", async () => {
  const inbox = await readFile(inboxPath, "utf8")

  assert.match(inbox, />Convert to task</)
  assert.match(inbox, /aria-label="Dismiss capture"/)
  assert.match(inbox, /Use Quick Capture to add something new\./)
})

test("Inbox rows wrap controls until the full desktop canvas is available", async () => {
  const inbox = await readFile(inboxPath, "utf8")

  assert.doesNotMatch(inbox, /overflow-x-auto/)
  assert.doesNotMatch(inbox, /lg:grid-cols-\[24px_minmax\(220px,1fr\)/)
  assert.match(inbox, /xl:grid-cols-\[24px_minmax\(0,1fr\)_minmax\(0,220px\)_minmax\(0,140px\)_minmax\(0,112px\)_minmax\(0,168px\)\]/)
  assert.match(inbox, /xl:contents/)
  assert.match(inbox, /max-w-\[112px\][^"`]*whitespace-nowrap/)
})

test("Inbox rows keep title/dependency and controls in bounded non-overlapping cells", async () => {
  const inbox = await readFile(inboxPath, "utf8")
  const row = inbox.match(/key=\{item\.id\}[\s\S]*?<ProjectChip[\s\S]*?<DueChip[\s\S]*?<PriorityChip[\s\S]*?title="Convert to task"/)?.[0] ?? ""

  assert.match(row, /xl:grid-cols-\[24px_minmax\(0,1fr\)_minmax\(0,220px\)_minmax\(0,140px\)_minmax\(0,112px\)_minmax\(0,168px\)\]/)
  assert.match(row, /data-inbox-title-dependency-cell className="min-w-0 overflow-hidden"/)
  assert.match(row, /className="block w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap break-words text-left text-xs font-medium/)
  assert.match(row, /<DependencyBadge item=\{item\} allItems=\{workItems\} \/>/)
  assert.match(row, /data-inbox-row-controls className="col-span-2 grid min-w-0/)
  assert.match(row, /sm:grid-cols-\[minmax\(0,1fr\)_minmax\(0,7rem\)_minmax\(0,5rem\)_minmax\(0,auto\)\]/)
  assert.match(row, /<ProjectChip/)
  assert.match(row, /<DueChip/)
  assert.match(row, /<PriorityChip/)
  assert.match(row, /className="w-full min-w-0 shrink-0"/)
  assert.match(row, /<div className="flex min-w-0 flex-wrap items-center justify-end gap-1 sm:flex-nowrap">/)
  assert.doesNotMatch(row, /overflow-hidden[^"]*<ProjectChip|overflow-hidden[^"]*<DueChip|overflow-hidden[^"]*<PriorityChip/)
})

test("INBOX-OVERFLOW-001: row text cells contain long unbroken content without clipping popovers", async () => {
  const inbox = await readFile(inboxPath, "utf8")
  const row = inbox.match(/key=\{item\.id\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/)?.[0] ?? ""
  const projectChip = inbox.match(/function ProjectChip[\s\S]*?function BulkDatePicker/)?.[0] ?? ""
  const menuButton = inbox.match(/function MenuButton[\s\S]*$/)?.[0] ?? ""
  const pageShell = inbox.match(/<div className="flex h-full min-h-0">[\s\S]*?<section/)?.[0] ?? ""

  assert.match(row, /data-inbox-row="pending-capture"/)
  assert.match(row, /min-w-0/)
  assert.match(row, /break-words/)
  assert.match(projectChip, /max-w-full/)
  assert.match(projectChip, /overflow-hidden text-ellipsis whitespace-nowrap/)
  assert.doesNotMatch(pageShell, /overflow-x-hidden/)
  assert.doesNotMatch(row, /data-inbox-row="pending-capture"[\s\S]*className=\{`[^`]*overflow-hidden/)
  assert.doesNotMatch(menuButton, /overflow-hidden/)
})

test("Inbox project menu and empty due control stay compact", async () => {
  const inbox = await readFile(inboxPath, "utf8")
  const projectChip = inbox.match(/function ProjectChip[\s\S]*?function BulkDatePicker/)?.[0] ?? ""
  const compactDate = inbox.match(/function CompactDateControl[\s\S]*?function DueChip/)?.[0] ?? ""

  assert.match(projectChip, /width="w-56 max-w-\[calc\(100vw-2rem\)\]"/)
  assert.match(projectChip, /truncate/)
  assert.match(inbox, /max-h-56 overflow-y-auto/)
  assert.match(compactDate, />No date</)
  assert.match(compactDate, /compactControlClass/)
  assert.match(compactDate, /max-w-\[calc\(100vw-1rem\)\] rounded-md border border-border\/80 bg-popover p-2 shadow-sm/)
})

test("Inbox date cell uses a compact calendar popover instead of a native picker or text editor", async () => {
  const inbox = await readFile(inboxPath, "utf8")
  const rowControls = inbox.match(/<DueChip[\s\S]*?\/>/)?.[0] ?? ""
  const compactDate = inbox.match(/function CompactDateControl[\s\S]*?function DueChip/)?.[0] ?? ""

  assert.match(rowControls, /menuSide=\{itemIndex === inboxItems\.length - 1 \? "top" : "bottom"\}/)
  assert.match(inbox, /import \{ Calendar \} from "@\/components\/ui\/calendar"/)
  assert.match(inbox, /import \{ Popover, PopoverContent, PopoverTrigger \} from "@\/components\/ui\/popover"/)
  assert.match(compactDate, /<Popover open=\{open\} onOpenChange=\{handleOpenChange\}>/)
  assert.match(compactDate, /<PopoverTrigger asChild>/)
  assert.match(compactDate, /aria-haspopup="dialog"/)
  assert.match(compactDate, /role="dialog"/)
  assert.match(compactDate, /side=\{menuSide\}/)
  assert.match(compactDate, /avoidCollisions/)
  assert.match(compactDate, /collisionPadding=\{8\}/)
  assert.match(compactDate, /<Calendar\s+mode="single"/)
  assert.match(compactDate, /selected=\{selectedDate\}/)
  assert.match(compactDate, /onSelect=\{\(date\) => \{/)
  assert.match(compactDate, /formatDateValue\(date\)/)
  assert.match(compactDate, /Clear\s*<\/button>/)
  assert.doesNotMatch(compactDate, /type="date"|showPicker|dateInputRef|sr-only|opacity-0|placeholder="YYYY-MM-DD"|inputMode="numeric"/)
})

test("Inbox date and priority controls avoid clipped native corner artifacts", async () => {
  const inbox = await readFile(inboxPath, "utf8")
  const dueChip = inbox.match(/function DueChip[\s\S]*?function PriorityChip/)?.[0] ?? ""
  const priorityChip = inbox.match(/function PriorityChip[\s\S]*?function MenuButton/)?.[0] ?? ""

  assert.doesNotMatch(dueChip, /overflow-hidden/)
  assert.doesNotMatch(priorityChip, /overflow-hidden/)
  assert.doesNotMatch(dueChip, /focus:outline-none|outline-black|ring-black/)
  assert.doesNotMatch(priorityChip, /focus:outline-none|outline-black|ring-black/)
  assert.match(priorityChip, /className=\{compactControlClass\}/)
})

test("Inbox priority uses a compact full-cell popover instead of the shared large menu", async () => {
  const inbox = await readFile(inboxPath, "utf8")
  const rowControls = inbox.match(/<PriorityChip[\s\S]*?\/>/)?.[0] ?? ""
  const priorityChip = inbox.match(/function PriorityChip[\s\S]*?function MenuButton/)?.[0] ?? ""

  assert.match(rowControls, /menuSide=\{itemIndex === inboxItems\.length - 1 \? "top" : "bottom"\}/)
  assert.doesNotMatch(priorityChip, /<MenuButton/)
  assert.match(priorityChip, /aria-haspopup="menu"/)
  assert.match(priorityChip, /role="menu"/)
  assert.match(priorityChip, /role="menuitem"/)
  assert.match(priorityChip, /fixed inset-0 z-\[90\]/)
  assert.match(priorityChip, /event\.key === "Escape"/)
  assert.match(priorityChip, /z-\[100\] w-36 max-w-\[calc\(100vw-2rem\)\] rounded-md border border-border\/80 bg-popover py-1 shadow-sm/)
  assert.match(priorityChip, /bottom-full mb-1/)
  assert.match(priorityChip, /top-full mt-1/)
  assert.doesNotMatch(priorityChip, /max-h-56|overflow-y-auto|w-56|min-w-56|shadow-md|lov-menu-item/)
})

test("Inbox row actions use explicit button types and isolate clicks", async () => {
  const inbox = await readFile(inboxPath, "utf8")
  const bareButtons = inbox.match(/<button(?![^>]*type=)/g) ?? []
  const rowActions = inbox.match(/<div className="flex min-w-0 flex-wrap items-center justify-end gap-1 sm:flex-nowrap">[\s\S]*?aria-label="Dismiss capture"/)?.[0] ?? ""

  assert.equal(bareButtons.length, 0)
  assert.match(inbox, /aria-label="Select all pending captures"/)
  assert.match(rowActions, /onClick=\{\(event\) => \{/)
  assert.match(rowActions, /event\.preventDefault\(\)/)
  assert.match(rowActions, /event\.stopPropagation\(\)/)
})
