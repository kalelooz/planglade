"use client"

import * as React from "react"
import ReactMarkdown from "react-markdown"
import { Plus, Link2, CheckSquare, Calendar, Notebook, Download, Upload, CheckCircle2, X } from "lucide-react"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { EntityChip } from "@/components/flowboard/entity-chips"
import { useNavStore } from "@/components/flowboard/nav-store"
import { useDrawer } from "@/components/flowboard/drawer-context"
import { noteFormSchema, type NoteFormValues } from "@/components/flowboard/schemas"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoteTag {
  label: string
  color: string
  accent: string
}

interface LinkedTask {
  id: string
  title: string
  priority: "High" | "Medium" | "Low"
}

interface Note {
  id: string
  title: string
  date: string
  tag: NoteTag
  excerpt: string
  body: string
  tags: NoteTag[]
  linkedNotes: { id: string; title: string; excerpt: string; tag: NoteTag }[]
  linkedTasks: LinkedTask[]
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const tagProduct: NoteTag = { label: "Product", color: "bg-primary/10 text-primary", accent: "border-l-primary border-t-primary" }
const tagDesign: NoteTag = { label: "Design", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400", accent: "border-l-pink-500 dark:border-l-pink-400 border-t-pink-500 dark:border-t-pink-400" }
const tagEngineering: NoteTag = { label: "Engineering", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400", accent: "border-l-sky-500 dark:border-l-sky-400 border-t-sky-500 dark:border-t-sky-400" }
const tagMeeting: NoteTag = { label: "Meeting", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", accent: "border-l-amber-500 dark:border-l-amber-400 border-t-amber-500 dark:border-t-amber-400" }
const tagResearch: NoteTag = { label: "Research", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", accent: "border-l-violet-500 dark:border-l-violet-400 border-t-violet-500 dark:border-t-violet-400" }

const mockNotes: Note[] = [
  {
    id: "N1",
    title: "Q3 Product Roadmap",
    date: "May 14, 2026",
    tag: tagProduct,
    excerpt: "Key priorities and milestones for the upcoming quarter...",
    body: `## Q3 Product Roadmap

### Overview

The Q3 roadmap focuses on **three strategic pillars**: user growth, platform stability, and new revenue streams. Each pillar has defined milestones and cross-functional ownership.

### Key Priorities

- **Launch mobile app v2** — Target release by end of July with redesigned onboarding flow and push notifications
- **API v3 migration** — Deprecate legacy endpoints by August; coordinate with all external consumers
- **Design system 2.0** — Publish token-based system with Figma sync and code generation pipeline
- **Analytics dashboard** — Self-serve insights for team leads; reduce ad-hoc reporting requests by **40%**

### Milestones

| Milestone | Target Date | Owner |
|-----------|-------------|-------|
| Mobile beta | Jul 15 | Sara Kim |
| API cutover | Aug 1 | Jake Davis |
| DS 2.0 alpha | Aug 20 | Lisa Park |
| Analytics GA | Sep 10 | Raj Chen |

### Risks & Mitigations

- **Resource contention** between mobile and API tracks — assign dedicated pods
- **Design system adoption** may lag — pair designers with engineers for first sprint
- **Third-party API changes** could disrupt migration — monitor vendor changelog weekly

### Success Metrics

- Mobile DAU reaches **15k** within 30 days of launch
- API error rate stays below **0.5%** post-migration
- Design system used in **80%** of new components
- Dashboard NPS ≥ **45**`,
    tags: [tagProduct, tagEngineering],
    linkedNotes: [
      { id: "N2", title: "Team Meeting Notes — May 12", excerpt: "Sprint review and Q3 planning discussion...", tag: tagMeeting },
      { id: "N3", title: "Design Brief — Mobile v2", excerpt: "Visual direction and component inventory...", tag: tagDesign },
      { id: "N5", title: "API Deprecation Plan", excerpt: "Timeline and consumer communication strategy...", tag: tagEngineering },
    ],
    linkedTasks: [
      { id: "T11", title: "Finalize wireframes", priority: "High" },
      { id: "A5", title: "Write migration guide", priority: "Medium" },
    ],
  },
  {
    id: "N2",
    title: "Team Meeting Notes — May 12",
    date: "May 12, 2026",
    tag: tagMeeting,
    excerpt: "Sprint review and Q3 planning discussion...",
    body: `## Team Meeting — May 12

### Attendees

Alex, Sara, Jake, Lisa, Raj

### Sprint Review

- **Completed**: Auth flow, footer component, CI pipeline setup
- **In progress**: Responsive nav, contact page, API rate limiting
- **Blocked**: Design tokens — waiting on brand team approval

### Q3 Planning

- Discussed roadmap priorities (see Q3 Product Roadmap)
- Agreed on pod structure: Mobile pod + Platform pod
- Next sync: May 19

### Action Items

- **Alex**: Share finalized roadmap by Friday
- **Sara**: Break down mobile epics into stories
- **Jake**: Draft API migration timeline`,
    tags: [tagMeeting, tagProduct],
    linkedNotes: [
      { id: "N1", title: "Q3 Product Roadmap", excerpt: "Key priorities and milestones for the upcoming quarter...", tag: tagProduct },
    ],
    linkedTasks: [
      { id: "T4", title: "Share roadmap with stakeholders", priority: "High" },
    ],
  },
  {
    id: "N3",
    title: "Design Brief — Mobile v2",
    date: "May 10, 2026",
    tag: tagDesign,
    excerpt: "Visual direction and component inventory...",
    body: `## Design Brief — Mobile App v2

### Visual Direction

The new design language emphasizes **clarity** and **speed**. Key changes:

- Simplified navigation with bottom tab bar
- Card-based content layout for scanability
- Dark mode as a first-class citizen

### Component Inventory

We identified **24 components** that need redesign:
- Navigation bar, tab bar, search field
- Card variants (project, task, notification)
- Form inputs and action sheets

### Typography

Switching from custom sans-serif to **Inter** for better readability at small sizes.

### Color Palette

- Primary: Teal (#01696f)
- Neutral: Warm grays with teal undertone
- Accent: Amber for warnings, emerald for success`,
    tags: [tagDesign, tagProduct],
    linkedNotes: [
      { id: "N1", title: "Q3 Product Roadmap", excerpt: "Key priorities and milestones for the upcoming quarter...", tag: tagProduct },
      { id: "N4", title: "User Research Findings", excerpt: "Key insights from usability testing sessions...", tag: tagResearch },
    ],
    linkedTasks: [
      { id: "T4", title: "Redesign navigation components", priority: "High" },
      { id: "D1", title: "Update color tokens in Figma", priority: "Medium" },
    ],
  },
  {
    id: "N4",
    title: "User Research Findings",
    date: "May 7, 2026",
    tag: tagResearch,
    excerpt: "Key insights from usability testing sessions...",
    body: `## User Research Findings

### Methodology

Conducted **8 moderated usability sessions** with existing customers. Focused on navigation, task management, and reporting workflows.

### Key Insights

1. **Navigation confusion**: 6/8 participants struggled to find projects from the sidebar
2. **Task overload**: Users want priority-based filtering, not just lists
3. **Mobile gap**: 75% of users check tasks on mobile at least once daily
4. **Reporting friction**: Manual exports are the #1 pain point for team leads

### Recommendations

- Simplify IA with fewer sidebar categories
- Add smart filters and saved views for tasks
- Prioritize mobile responsive and PWA features
- Build self-serve analytics dashboard`,
    tags: [tagResearch, tagProduct],
    linkedNotes: [
      { id: "N3", title: "Design Brief — Mobile v2", excerpt: "Visual direction and component inventory...", tag: tagDesign },
    ],
    linkedTasks: [
      { id: "T3", title: "Create filter prototype", priority: "Medium" },
    ],
  },
  {
    id: "N5",
    title: "API Deprecation Plan",
    date: "May 5, 2026",
    tag: tagEngineering,
    excerpt: "Timeline and consumer communication strategy...",
    body: `## API Deprecation Plan

### Timeline

- **Jun 1**: Announce v3 availability and v2 deprecation schedule
- **Jul 1**: v3 reaches feature parity with v2
- **Aug 1**: v2 endpoints return deprecation headers
- **Sep 15**: v2 endpoints removed

### Communication Plan

1. Email all API consumers with migration guide
2. Add deprecation banners in developer portal
3. Host office hours for migration support

### Breaking Changes

- Auth flow moves from session-based to JWT
- Pagination changes from offset to cursor-based
- Response envelope structure updated

### Migration Guide

Draft in progress — target delivery by **Jun 1**.`,
    tags: [tagEngineering],
    linkedNotes: [
      { id: "N1", title: "Q3 Product Roadmap", excerpt: "Key priorities and milestones for the upcoming quarter...", tag: tagProduct },
      { id: "N2", title: "Team Meeting Notes — May 12", excerpt: "Sprint review and Q3 planning discussion...", tag: tagMeeting },
    ],
    linkedTasks: [
      { id: "A5", title: "Write migration guide", priority: "High" },
      { id: "A4", title: "Set up deprecation headers", priority: "Low" },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Priority badge — no border, just soft fill (matches dashboard/kanban) */
function priorityBadgeStyle(priority: "High" | "Medium" | "Low") {
  switch (priority) {
    case "High":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    case "Medium":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    case "Low":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
  }
}

// ---------------------------------------------------------------------------
// Notes View
// ---------------------------------------------------------------------------

const NOTE_TAG_OPTIONS = ["Product", "Design", "Engineering", "Meeting", "Research"]

const noteTagMap: Record<string, NoteTag> = {
  Product: tagProduct,
  Design: tagDesign,
  Engineering: tagEngineering,
  Meeting: tagMeeting,
  Research: tagResearch,
}

export function NotesView() {
  const storeNoteId = useNavStore((s) => s.selectedNoteId)
  const setSelectedNoteId = useNavStore((s) => s.setSelectedNoteId)
  const { openDrawer } = useDrawer()
  const [notes, setNotes] = React.useState<Note[]>(mockNotes)
  const [selectedId, setSelectedIdLocal] = React.useState("N1")
  const importFileRef = React.useRef<HTMLInputElement>(null)
  const [showCreateForm, setShowCreateForm] = React.useState(false)

  const createForm = useForm<NoteFormValues>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      title: "",
      tags: [],
      body: "",
    },
  })

  // Sync from nav store (e.g. when navigating from Graph View)
  React.useEffect(() => {
    if (storeNoteId) {
      setSelectedIdLocal(storeNoteId)
      setSelectedNoteId(null) // consume it
    }
  }, [storeNoteId, setSelectedNoteId])

  const setSelectedId = (id: string) => {
    setSelectedIdLocal(id)
  }

  const selected = notes.find((n) => n.id === selectedId) ?? notes[0]

  // --- Export Note as .md ---
  const handleExportNote = () => {
    if (!selected) return
    const blob = new Blob([selected.body], { type: "text/markdown;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    // Sanitize title for filename
    const safeName = selected.title.replace(/[^a-zA-Z0-9\s\-]/g, "").replace(/\s+/g, "-").toLowerCase()
    link.download = `${safeName}.md`
    link.click()
    URL.revokeObjectURL(url)
    toast.success("Note exported", {
      icon: <CheckCircle2 className="size-4 text-emerald-500" />,
      description: `${selected.title}.md saved`,
    })
  }

  // --- Import Note from .md ---
  const handleImportClick = () => {
    importFileRef.current?.click()
  }

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (!content || !content.trim()) {
        toast.error("Empty file — nothing to import")
        return
      }

      // Use filename (without .md extension) as title
      const rawName = file.name.replace(/\.md$/i, "")
      const title = rawName || "Imported Note"

      // Generate excerpt from first non-empty, non-heading line
      const lines = content.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#") && !l.startsWith("---") && !l.startsWith("|"))
      const excerpt = lines[0]?.slice(0, 80) + (lines[0]?.length > 80 ? "..." : "") || "Imported from file"

      // Default tag: Product
      const newNote: Note = {
        id: `import-${Date.now()}`,
        title,
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        tag: tagProduct,
        excerpt,
        body: content,
        tags: [tagProduct],
        linkedNotes: [],
        linkedTasks: [],
      }

      setNotes((prev) => [...prev, newNote])
      setSelectedIdLocal(newNote.id)

      toast.success("Note imported", {
        icon: <CheckCircle2 className="size-4 text-emerald-500" />,
        description: `"${title}" added to your notes`,
      })
    }
    reader.onerror = () => {
      toast.error("Failed to read file")
    }
    reader.readAsText(file)

    // Reset input
    e.target.value = ""
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Notes{" "}
            <span className="text-sm font-normal text-muted-foreground">· {notes.length}</span>
          </h2>
          <p className="text-sm text-muted-foreground">Your workspace notes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleExportNote} disabled={!selected}>
            <Download className="size-3.5" />
            Export Note
          </Button>
          <Button variant="outline" size="sm" className="gap-2 h-8" onClick={handleImportClick}>
            <Upload className="size-3.5" />
            Import Note
          </Button>
          <Button className="gap-2 h-8" size="sm" onClick={() => setShowCreateForm(true)}>
            <Plus className="size-4" />
            New Note
          </Button>
          {/* Hidden file input for .md import */}
          <input
            ref={importFileRef}
            type="file"
            accept=".md,.markdown,.txt"
            className="hidden"
            onChange={handleImportFile}
          />
        </div>
      </div>

      {/* Two-panel resizable layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="min-h-0 flex-1"
      >
        {/* ── Left panel: Note list ── */}
        <ResizablePanel
          defaultSize={30}
          minSize={15}
          maxSize={40}
          className="!flex !flex-col !overflow-hidden"
        >
        <Card className="flex flex-col overflow-hidden h-full">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* Inline Create Note Form */}
              {showCreateForm ? (
              <div className="overflow-hidden transition-all duration-300 ease-in-out">
                <Form {...createForm}>
                  <form
                    onSubmit={createForm.handleSubmit((values) => {
                      const primaryTag = noteTagMap[values.tags[0]] ?? tagProduct
                      const allTags = values.tags.map((t) => noteTagMap[t]).filter(Boolean) as NoteTag[]
                      const newNote: Note = {
                        id: `N${Date.now()}`,
                        title: values.title,
                        date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                        tag: primaryTag,
                        excerpt: values.body ? values.body.slice(0, 80) + (values.body.length > 80 ? "..." : "") : "No content yet",
                        body: values.body || "",
                        tags: allTags.length > 0 ? allTags : [tagProduct],
                        linkedNotes: [],
                        linkedTasks: [],
                      }
                      setNotes((prev) => [newNote, ...prev])
                      setSelectedIdLocal(newNote.id)
                      toast.success("Note created ✓")
                      createForm.reset()
                      setShowCreateForm(false)
                    })}
                    className="space-y-3 rounded-lg border bg-card p-3 mb-2"
                  >
                    <FormField
                      control={createForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Title</FormLabel>
                          <FormControl><Input placeholder="Note title..." className="h-8 text-sm" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="tags"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Tags</FormLabel>
                          <div className="flex flex-wrap gap-1.5">
                            {NOTE_TAG_OPTIONS.map((tag) => {
                              const isSelected = field.value?.includes(tag) ?? false
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    const current = field.value ?? []
                                    field.onChange(
                                      isSelected
                                        ? current.filter((t: string) => t !== tag)
                                        : [...current, tag]
                                    )
                                  }}
                                  className={cn(
                                    "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors border",
                                    isSelected
                                      ? "bg-primary/10 text-primary border-primary/30"
                                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
                                  )}
                                >
                                  {tag}
                                </button>
                              )
                            })}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="body"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs">Body</FormLabel>
                          <FormControl><Textarea placeholder="Note content (optional)..." className="resize-none text-sm" rows={3} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={!createForm.formState.isValid}
                      >
                        Create
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          createForm.reset()
                          setShowCreateForm(false)
                        }}
                      >
                        <X className="size-3 mr-1" />
                        Cancel
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
              ) : null}
              {notes.map((note) => {
                const isActive = note.id === selectedId
                return (
                  <button
                    key={note.id}
                    onClick={() => setSelectedId(note.id)}
                    className={`w-full text-left rounded-lg p-3 border-l-2 transition-colors ${
                      isActive
                        ? `bg-primary/10 border border-primary/20 ${note.tag.accent}`
                        : "border-transparent hover:bg-muted/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className={`text-sm font-medium leading-tight truncate ${isActive ? "text-primary" : ""}`}>
                        {note.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{note.excerpt}</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none ${note.tag.color}`}>
                        {note.tag.label}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Calendar className="size-3" />
                        {note.date}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
        </Card>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── Right panel: Selected note ── */}
        <ResizablePanel
          defaultSize={70}
          minSize={40}
          className="!flex !flex-col !overflow-hidden"
        >
        <Card className={`flex flex-col overflow-hidden border-t-2 h-full ${selected.tag.accent}`}>
          {selected ? (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Note header */}
              <div>
                <h3 className="text-xl font-semibold tracking-tight mb-2">{selected.title}</h3>
                <div className="flex items-center flex-wrap gap-2 mb-3">
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Calendar className="size-3.5" />
                    {selected.date}
                  </span>
                  {selected.tags.map((tag) => (
                    <Badge key={tag.label} variant="secondary" className="text-[11px]">
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="border-t" />

              {/* Markdown body */}
              <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-relaxed prose-li:leading-relaxed prose-strong:text-foreground prose-table:text-sm prose-th:text-left prose-th:font-medium prose-th:py-1 prose-th:pr-4 prose-td:py-1 prose-td:pr-4 prose-th:border-b prose-td:border-b prose-border-border">
                <ReactMarkdown>{selected.body}</ReactMarkdown>
              </article>

              <div className="border-t" />

              {/* Linked Notes */}
              {selected.linkedNotes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Link2 className="size-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Linked Notes</h4>
                    <Badge variant="secondary" className="text-[10px]">{selected.linkedNotes.length}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selected.linkedNotes.map((linked) => (
                      <button
                        key={linked.id}
                        onClick={() => openDrawer("note", linked.id)}
                        className="text-left rounded-lg border bg-muted/30 p-3 transition-colors hover:bg-muted/60 hover:border-primary/20"
                      >
                        <p className="text-sm font-medium leading-tight mb-1">{linked.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">{linked.excerpt}</p>
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium leading-none ${linked.tag.color}`}>
                          {linked.tag.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Tasks */}
              {selected.linkedTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckSquare className="size-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Linked Tasks</h4>
                    <Badge variant="secondary" className="text-[10px]">{selected.linkedTasks.length}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selected.linkedTasks.map((task, i) => (
                      <div key={i} className="inline-flex items-center gap-1.5">
                        <EntityChip type="task" variant="subtle" className="text-xs" entityId={task.id}>
                          {task.title}
                        </EntityChip>
                        <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold leading-none ${priorityBadgeStyle(task.priority)}`}>
                          {task.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <ScrollBar orientation="vertical" />
          </ScrollArea>
          ) : (
            <div className="flex flex-1 items-center justify-center p-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <Notebook className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Select a note to start reading</p>
              </div>
            </div>
          )}
        </Card>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
