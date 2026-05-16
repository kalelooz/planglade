"use client";
import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Plus, Search, Hash, Link2, Trash2, Eye, Pencil } from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { useStore } from "@/lib/store";
import { Chip } from "@/components/lovable/page";

function NotesInner() {
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);
  const removeNote = useStore((s) => s.removeNote);

  const params = useSearchParams();
  const router = useRouter();
  const idFromUrl = params.get("id");

  const [selId, setSelId] = useState<string | null>(idFromUrl ?? notes[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  // If URL id changes (e.g. arrived via Home note click), reflect it. Cycle is
  // broken by selectNote() below which writes to the URL as the single source.
  useEffect(() => {
    if (idFromUrl && idFromUrl !== selId && notes.some((n) => n.id === idFromUrl)) {
      setSelId(idFromUrl);
    }
  }, [idFromUrl, notes, selId]);

  const selectNote = (id: string) => {
    setSelId(id);
    router.replace(`/notes?id=${id}`, { scroll: false });
  };

  const filtered = useMemo(() => notes.filter((n) => n.title.toLowerCase().includes(query.toLowerCase()) || n.excerpt.toLowerCase().includes(query.toLowerCase())), [notes, query]);
  const sel = notes.find((n) => n.id === selId) ?? filtered[0] ?? null;

  const quickCreate = () => {
    if (!draft.trim()) return;
    const id = addNote({ title: draft.trim(), tag: "Capture", excerpt: "Captured from Notes." });
    selectNote(id);
    setDraft("");
  };

  return (
    <AppShell title={<span className="font-medium">Notes</span>}>
      <div className="flex h-full">
        <aside className="flex w-80 shrink-0 flex-col border-r bg-sidebar/40">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-3 w-3 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              placeholder="Search notes…"
            />
            <button onClick={() => { const id = addNote({ title: "Untitled" }); selectNote(id); }} className="rounded p-1 hover:bg-[var(--color-hover)]"><Plus className="h-3.5 w-3.5" /></button>
          </div>
          <div className="border-b p-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") quickCreate(); }}
              placeholder="Quick capture a note…"
              className="h-8 w-full rounded border bg-background px-2 text-[13px] outline-none focus:border-ring"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((n) => (
              <button key={n.id} onClick={() => selectNote(n.id)}
                className={`block w-full border-b px-3 py-3 text-left hover:bg-[var(--color-hover)]/60 ${sel?.id === n.id ? "bg-[var(--color-hover)]" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="truncate text-[13px] font-medium">{n.title}</span>
                  <span className="text-[11px] text-muted-foreground">{n.updated}</span>
                </div>
                {n.excerpt && <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{n.excerpt}</p>}
                <div className="mt-1.5"><Chip>{n.tag}</Chip></div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-8 text-center text-[12px] text-muted-foreground">No matches.</div>
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {sel ? (
            <>
              <div className="flex h-10 items-center gap-3 border-b px-5 text-[12px] text-muted-foreground">
                <Hash className="h-3 w-3" />
                <input
                  value={sel.tag}
                  onChange={(e) => updateNote(sel.id, { tag: e.target.value })}
                  className="w-32 bg-transparent outline-none focus:underline"
                />
                <span className="h-3 w-px bg-border" />
                <Link2 className="h-3 w-3" /> 0 linked tasks
                <span className="ml-auto flex items-center gap-2">
                  <span>Edited {sel.updated}</span>
                  <div className="flex items-center gap-px rounded border p-0.5">
                    <button onClick={() => setMode("edit")} className={`flex h-5 items-center gap-1 rounded-sm px-1.5 text-[11px] ${mode === "edit" ? "bg-[var(--color-hover)] text-foreground" : "text-muted-foreground"}`}>
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button onClick={() => setMode("preview")} className={`flex h-5 items-center gap-1 rounded-sm px-1.5 text-[11px] ${mode === "preview" ? "bg-[var(--color-hover)] text-foreground" : "text-muted-foreground"}`}>
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                  </div>
                  <button onClick={() => removeNote(sel.id)} className="rounded p-1 hover:bg-[var(--color-hover)] hover:text-red-700" title="Delete">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              </div>
              <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-10">
                <input
                  value={sel.title}
                  onChange={(e) => updateNote(sel.id, { title: e.target.value })}
                  className="w-full bg-transparent text-[24px] font-semibold tracking-tight outline-none"
                />
                {mode === "edit" ? (
                  <textarea
                    value={sel.excerpt}
                    onChange={(e) => updateNote(sel.id, { excerpt: e.target.value })}
                    placeholder="Start writing… (Markdown supported)"
                    className="mt-4 w-full resize-none bg-transparent font-mono text-[13px] leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground"
                    rows={16}
                  />
                ) : (
                  <article className="prose prose-sm mt-4 max-w-none dark:prose-invert">
                    <ReactMarkdown>{sel.excerpt || "_Empty note._"}</ReactMarkdown>
                  </article>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[13px] text-muted-foreground">No note selected. Create one →</div>
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
