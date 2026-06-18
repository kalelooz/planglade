"use client";
import { useState, useMemo, Suspense, useEffect, useRef, type ReactNode } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Search, Hash, Link2, Trash2, CheckSquare, Pencil, FileText, ChevronRight,
} from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { Chip } from "@/components/lovable/page";
import { MarkdownEditor } from "@/components/notes/markdown-editor";
import type { WorkItem } from "@/lib/mock-data";
import { getServerSession } from "@/lib/server-session-client";
import { type ApiWorkItem, toUiWorkItem } from "@/lib/server-ui-mappers";

type ApiNote = {
  id: string;
  title: string;
  body: string | null;
  tags: unknown;
  updatedAt: string;
};

type UiNote = {
  id: string;
  title: string;
  tag: string;
  updated: string;
  excerpt: string;
};

function parseTitleAndBody(md: string): { title: string; body: string } {
  const lines = md.split("\n");
  let titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (titleIndex === -1) {
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

function mapTag(value: unknown) {
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "Note";
}

function mapNote(note: ApiNote): UiNote {
  const body = note.body ?? "";
  const firstBodyLine = body
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").trim())
    .find(Boolean);
  const title = note.title.trim() === "Untitled" && firstBodyLine ? firstBodyLine.slice(0, 80) : note.title;
  return {
    id: note.id,
    title,
    tag: mapTag(note.tags),
    updated: new Date(note.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    excerpt: body,
  };
}

function NotesInner() {
  const params = useSearchParams();
  const router = useRouter();
  const idFromUrl = params.get("id");
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<UiNote[]>([]);
  const [workItems, setWorkItems] = useState<WorkItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [selId, setSelId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [linkedOpen, setLinkedOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const session = await getServerSession();
        if (!active) return;

        setWorkspaceId(session.workspace.id);
        setCurrentUserId(session.user.id);
        const [notesRes, workItemsRes] = await Promise.all([
          fetch(`/api/notes?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          fetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);
        if (!notesRes.ok) throw new Error("Failed to load notes");
        if (!workItemsRes.ok) throw new Error("Failed to load tasks for notes");

        const notesPayload = (await notesRes.json()) as { notes: ApiNote[] };
        const workItemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        if (!active) return;

        const mappedNotes = notesPayload.notes.map(mapNote);
        setNotes(mappedNotes);
        setSelId(idFromUrl && mappedNotes.some((n) => n.id === idFromUrl) ? idFromUrl : mappedNotes[0]?.id ?? null);

        const mappedTasks = workItemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id));
        setWorkItems(mappedTasks);
        setActiveProjectId(mappedTasks[0]?.project ?? null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load Notes");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (idFromUrl) {
      if (notes.some((note) => note.id === idFromUrl)) {
        setSelId(idFromUrl);
      }
      return;
    }

    if (!selId && notes.length > 0) {
      setSelId(notes[0].id);
    }
  }, [idFromUrl, notes, selId]);

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
    };
  }, []);

  const selectNote = (id: string) => {
    setSelId(id);
    router.replace(`/notes?id=${id}`, { scroll: false });
  };

  const patchNoteNow = async (id: string, patch: { title?: string; body?: string; tags?: string[] }) => {
    if (!workspaceId) return;
    const response = await fetch(`/api/notes/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      setError("Failed to save note");
    }
  };

  const queueSaveNote = (id: string, patch: { title?: string; body?: string; tags?: string[] }) => {
    const existing = saveTimers.current[id];
    if (existing) clearTimeout(existing);
    saveTimers.current[id] = setTimeout(() => {
      void patchNoteNow(id, patch);
    }, 350);
  };

  const createNote = async (title: string, tag: string, excerpt: string) => {
    if (!workspaceId) return null;
    const response = await fetch("/api/notes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify({
        workspaceId,
        title,
        body: excerpt,
        visibility: "PRIVATE",
        tags: [tag],
      }),
    });
    if (!response.ok) {
      setError("Failed to create note");
      return null;
    }
    const payload = (await response.json()) as { note: ApiNote };
    const next = mapNote(payload.note);
    setNotes((current) => [next, ...current]);
    return next.id;
  };

  const deleteNote = async (id: string) => {
    if (!workspaceId) return false;
    const snapshot = notes;
    setNotes((current) => current.filter((note) => note.id !== id));

    const response = await fetch(`/api/notes/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setNotes(snapshot);
      setError("Failed to delete note");
      return false;
    }
    return true;
  };

  const createTaskFromNote = async (title: string, noteId?: string) => {
    if (!workspaceId) return null;
    const response = await fetch("/api/work-items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify({
        workspaceId,
        projectId: activeProjectId ?? undefined,
        title,
        status: "BACKLOG",
        priority: "MEDIUM",
        noteIds: noteId ? [noteId] : undefined,
      }),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { workItem: ApiWorkItem };
    const next = toUiWorkItem(payload.workItem, currentUserId);
    setWorkItems((current) => [next, ...current]);
    return next.id;
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
  const linkedTasks = useMemo(() => {
    if (!sel) return [];
    const refs = new Set(extractTaskRefs(`${sel.title}\n${sel.excerpt}`));
    return workItems.filter((w) => refs.has(w.id));
  }, [workItems, sel]);

  const quickCreate = async () => {
    if (!draft.trim()) return;
    const id = await createNote(draft.trim(), "Capture", "");
    if (!id) return;
    selectNote(id);
    toast.success("Note captured");
    setDraft("");
  };

  const extractCheckboxes = async () => {
    if (!sel) return;
    const lines = sel.excerpt.split("\n");
    let createdCount = 0;
    const next = [...lines];
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const match = line.match(/^(\s*)- \[ \] (?!.*\bFB-\d+\b)(.+)$/);
      if (!match) continue;
      const title = match[2].trim();
      if (!title) continue;
      const id = await createTaskFromNote(title, sel.id);
      if (!id) continue;
      createdCount += 1;
      next[i] = `${match[1]}- [x] ${title} (${id})`;
    }

    if (createdCount === 0) {
      toast("No unchecked checkboxes found. Write \"- [ ] something\" first.");
      return;
    }

    const body = next.join("\n");
    setNotes((current) => current.map((note) => (note.id === sel.id ? { ...note, excerpt: body } : note)));
    await patchNoteNow(sel.id, { body });
    toast.success(`Created ${createdCount} task${createdCount === 1 ? "" : "s"} from checkboxes`);
  };

  return (
    <AppShell title={<span className="font-medium">Notes</span>}>
      <div className="flex h-full flex-col gap-4 overflow-y-auto bg-[#fafafa] p-4 md:flex-row md:gap-6 md:p-6 lg:p-8">
        <aside className="flex max-h-[42vh] w-full shrink-0 flex-col overflow-hidden rounded-lg border border-zinc-200/80 bg-white md:max-h-none md:w-72">
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2.5">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              placeholder="Search notes."
            />
            <button
              onClick={() => {
                void (async () => {
                  const id = await createNote("Untitled", "Note", "");
                  if (id) selectNote(id);
                })();
              }}
              title="New note"
              className="lov-icon-btn h-6 w-6"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="border-b border-zinc-100 p-2.5">
            <label className="mb-1 block text-[9px] font-bold uppercase tracking-wider text-zinc-400">Quick note</label>
            <div className="flex items-center gap-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void quickCreate(); }}
                placeholder="Quick capture a note."
                className="h-8 min-w-0 flex-1 rounded border bg-background px-2 text-[13px] outline-none focus:border-ring"
              />
              <button
                onClick={() => { void quickCreate(); }}
                disabled={!draft.trim()}
                className="lov-btn lov-btn-primary h-8 px-2 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-10 text-center text-[12px] text-muted-foreground">Loading notes...</div>
            ) : notes.length === 0 ? (
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
                  className={`block w-full border-b border-zinc-100 px-3 py-2.5 text-left transition-colors hover:bg-zinc-50 ${sel?.id === n.id ? "border-l-2 border-l-zinc-900 bg-zinc-100/80 pl-[10px]" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {highlightText(n.title, normalizedQuery)}
                    </span>
                    <span className="shrink-0 pl-2 font-mono text-[10px] text-zinc-400">{n.updated}</span>
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

        <div className="flex min-h-[520px] min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200/80 bg-white">
          {error && <div className="mx-5 mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
          {sel ? (
            <>
              <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-zinc-100 px-4 py-2 text-xs">
                <span className="rounded border border-zinc-200/80 bg-zinc-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">
                  Editing
                </span>
                <label className="group flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 hover:border-ring focus-within:border-ring">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <input
                    value={sel.tag}
                    onChange={(e) => {
                      const tag = e.target.value;
                      setNotes((current) => current.map((note) => (note.id === sel.id ? { ...note, tag } : note)));
                      queueSaveNote(sel.id, { tags: tag.trim() ? [tag.trim()] : [] });
                    }}
                    className="w-24 bg-transparent text-[12px] font-medium text-foreground outline-none"
                    aria-label="Tag"
                  />
                  <Pencil className="h-2.5 w-2.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-60" />
                </label>

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
                            onClick={() => setLinkedOpen(false)}
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

                <span className="ml-auto font-mono text-[10px] text-zinc-400">Edited {sel.updated}</span>

                <div className="flex items-center gap-px rounded-md border bg-card p-0.5">
                  <button
                    onClick={() => { void extractCheckboxes(); }}
                    title="Create a task for every unchecked checkbox line"
                    className="lov-btn lov-btn-ghost h-6 px-2 text-[11px]"
                  >
                    <CheckSquare className="h-3 w-3" /> Extract tasks
                  </button>
                  <span className="h-3 w-px bg-border" />
                  <button
                    onClick={() => {
                      void (async () => {
                        if (!window.confirm(`Delete "${sel.title}"?`)) return;
                        const deleted = await deleteNote(sel.id);
                        if (!deleted) return;
                        const remaining = notes.filter((n) => n.id !== sel.id);
                        if (remaining[0]) selectNote(remaining[0].id);
                      })();
                    }}
                    title="Delete note"
                    className="lov-btn lov-btn-danger h-6 px-2 text-[11px]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto p-5 md:p-8">
                <MarkdownEditor
                  key={sel.id}
                  markdown={`# ${sel.title}\n\n${sel.excerpt}`}
                  onChange={(md) => {
                    const { title, body } = parseTitleAndBody(md);
                    setNotes((current) => current.map((note) => (
                      note.id === sel.id
                        ? { ...note, title, excerpt: body, updated: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }) }
                        : note
                    )));
                    queueSaveNote(sel.id, { title, body });
                  }}
                  placeholder="# Untitled note"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">No note selected. Create one.</div>
          )}
        </div>

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
