"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, Plus, Trash2, FileText } from "lucide-react";
import Link from "next/link";
import type { WorkItem, Status, Priority } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { getDatePart, getTimePart } from "@/lib/dates";
import { Avatar, PriorityIcon, StatusIcon } from "./icons";
import { Chip } from "./page";

const STATUSES: Status[] = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

export function TaskDrawer({ item, onClose, focusTitle, onTitleFocused }: { item: WorkItem | null; onClose: () => void; focusTitle?: boolean; onTitleFocused?: () => void }) {
  return (
    <AnimatePresence initial={false}>
      {item && <DrawerContent item={item} onClose={onClose} focusTitle={!!focusTitle} onTitleFocused={onTitleFocused} />}
    </AnimatePresence>
  );
}

type DrawerContentProps = {
  item: WorkItem;
  onClose: () => void;
  focusTitle: boolean;
  onTitleFocused?: () => void;
};

function DrawerContent({ item, onClose, focusTitle, onTitleFocused }: DrawerContentProps) {
  const setStatus = useStore((s) => s.setWorkItemStatus);
  const setPriority = useStore((s) => s.setWorkItemPriority);
  const updateWorkItem = useStore((s) => s.updateWorkItem);
  const addChecklistItem = useStore((s) => s.addChecklistItem);
  const toggleChecklistItem = useStore((s) => s.toggleChecklistItem);
  const removeChecklistItem = useStore((s) => s.removeChecklistItem);
  const members = useStore((s) => s.members);
  const projects = useStore((s) => s.projects);
  const notes = useStore((s) => s.notes);
  const checklist = item.checklist ?? [];
  const [newChecklistText, setNewChecklistText] = useState("");
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const linkedNoteIds = item.noteIds ?? [];
  const linkedNotes = notes.filter((n) => linkedNoteIds.includes(n.id));
  const linkableNotes = notes.filter((n) => !linkedNoteIds.includes(n.id));
  const dueValue = getDatePart(item.due);

  const linkNote = (noteId: string) => {
    if (linkedNoteIds.includes(noteId)) return;
    updateWorkItem(item.id, { noteIds: [...linkedNoteIds, noteId] });
    setNotePickerOpen(false);
  };
  const unlinkNote = (noteId: string) => {
    updateWorkItem(item.id, { noteIds: linkedNoteIds.filter((id) => id !== noteId) });
  };

  useEffect(() => {
    if (focusTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
      onTitleFocused?.();
    }
  }, [focusTitle, item.id, onTitleFocused]);

  return (
    <motion.aside
      key={item.id}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex w-[420px] shrink-0 flex-col border-l bg-background">

      {/* ── Header ── */}
      <div className="flex h-12 items-center justify-between border-b px-5">
        <div className="flex items-center gap-3 text-[12px]">
          <span className="font-mono text-muted-foreground">{item.id}</span>
          <StatusSelect value={item.status} onChange={(s) => setStatus(item.id, s)} />
        </div>
        <button onClick={onClose} title="Close" className="lov-icon-btn"><X className="h-3.5 w-3.5" /></button>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* Task title */}
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Task details</div>
        <input
          ref={titleRef}
          value={item.title}
          onChange={(e) => updateWorkItem(item.id, { title: e.target.value })}
          placeholder="Task title"
          className="mb-2 w-full bg-transparent text-[18px] font-semibold tracking-tight outline-none focus:underline focus:underline-offset-2"
        />
        <textarea
          value={item.description ?? ""}
          onChange={(e) => updateWorkItem(item.id, { description: e.target.value })}
          placeholder="Add a description…"
          rows={3}
          className="mb-2 w-full resize-y bg-transparent text-[13px] leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground/60"
        />

        {/* ── Details grid ── */}
        <dl className="mt-6 grid grid-cols-[96px_1fr] gap-y-4 text-[12px]">
          <dt className="pt-0.5 text-muted-foreground">Assignee</dt>
          <dd>
            <AssigneeSelect members={members} value={item.assignee} onChange={(id) => updateWorkItem(item.id, { assignee: id })} />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Priority</dt>
          <dd>
            <PrioritySelect value={item.priority} onChange={(p) => setPriority(item.id, p)} />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Due</dt>
          <dd>
            <input
              type="date"
              value={dueValue}
              onChange={(e) => {
                const time = getTimePart(item.due);
                updateWorkItem(item.id, { due: time ? `${e.target.value}T${time}` : e.target.value });
              }}
              className="rounded border bg-card px-2 py-1 text-[12px] outline-none focus:border-ring"
            />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Label</dt>
          <dd>
            <input
              value={item.label}
              onChange={(e) => updateWorkItem(item.id, { label: e.target.value })}
              className="w-32 rounded border bg-card px-2 py-1 text-[12px] outline-none focus:border-ring"
            />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Project</dt>
          <dd>
            <select
              value={item.project}
              onChange={(e) => updateWorkItem(item.id, { project: e.target.value })}
              className="rounded border bg-card px-2 py-1 text-[12px] outline-none focus:border-ring"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </dd>
        </dl>

        {/* ── Checklist ── */}
        <div className="mt-8 border-t pt-6">
          <div className="mb-3 flex items-baseline gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Checklist</h3>
            {checklist.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {checklist.filter((c) => c.done).length} / {checklist.length}
              </span>
            )}
          </div>
          <ul className="space-y-2 text-[13px]">
            {checklist.map((c) => (
              <li key={c.id} className="group flex items-center gap-2.5 rounded px-1 py-0.5">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={() => toggleChecklistItem(item.id, c.id)}
                  className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                />
                <span className={`flex-1 ${c.done ? "text-muted-foreground line-through" : ""}`}>{c.text}</span>
                <button
                  onClick={() => removeChecklistItem(item.id, c.id)}
                  title="Remove"
                  className="lov-icon-btn h-5 w-5 opacity-0 hover:text-red-700 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
            <li className="flex items-center gap-2.5 px-1 py-0.5">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={newChecklistText}
                onChange={(e) => setNewChecklistText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newChecklistText.trim()) {
                    addChecklistItem(item.id, newChecklistText);
                    setNewChecklistText("");
                  }
                }}
                placeholder={checklist.length === 0 ? "Add a checklist item…" : "Add another…"}
                className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
              />
            </li>
          </ul>
        </div>

        {/* ── Linked notes ── */}
        <div className="mt-8 border-t pt-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Link2 className="h-3 w-3" /> Linked notes
            </h3>
            <button
              onClick={() => setNotePickerOpen((open) => !open)}
              className="lov-btn lov-btn-ghost h-6 px-1.5 text-[11px]"
            >
              <Plus className="h-3 w-3" /> Link note
            </button>
          </div>

          {notePickerOpen && (
            <>
              <div className="fixed inset-0 z-[70]" onMouseDown={() => setNotePickerOpen(false)} />
              <div className="relative z-[80] mb-3 max-h-48 overflow-y-auto rounded border bg-card shadow-lg">
                {linkableNotes.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-muted-foreground">All notes are linked.</p>
                ) : (
                  linkableNotes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => linkNote(n.id)}
                      className="lov-menu-item px-3 py-1.5 text-[13px]"
                    >
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="flex-1 truncate">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{n.tag}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {linkedNotes.length > 0 ? (
            <ul className="space-y-1">
              {linkedNotes.map((n) => (
                <li key={n.id} className="group flex items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-[var(--color-hover)]">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <Link href={`/notes?id=${n.id}`} className="min-w-0 flex-1 truncate text-foreground hover:underline">
                    {n.title}
                  </Link>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{n.updated}</span>
                  <button
                    onClick={() => unlinkNote(n.id)}
                    title="Unlink"
                    className="lov-icon-btn h-5 w-5 opacity-0 hover:text-red-700 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            !notePickerOpen && (
              <p className="px-2 text-[12px] text-muted-foreground/60">
                No notes linked yet. Use Link note to attach one.
              </p>
            )
          )}
        </div>
      </div>

      {/* ── Footer ── */}
    </motion.aside>
  );
}

function StatusSelect({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <StatusIcon s={value} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Status)}
        className="bg-transparent text-[12px] outline-none hover:underline"
      >
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
  );
}

function AssigneeSelect({ members, value, onChange }: { members: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  const current = members.find((member) => member.id === value) ?? members[0];
  return (
    <span className="flex items-center gap-2">
      <Avatar id={current.id} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-[12px] outline-none hover:underline"
      >
        {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </span>
  );
}

function PrioritySelect({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <span className="flex items-center gap-1.5">
      <PriorityIcon p={value} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Priority)}
        className="bg-transparent text-[12px] outline-none hover:underline"
      >
        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </span>
  );
}

// Re-export Chip so caller imports still work if they referenced it via the drawer module.
export { Chip };
