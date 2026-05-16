"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, Plus, Trash2 } from "lucide-react";
import type { WorkItem, Status, Priority } from "@/lib/mock-data";
import { byInitials } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
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
  const checklist = item.checklist ?? [];
  const [newChecklistText, setNewChecklistText] = useState("");
  const m = byInitials(item.assignee);
  const titleRef = useRef<HTMLInputElement>(null);

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
      initial={{ x: 32, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 32, opacity: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="flex w-[420px] shrink-0 flex-col border-l bg-background">
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3 text-[12px]">
          <span className="font-mono text-muted-foreground">{item.id}</span>
          <StatusSelect value={item.status} onChange={(s) => setStatus(item.id, s)} />
        </div>
        <button onClick={onClose} title="Close" className="rounded p-1 text-muted-foreground hover:bg-[var(--color-hover)]"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Task details</div>
        <input
          ref={titleRef}
          value={item.title}
          onChange={(e) => updateWorkItem(item.id, { title: e.target.value })}
          placeholder="Task title"
          className="w-full bg-transparent text-[18px] font-semibold tracking-tight outline-none focus:underline focus:underline-offset-2"
        />

        <dl className="mt-6 grid grid-cols-[88px_1fr] gap-y-3 text-[12px]">
          <dt className="text-muted-foreground">Assignee</dt>
          <dd className="flex items-center gap-2"><Avatar id={m.id} /> {m.name}</dd>
          <dt className="text-muted-foreground">Priority</dt>
          <dd>
            <PrioritySelect value={item.priority} onChange={(p) => setPriority(item.id, p)} />
          </dd>
          <dt className="text-muted-foreground">Due</dt>
          <dd>
            <input
              type="date"
              value={item.due}
              onChange={(e) => updateWorkItem(item.id, { due: e.target.value })}
              className="rounded border bg-card px-1.5 py-0.5 text-[12px] outline-none focus:border-ring"
            />
          </dd>
          <dt className="text-muted-foreground">Label</dt>
          <dd>
            <input
              value={item.label}
              onChange={(e) => updateWorkItem(item.id, { label: e.target.value })}
              className="w-32 rounded border bg-card px-1.5 py-0.5 text-[12px] outline-none focus:border-ring"
            />
          </dd>
          <dt className="text-muted-foreground">Project</dt>
          <dd className="text-muted-foreground">{item.project}</dd>
        </dl>

        <div className="mt-6 border-t pt-5">
          <div className="mb-2 flex items-baseline gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Checklist</h3>
            {checklist.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {checklist.filter((c) => c.done).length} / {checklist.length}
              </span>
            )}
          </div>
          <ul className="space-y-1 text-[13px]">
            {checklist.map((c) => (
              <li key={c.id} className="group flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={c.done}
                  onChange={() => toggleChecklistItem(item.id, c.id)}
                  className="h-3 w-3 accent-[var(--color-primary)]"
                />
                <span className={`flex-1 ${c.done ? "text-muted-foreground line-through" : ""}`}>{c.text}</span>
                <button
                  onClick={() => removeChecklistItem(item.id, c.id)}
                  title="Remove"
                  className="rounded p-0.5 text-muted-foreground opacity-0 hover:bg-[var(--color-hover)] hover:text-red-700 group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
            <li className="flex items-center gap-2">
              <Plus className="h-3 w-3 text-muted-foreground" />
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
                className="h-6 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </li>
          </ul>
        </div>

        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Link2 className="h-3 w-3" /> Linked notes
          </h3>
          <ul className="space-y-1 text-[13px]">
            <li className="rounded px-2 py-1 hover:bg-[var(--color-hover)]">Design Brief — Mobile v2</li>
            <li className="rounded px-2 py-1 hover:bg-[var(--color-hover)]">Team Meeting Notes — May 12</li>
          </ul>
        </div>
      </div>
      <div className="border-t p-3">
        <input
          disabled
          placeholder="Comments coming soon…"
          className="h-8 w-full cursor-not-allowed rounded border bg-sidebar px-2 text-[13px] text-muted-foreground/60 outline-none"
        />
      </div>
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
