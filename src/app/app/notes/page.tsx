"use client";
import { useState, useMemo, Suspense, useEffect, useRef, type ReactNode } from "react";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, MagnifyingGlass as Search, Hash, Link as Link2, Trash as Trash2, CheckSquare, Pencil, FileText, CaretRight as ChevronRight,
} from "@phosphor-icons/react";
import { AppShell } from "@/components/lovable/shell";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { Chip } from "@/components/lovable/page";
import { MarkdownEditor } from "@/components/notes/markdown-editor";
import type { WorkItem } from "@/lib/mock-data";
import { findUncheckedNoteTasks, splitNoteMarkdown } from "@/lib/note-markdown";
import { apiFetch, getServerSession } from "@/lib/server-session-client";
import { type ApiProject, type ApiWorkItem, toUiProject, toUiWorkItem } from "@/lib/server-ui-mappers";
import { applyWorkItemDependencyRelations, type WorkItemDependencyRelation } from "@/lib/work-item-dependencies";
import { getDemoFixtures } from "@/lib/demo-data";
import { blockReadOnlyMutation, handleDemoReadOnlyResponse } from "@/lib/demo-readonly";

type ApiNote = {
  id: string;
  title: string;
  body: string | null;
  projectId?: string | null;
  tags: unknown;
  createdAt?: string;
  updatedAt: string;
};

type UiNote = {
  id: string;
  title: string;
  tag: string;
  projectId: string | null;
  created: string;
  updated: string;
  excerpt: string;
};

type UiProject = {
  id: string;
  name: string;
};

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

function formatShortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function cleanPreview(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/^-\s+\[[ x]\]\s+/i, "").trim())
    .filter(Boolean)
    .join(" ");
}

function noteTextMentionsTask(text: string, taskId: string) {
  if (!taskId) return false;
  return text.includes(taskId);
}

function noteProjectLabel(note: UiNote, projectById: Map<string, UiProject>) {
  if (!note.projectId) return "No project";
  return projectById.get(note.projectId)?.name ?? "Unknown project";
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
    projectId: note.projectId ?? null,
    created: formatShortDate(note.createdAt),
    updated: formatShortDate(note.updatedAt),
    excerpt: body,
  };
}

function NotesInner() {
  const params = useSearchParams();
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const routePrefix = pathname.startsWith("/demo") ? "/demo" : "/app";
  const isDemoMode = routePrefix === "/demo";
  const demoData = isDemoMode ? getDemoFixtures() : null;
  const idFromUrl = params.get("id");
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout> | undefined>>({});

  const [loading, setLoading] = useState(!isDemoMode);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(isDemoMode ? "demo-workspace" : null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(isDemoMode ? "demo-user" : null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>(() => isDemoMode ? [{ id: "demo-user", name: "Demo User" }] : []);
  const [notes, setNotes] = useState<UiNote[]>(() => demoData ? demoData.apiNotes.map(mapNote) : []);
  const [projects, setProjects] = useState<UiProject[]>(() => demoData
    ? demoData.apiProjects.map((project) => ({ id: project.id, name: project.name }))
    : []);
  const [workItems, setWorkItems] = useState<WorkItem[]>(() => demoData
    ? applyWorkItemDependencyRelations(demoData.apiTasks.map((item) => toUiWorkItem(item, "demo-user")), demoData.demoRelations)
    : []);

  const [selId, setSelId] = useState<string | null>(() => demoData?.apiNotes[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [linkedOpen, setLinkedOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (isDemoMode) return;
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const session = await getServerSession();
        if (!active) return;

        setWorkspaceId(session.workspace.id);
        setCurrentUserId(session.user.id);
        setMembers((session.members ?? []).map((member) => ({ id: member.id, name: member.name })));

        const [notesRes, projectsRes, workItemsRes, relationsRes] = await Promise.all([
          apiFetch(`/api/notes?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/projects?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/work-items?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
          apiFetch(`/api/work-item-relations?workspaceId=${encodeURIComponent(session.workspace.id)}`, { cache: "no-store" }),
        ]);
        if (!notesRes.ok) throw new Error("Failed to load notes");
        if (!projectsRes.ok) throw new Error("Failed to load projects for notes");
        if (!workItemsRes.ok) throw new Error("Failed to load tasks for notes");
        if (!relationsRes.ok) throw new Error("Failed to load task dependencies");

        const notesPayload = (await notesRes.json()) as { notes: ApiNote[] };
        const projectsPayload = (await projectsRes.json()) as { projects: ApiProject[] };
        const workItemsPayload = (await workItemsRes.json()) as { workItems: ApiWorkItem[] };
        const relationsPayload = (await relationsRes.json()) as { relations: WorkItemDependencyRelation[] };
        if (!active) return;

        const mappedNotes = notesPayload.notes.map(mapNote);
        const mappedProjects = projectsPayload.projects.map((project) => {
          const uiProject = toUiProject(project, session.user.id);
          return { id: uiProject.id, name: uiProject.name };
        });
        setNotes(mappedNotes);
        setProjects(mappedProjects);
        setSelId(idFromUrl && mappedNotes.some((n) => n.id === idFromUrl) ? idFromUrl : mappedNotes[0]?.id ?? null);

        const mappedTasks = workItemsPayload.workItems.map((item) => toUiWorkItem(item, session.user.id));
        setWorkItems(applyWorkItemDependencyRelations(mappedTasks, relationsPayload.relations));
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
  }, [isDemoMode]);

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
    router.replace(`${routePrefix}/notes?id=${id}`, { scroll: false });
  };

  const patchNoteNow = async (id: string, patch: { title?: string; body?: string; tags?: string[] }) => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    if (!workspaceId) return;
    const response = await apiFetch(`/api/notes/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify(patch),
    });
    if (!response.ok) {
      if (handleDemoReadOnlyResponse(response)) return;
      setError("Failed to save note");
    }
  };

  const queueSaveNote = (id: string, patch: { title?: string; body?: string; tags?: string[] }) => {
    if (blockReadOnlyMutation(isDemoMode)) return;
    const existing = saveTimers.current[id];
    if (existing) clearTimeout(existing);
    saveTimers.current[id] = setTimeout(() => {
      void patchNoteNow(id, patch);
    }, 350);
  };

  const createNote = async (title: string, tag: string, excerpt: string) => {
    if (blockReadOnlyMutation(isDemoMode)) return null;
    if (!workspaceId) return null;
    const response = await apiFetch("/api/notes", {
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
      if (handleDemoReadOnlyResponse(response)) return null;
      setError("Failed to create note");
      return null;
    }
    const payload = (await response.json()) as { note: ApiNote };
    const next = mapNote(payload.note);
    setNotes((current) => [next, ...current]);
    return next.id;
  };

  const deleteNote = async (id: string) => {
    if (blockReadOnlyMutation(isDemoMode)) return false;
    if (!workspaceId) return false;
    const snapshot = notes;
    setNotes((current) => current.filter((note) => note.id !== id));

    const response = await apiFetch(`/api/notes/${encodeURIComponent(id)}?workspaceId=${encodeURIComponent(workspaceId)}`, {
      method: "DELETE",
    });
    if (!response.ok) {
      setNotes(snapshot);
      if (handleDemoReadOnlyResponse(response)) return false;
      setError("Failed to delete note");
      return false;
    }
    return true;
  };

  const createTaskFromNote = async (title: string, noteId?: string, projectId?: string | null) => {
    if (blockReadOnlyMutation(isDemoMode)) return null;
    if (!workspaceId) return null;
    const response = await apiFetch("/api/work-items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify({
        workspaceId,
        projectId: projectId ?? undefined,
        title,
        status: "BACKLOG",
        priority: "MEDIUM",
        noteIds: noteId ? [noteId] : undefined,
      }),
    });
    if (!response.ok) {
      handleDemoReadOnlyResponse(response);
      return null;
    }
    const payload = (await response.json()) as { workItem: ApiWorkItem };
    const next = toUiWorkItem(payload.workItem, currentUserId);
    setWorkItems((current) => [next, ...current]);
    return next.id;
  };

  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!normalizedQuery) return notes;
    return notes.filter((n) => {
      const haystack = `${n.title}\n${n.excerpt}\n${n.tag}\n${noteProjectLabel(n, projectById)}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [notes, normalizedQuery, projectById]);

  const selectedId = idFromUrl && notes.some((n) => n.id === idFromUrl) ? idFromUrl : selId;
  const sel = notes.find((n) => n.id === selectedId) ?? filtered[0] ?? null;
  const selectedTask = workItems.find((w) => w.id === selectedTaskId) ?? null;
  const linkedTaskCountByNoteId = useMemo(() => {
    const counts = new Map<string, number>();
    notes.forEach((note) => {
      const noteText = `${note.title}\n${note.excerpt}`;
      const count = workItems.filter((item) => (
        (item.noteIds ?? []).includes(note.id) || noteTextMentionsTask(noteText, item.id)
      )).length;
      counts.set(note.id, count);
    });
    return counts;
  }, [notes, workItems]);

  const linkedTasks = useMemo(() => {
    if (!sel) return [];
    const noteText = `${sel.title}\n${sel.excerpt}`;
    return workItems.filter((w) => (w.noteIds ?? []).includes(sel.id) || noteTextMentionsTask(noteText, w.id));
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
    for (const task of findUncheckedNoteTasks(sel.excerpt)) {
      const { lineIndex, indent, title } = task;
      const id = await createTaskFromNote(title, sel.id, sel.projectId);
      if (!id) continue;
      createdCount += 1;
      next[lineIndex] = `${indent}- [x] ${title} (${id})`;
    }

    if (createdCount === 0) {
      toast("No unchecked checkbox lines found. Add a line like - [ ] Task title.");
      return;
    }

    const body = next.join("\n");
    setNotes((current) => current.map((note) => (note.id === sel.id ? { ...note, excerpt: body } : note)));
    await patchNoteNow(sel.id, { body });
    toast.success(`Created ${createdCount} real task${createdCount === 1 ? "" : "s"} from this note`);
  };

  return (
    <AppShell title={<span className="font-medium">Notes</span>}>
      <div className="flex h-full flex-col bg-background md:flex-row">
        <aside className="m-0 flex max-h-[40vh] w-full shrink-0 flex-col rounded-none border-b bg-card md:ml-4 md:mb-4 md:mt-4 md:max-h-none md:w-72 md:rounded-md md:border md:border-b-0">
          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
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
          <div className="border-b border-border/40 p-2">
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Capture</label>
            <div className="flex items-center gap-1">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void quickCreate(); }}
                placeholder="Quick capture a note."
                className="lov-input h-8 min-w-0 flex-1 max-w-none px-2"
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
              <div className="px-4 py-8">
                <div className="flow-empty py-8">
                  <p className="text-[13px] font-medium text-foreground">No notes yet</p>
                  <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">Start with a quick thought, meeting note, or project detail. Project-linked notes will appear with their project when they have one.</p>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-8">
                <div className="flow-empty py-6">
                  <p className="text-[13px] font-medium text-foreground">No notes match this search.</p>
                  <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">Try a different term, or capture a new note above.</p>
                </div>
              </div>
            ) : (
              filtered.map((n) => (
                <button
                  key={n.id}
                  onClick={() => selectNote(n.id)}
                  className={`block w-full border-b border-border/40 px-3 py-3 text-left transition-colors hover:bg-[var(--color-hover)]/40 ${sel?.id === n.id ? "border-l-2 border-l-primary/60 bg-primary/[0.07] pl-[calc(0.75rem-2px)]" : "border-l-2 border-l-transparent pl-[calc(0.75rem-2px)]"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {highlightText(n.title, normalizedQuery)}
                    </span>
                    <span className="shrink-0 pl-2 text-[11px] text-muted-foreground">{n.updated}</span>
                  </div>
                  {n.excerpt && (
                    <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
                      {highlightText(cleanPreview(n.excerpt), normalizedQuery)}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Chip>{highlightText(n.tag, normalizedQuery)}</Chip>
                    <Chip>{highlightText(noteProjectLabel(n, projectById), normalizedQuery)}</Chip>
                    {(linkedTaskCountByNoteId.get(n.id) ?? 0) > 0 && (
                      <Chip>{linkedTaskCountByNoteId.get(n.id)} task{linkedTaskCountByNoteId.get(n.id) === 1 ? "" : "s"}</Chip>
                    )}
                    {n.created && <span className="text-[11px] text-muted-foreground">Created {n.created}</span>}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {error && <div className="mx-5 mt-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</div>}
          {sel ? (
            <>
              <div className="flex min-h-12 flex-wrap items-center gap-2 border-b border-border/40 bg-card/40 px-3 py-2 md:px-5 text-[12px]">
                <span className="rounded border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {isDemoMode ? "Read only" : "Editing"}
                </span>
                <label className="group flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 hover:border-ring focus-within:border-ring">
                  <Hash className="h-3 w-3 text-muted-foreground" />
                  <input
                    readOnly={isDemoMode}
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

                <span className="rounded-md border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
                  Project: <span className="font-medium text-foreground">{noteProjectLabel(sel, projectById)}</span>
                </span>

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

              <div className="mx-auto w-full min-w-0 max-w-full flex-1 overflow-y-auto px-4 py-6 md:max-w-3xl md:px-8">
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card/60 px-3 py-2 text-[12px] text-muted-foreground">
                    <CheckSquare className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium text-foreground">Manual task extraction</span>
                    <span>Unchecked lines become real Tasks linked back to this note.</span>
                  </div>
                <MarkdownEditor
                  readOnly={isDemoMode}
                  key={sel.id}
                  markdown={`# ${sel.title}\n\n${sel.excerpt}`}
                  onChange={(md) => {
                    const { title, body } = splitNoteMarkdown(md);
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
            <div className="flex flex-1 items-center justify-center px-8">
              <div className="flow-empty max-w-md py-10">
                <p className="text-[13px] font-medium text-foreground">No note selected.</p>
                <p className="mt-1 max-w-sm text-[12px] text-muted-foreground">Pick a note from the list, or capture a quick thought to start writing.</p>
              </div>
            </div>
          )}
        </div>

        <TaskDrawer
          readOnly={isDemoMode}
          item={selectedTask}
          onClose={() => setSelectedTaskId(null)}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          membersOverride={members}
          allItems={workItems}
          onItemsReplaced={setWorkItems}
          onSelectItem={setSelectedTaskId}
          onItemPatched={(id, patch) => {
            setWorkItems((current) => current.map((workItem) => (workItem.id === id ? { ...workItem, ...patch } : workItem)));
          }}
          onItemReplaced={(next) => {
            setWorkItems((current) => current.map((workItem) => (workItem.id === next.id ? next : workItem)));
          }}
        />
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
