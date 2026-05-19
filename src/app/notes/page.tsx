"use client";
import { useState, useMemo, Suspense, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Search, Hash, Link2, Trash2, CheckSquare, Pencil, FileText, ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { useStore } from "@/lib/store";
import { Chip } from "@/components/lovable/page";
import { MarkdownEditor } from "@/components/notes/markdown-editor";

// Pull the first H1 line out as the note title, treat the rest as the body.
// Falls back gracefully when the user clears the heading.
function parseTitleAndBody(md: string): { title: string; body: string } {
  const lines = md.split("\n");
  let titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (titleIndex === -1) {
    // No H1: first non-empty line becomes the title.
    titleIndex = lines.findIndex((line) => line.trim().length > 0);
    if (titleIndex === -1) return { title: "Untitled", body: "" };
    const title = lines[titleIndex].trim() || "Untitled";
    const body = lines.slice(titleIndex + 1).join("\n").replace(/^\n+/, "");
    return { title, body };
  }
  const title = lines[titleIndex].replace(/^#\s+/, "").trim() || "Untitled";
  const body = lines.slice(titleIndex + 1).join("\n").replace(/^\n+/, "");
  return { title, body };
}

function highlightText(text: string, query: string): ReactNode {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return text;
  const lower = text.toLowerCase();
  if (!lower.includes(trimmed)) return text;

  const parts: ReactNode[] = [];
  let index = 0;
  while (index < text.length) {
    const next = lower.indexOf(trimmed, index);
    if (next === -1) {
      parts.push(text.slice(index));
      break;
    }
    if (next > index) parts.push(text.slice(index, next));
    parts.push(
      <span key={`h-${next}-${parts.length}`} className="rounded-sm bg-primary/10 px-0.5 text-foreground">
        {text.slice(next, next + trimmed.length)}
      </span>
    );
    index = next + trimmed.length;
  }
  return parts;
}

function extractTaskRefs(text: string): string[] {
  const matches = text.match(/\bFB-\d+\b/g) ?? [];
  return Array.from(new Set(matches));
}

function NotesInner() {
  const notes = useStore((s) => s.notes);
  const workItems = useStore((s) => s.workItems);
  const activeProjectId = useStore((s) => s.settings.activeProjectId);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const removeNote = useStore((s) => s.removeNote);
  const addWorkItem = useStore((s) => s.addWorkItem);
  const updateWorkItem = useStore((s) => s.updateWorkItem);

  const params = useSearchParams();
  const router = useRouter();
  const idFromUrl = params.get("id");

  const [selId, setSelId] = useState<string | null>(idFromUrl ?? notes[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [linkedOpen, setLinkedOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectNote = (id: string) => {
    setSelId(id);
    router.replace(`/notes?id=${id}`, { scroll: false });
  };

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return notes;
    return notes.filter((n) => {
      const haystack = `${n.title}\n${n.excerpt}\n${n.tag}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [notes, normalizedQuery]);
  const selectedId = idFromUrl && notes.some((n) => n.id === idFromUrl) ? idFromUrl : selId;
  const sel = notes.find((n) => n.id === selectedId) ?? filtered[0] ?? null;
  const selectedTask = workItems.find((w) => w.id === selectedTaskId) ?? null;

  const linkedTasks = useMemo(() => {
    if (!sel) return [];
    const explicit = workItems.filter((w) => (w.noteIds ?? []).includes(sel.id));
    const refs = new Set(extractTaskRefs(`${sel.title}\n${sel.excerpt}`));
    const byRef = workItems.filter((w) => refs.has(w.id));
    return [...explicit, ...byRef.filter((item) => !explicit.some((existing) => existing.id === item.id))];
  }, [workItems, sel]);

  const quickCreate = () => {
    if (!draft.trim()) return;
    const id = addNote({ title: draft.trim(), tag: "Capture", excerpt: "" });
    selectNote(id);
    toast.success("Note captured");
    setDraft("");
  };

  const extractCheckboxes = () => {
    if (!sel) return;
    const lines = sel.excerpt.split("\n");
    let createdCount = 0;
    const next = lines.map((line) => {
      const match = line.match(/^(\s*)- \[ \] (?!.*\bFB-\d+\b)(.+)$/);
      if (!match) return line;
      const title = match[2].trim();
      if (!title) return line;
      const id = addWorkItem({ title, project: activeProjectId ?? "core" });
      const created = workItems.find((w) => w.id === id);
      const existing = created?.noteIds ?? [];
      updateWorkItem(id, { noteIds: [...existing, sel.id] });
      createdCount += 1;
      return `${match[1]}- [x] ${title} (${id})`;
    });
    if (createdCount === 0) {
      toast(`No unchecked checkboxes found. Write "- [ ] something" first.`);
      return;
    }
    updateNote(sel.id, { excerpt: next.join("\n") });
    toast.success(`Created ${createdCount} task${createdCount === 1 ? "" : "s"} from checkboxes`);
  };

  return (
    <AppShell title={<span className="font-medium">Notes</span>}>
      <div className="flex h-full bg-background">
        {/* ── Notes list (left panel, floated as a card) ── */}
        <aside className="ml-4 mt-4 mb-4 flex w-72 shrink-0 flex-col rounded-md border bg-card">
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              placeholder="Search notes…"
            />
            <button
              onClick={() => { const id = addNote({ title: "Untitled", tag: "Note", excerpt: "" }); selectNote(id); }}
              title="New note"
              className="lov-icon-btn h-6 w-6"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="border-b border-border/40 p-2">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Capture</label>
            <div className="flex items-center gap-1">
              <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") quickCreate(); }}
              placeholder="Quick capture a note."
              className="h-8 min-w-0 flex-1 rounded border bg-background px-2 text-[13px] outline-none focus:border-ring"
              />
              <button
                onClick={quickCreate}
                disabled={!draft.trim()}
                className="lov-btn lov-btn-primary h-8 px-2 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {notes.length === 0 ? (
              <div className="px-3 py-10 text-center text-[12px] text-muted-foreground">
                No notes yet. Capture one above.
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">
                No matches. Try another term or create a note.
              </div>
            ) : (
              filtered.map((n) => (
                <button
                  key={n.id}
                  onClick={() => selectNote(n.id)}
                  className={`block w-full border-b border-border/40 px-3 py-3 text-left transition-colors hover:bg-[var(--color-hover)]/40 ${sel?.id === n.id ? "border-l-2 border-l-primary bg-[var(--color-hover)]/60 pl-[10px]" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {highlightText(n.title, normalizedQuery)}
                    </span>
                    <span className="shrink-0 pl-2 text-[11px] text-muted-foreground">{n.updated}</span>
                  </div>
                  {n.excerpt && (
                    <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
                      {highlightText(n.excerpt, normalizedQuery)}
                    </p>
                  )}
                  <div className="mt-1.5"><Chip>{highlightText(n.tag, normalizedQuery)}</Chip></div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Editor (right panel) ── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {sel ? (
            <>
              {/* Header bar: tag + linked tasks (left), edited time + grouped actions (right) */}
              <div className="flex h-12 items-center gap-3 border-b border-border/40 px-5 text-[12px]">
                <span className="rounded border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Editing
                </span>
                {/* Tag: chip with edit affordance */}
                <label className="group flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 hover:border-ring focus-within:border-ring">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <input
                    value={sel.tag}
                    onChange={(e) => updateNote(sel.id, { tag: e.target.value })}
                    className="w-24 bg-transparent text-[12px] font-medium text-foreground outline-none"
                    aria-label="Tag"
                  />
                  <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
                </label>

                {/* Linked tasks: clickable */}
                <div className="relative">
                  <button
                    onClick={() => setLinkedOpen((v) => !v)}
                    className={`lov-btn lov-btn-ghost h-7 px-2 ${linkedTasks.length > 0 ? "text-foreground" : ""}`}
                  >
                    <Link2 className="h-3 w-3" />
                    {linkedTasks.length} linked task{linkedTasks.length === 1 ? "" : "s"}
                    {linkedTasks.length > 0 && <ChevronRight className={`h-3 w-3 transition-transform ${linkedOpen ? "rotate-90" : ""}`} />}
                  </button>
                  {linkedOpen && linkedTasks.length > 0 && (
                    <>
                      <div className="fixed inset-0 z-[70]" onMouseDown={() => setLinkedOpen(false)} />
                      <div className="absolute left-0 top-9 z-[80] max-h-72 w-72 overflow-y-auto rounded-md border bg-popover shadow-lg">
                        {linkedTasks.map((task) => (
                          <button
                            key={task.id}
                            onClick={() => { setSelectedTaskId(task.id); setLinkedOpen(false); }}
                            className="lov-menu-item border-b border-border/40 px-3 py-2 text-[13px] last:border-b-0"
                          >
                            <FileText className="h-3 w-3 text-muted-foreground" />
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{task.id}</span>
                            <span className="min-w-0 flex-1 truncate font-medium text-foreground">{task.title}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <span className="ml-auto text-[11px] text-muted-foreground">Edited {sel.updated}</span>

                {/* Grouped action buttons */}
                <div className="flex items-center gap-px rounded-md border bg-card p-0.5">
                  <button
                    onClick={extractCheckboxes}
                    title="Create a task for every unchecked checkbox line"
                    className="lov-btn lov-btn-ghost h-6 px-2 text-[11px]"
                  >
                    <CheckSquare className="h-3 w-3" /> Extract tasks
                  </button>
                  <span className="h-3 w-px bg-border" />
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete "${sel.title}"?`)) {
                        removeNote(sel.id);
                        const remaining = notes.filter((n) => n.id !== sel.id);
                        if (remaining[0]) selectNote(remaining[0].id);
                      }
                    }}
                    title="Delete note"
                    className="lov-btn lov-btn-danger h-6 px-2 text-[11px]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Editor body: title is the first H1, unified undo history */}
              <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-8 py-6">
                <MarkdownEditor
                  key={sel.id}
                  markdown={`# ${sel.title}\n\n${sel.excerpt}`}
                  onChange={(md) => {
                    const { title, body } = parseTitleAndBody(md);
                    updateNote(sel.id, { title, excerpt: body });
                  }}
                  placeholder="# Untitled note"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">No note selected. Create one.</div>
          )}
        </div>

        <TaskDrawer item={selectedTask} onClose={() => setSelectedTaskId(null)} />
      </div>
    </AppShell>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={null}>
      <NotesInner />
    </Suspense>
  );
}
