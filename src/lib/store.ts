"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  members as seedMembers,
  projects as seedProjects,
  workItems as seedWorkItems,
  inboxItems as seedInbox,
  notes as seedNotes,
  activity as seedActivity,
  type WorkItem,
  type Project,
  type Member,
  type Status,
  type Priority,
  type ActivityItem,
  type ChecklistItem,
} from "./mock-data";

export type InboxItem = { id: string; title: string; captured: string };
export type Note = { id: string; title: string; tag: string; updated: string; excerpt: string };

export type PriorityStyle = "arrows" | "labels" | "shapes";

export type Settings = {
  theme: "system" | "light" | "dark";
  accent: string;
  density: "compact" | "comfortable";
  workspaceName: string;
  priorityStyle: PriorityStyle;
  notifications: Record<string, boolean>;
};

type ActivityDay = { date: string; items: ActivityItem[] };

type State = {
  workItems: WorkItem[];
  projects: Project[];
  members: Member[];
  notes: Note[];
  inboxItems: InboxItem[];
  activity: ActivityDay[];
  settings: Settings;
};

type Actions = {
  // work items
  addWorkItem: (partial: Partial<WorkItem> & { title: string }) => string;
  updateWorkItem: (id: string, patch: Partial<WorkItem>) => void;
  deleteWorkItem: (id: string) => void;
  setWorkItemStatus: (id: string, status: Status) => void;
  setWorkItemPriority: (id: string, priority: Priority) => void;

  // checklist (per work item)
  addChecklistItem: (taskId: string, text: string) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  removeChecklistItem: (taskId: string, itemId: string) => void;

  // inbox
  addInboxItem: (title: string) => string;
  removeInboxItem: (id: string) => void;
  inboxToWorkItem: (id: string, partial?: Partial<WorkItem>) => string | null;

  // notes
  addNote: (partial: Partial<Note> & { title: string }) => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  removeNote: (id: string) => void;

  // settings
  updateSettings: (patch: Partial<Settings>) => void;

  // activity helpers
  logActivity: (item: ActivityItem) => void;

  // bulk
  resetData: () => void;
};

const defaultSettings: Settings = {
  theme: "system",
  accent: "oklch(0.52 0.09 195)",
  density: "compact",
  workspaceName: "Acme Inc.",
  priorityStyle: "arrows",
  notifications: {
    "Assigned to me": true,
    "Mentioned": true,
    "Comments on my items": true,
    "Status changes": false,
    "Weekly digest": false,
  },
};

const initialState: State = {
  workItems: [...seedWorkItems],
  projects: [...seedProjects] as Project[],
  members: [...seedMembers] as Member[],
  notes: [...seedNotes],
  inboxItems: [...seedInbox],
  activity: [...seedActivity],
  settings: defaultSettings,
};

function nextNumericId(items: { id: string }[], prefix: string): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  const max = items.reduce((acc, x) => {
    const m = re.exec(x.id);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `${prefix}-${max + 1}`;
}

function ensureUniqueId(items: { id: string }[], proposed: string, prefix: string): string {
  const taken = new Set(items.map((x) => x.id));
  if (!taken.has(proposed)) return proposed;
  return nextNumericId(items, prefix);
}

function uniqueTitle(base: string, takenTitles: Set<string>): string {
  const trimmed = (base ?? "").trim() || "Untitled";
  if (!takenTitles.has(trimmed)) return trimmed;
  let i = 2;
  while (takenTitles.has(`${trimmed} (${i})`)) i++;
  return `${trimmed} (${i})`;
}

function reassignDupId(currentId: string, taken: Set<string>, prefix: string): string {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let m = re.exec(currentId);
  let n = m ? parseInt(m[1], 10) + 1 : 1;
  let id = `${prefix}-${n}`;
  while (taken.has(id)) {
    n++;
    id = `${prefix}-${n}`;
  }
  return id;
}

function dedupByIdAndTitle<T extends { id: string; title: string }>(items: T[], prefix: string): T[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  return items.map((item) => {
    let id = item.id;
    if (seenIds.has(id)) id = reassignDupId(id, seenIds, prefix);
    seenIds.add(id);
    let title = (item.title ?? "").trim() || "Untitled";
    if (seenTitles.has(title)) {
      const base = title;
      let i = 2;
      while (seenTitles.has(`${base} (${i})`)) i++;
      title = `${base} (${i})`;
    }
    seenTitles.add(title);
    return { ...item, id, title };
  });
}

function dedupByIdOnly<T extends { id: string }>(items: T[], prefix: string): T[] {
  const seenIds = new Set<string>();
  return items.map((item) => {
    let id = item.id;
    if (seenIds.has(id)) id = reassignDupId(id, seenIds, prefix);
    seenIds.add(id);
    return { ...item, id };
  });
}

const todayLabel = () => {
  const d = new Date();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const timeLabel = () => {
  const d = new Date();
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
};

function prependActivity(activity: ActivityDay[], entry: ActivityItem): ActivityDay[] {
  if (activity[0]?.date === "Today") {
    const [first, ...rest] = activity;
    return [{ date: "Today", items: [entry, ...first.items] }, ...rest];
  }
  return [{ date: "Today", items: [entry] }, ...activity];
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initialState,

      addWorkItem: (partial) => {
        const state = get();
        const id = partial.id
          ? ensureUniqueId(state.workItems, partial.id, "FB")
          : nextNumericId(state.workItems, "FB");
        const title = uniqueTitle(partial.title, new Set(state.workItems.map((w) => w.title)));
        const item: WorkItem = {
          id,
          title,
          status: partial.status ?? "Backlog",
          priority: partial.priority ?? "Medium",
          assignee: partial.assignee ?? "AM",
          label: partial.label ?? "Task",
          due: partial.due ?? new Date().toISOString().slice(0, 10),
          project: partial.project ?? "core",
        };
        set((s) => ({
          workItems: [item, ...s.workItems],
          activity: prependActivity(s.activity, { who: item.assignee, action: "created", target: `${item.id} ${item.title}`, time: timeLabel() }),
        }));
        return id;
      },

      updateWorkItem: (id, patch) =>
        set((s) => ({ workItems: s.workItems.map((w) => (w.id === id ? { ...w, ...patch } : w)) })),

      deleteWorkItem: (id) =>
        set((s) => ({ workItems: s.workItems.filter((w) => w.id !== id) })),

      setWorkItemStatus: (id, status) => {
        const prev = get().workItems.find((w) => w.id === id);
        set((s) => ({
          workItems: s.workItems.map((w) => (w.id === id ? { ...w, status } : w)),
          activity: prev ? prependActivity(s.activity, { who: prev.assignee, action: "moved", target: `${prev.id} ${prev.title}`, to: status, time: timeLabel() }) : s.activity,
        }));
      },

      setWorkItemPriority: (id, priority) =>
        set((s) => ({ workItems: s.workItems.map((w) => (w.id === id ? { ...w, priority } : w)) })),

      addChecklistItem: (taskId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const newItem: ChecklistItem = {
          id: `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          text: trimmed,
          done: false,
        };
        set((s) => ({
          workItems: s.workItems.map((w) =>
            w.id === taskId ? { ...w, checklist: [...(w.checklist ?? []), newItem] } : w
          ),
        }));
      },

      toggleChecklistItem: (taskId, itemId) =>
        set((s) => ({
          workItems: s.workItems.map((w) =>
            w.id === taskId
              ? { ...w, checklist: (w.checklist ?? []).map((c) => c.id === itemId ? { ...c, done: !c.done } : c) }
              : w
          ),
        })),

      removeChecklistItem: (taskId, itemId) =>
        set((s) => ({
          workItems: s.workItems.map((w) =>
            w.id === taskId
              ? { ...w, checklist: (w.checklist ?? []).filter((c) => c.id !== itemId) }
              : w
          ),
        })),

      addInboxItem: (title) => {
        const state = get();
        const id = nextNumericId(state.inboxItems, "i");
        set((s) => ({
          inboxItems: [{ id, title, captured: "just now" }, ...s.inboxItems],
          activity: prependActivity(s.activity, { who: "AM", action: "captured", target: title, time: timeLabel() }),
        }));
        return id;
      },

      removeInboxItem: (id) =>
        set((s) => ({ inboxItems: s.inboxItems.filter((i) => i.id !== id) })),

      inboxToWorkItem: (id, partial) => {
        const item = get().inboxItems.find((i) => i.id === id);
        if (!item) return null;
        const newId = get().addWorkItem({ title: item.title, ...partial });
        set((s) => ({ inboxItems: s.inboxItems.filter((i) => i.id !== id) }));
        return newId;
      },

      addNote: (partial) => {
        const state = get();
        const id = partial.id
          ? ensureUniqueId(state.notes, partial.id, "n")
          : nextNumericId(state.notes, "n");
        const title = uniqueTitle(partial.title, new Set(state.notes.map((n) => n.title)));
        const note: Note = {
          id,
          title,
          tag: partial.tag ?? "General",
          updated: partial.updated ?? todayLabel(),
          excerpt: partial.excerpt ?? "",
        };
        set((s) => ({ notes: [note, ...s.notes] }));
        return id;
      },

      updateNote: (id, patch) =>
        set((s) => ({ notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updated: todayLabel() } : n)) })),

      removeNote: (id) => set((s) => ({ notes: s.notes.filter((n) => n.id !== id) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      logActivity: (item) => set((s) => ({ activity: prependActivity(s.activity, { ...item, time: item.time ?? timeLabel() }) })),

      resetData: () => set(() => ({ ...initialState, settings: get().settings })),
    }),
    {
      name: "fb.store.v1",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage))),
      version: 2,
      migrate: (persisted: unknown) => {
        const state = (persisted ?? {}) as Partial<State>;
        if (Array.isArray(state.workItems)) {
          state.workItems = dedupByIdAndTitle(state.workItems as WorkItem[], "FB") as WorkItem[];
        }
        if (Array.isArray(state.notes)) {
          state.notes = dedupByIdAndTitle(state.notes as Note[], "n") as Note[];
        }
        if (Array.isArray(state.inboxItems)) {
          state.inboxItems = dedupByIdOnly(state.inboxItems as InboxItem[], "i") as InboxItem[];
        }
        return state as State & Actions;
      },
      partialize: (s) => ({
        workItems: s.workItems,
        projects: s.projects,
        members: s.members,
        notes: s.notes,
        inboxItems: s.inboxItems,
        activity: s.activity,
        settings: s.settings,
      }),
    }
  )
);

export const byMemberId = (id: string): Member => {
  const m = useStore.getState().members.find((x) => x.id === id);
  return m ?? (seedMembers[0] as Member);
};

// Reactive hook for components that must wait for persist to rehydrate.
import { useEffect, useState } from "react";
export function useHasHydrated() {
  const [hydrated, setHydrated] = useState<boolean>(() => useStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useStore.persist.hasHydrated());
    return () => unsub();
  }, []);
  return hydrated;
}
