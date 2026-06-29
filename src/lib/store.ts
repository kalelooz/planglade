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
import { localDateKey } from "./dates";
import { DEFAULT_PRIORITY_DISPLAY_STYLE, normalizeAppearanceSettings, type PriorityDisplayStyle } from "./appearance-defaults";

export type InboxItem = { id: string; title: string; captured: string; project?: string; due?: string; priority?: Priority; workItemId?: string };
export type Note = { id: string; title: string; tag: string; updated: string; excerpt: string };

export type { PriorityDisplayStyle };

export type Settings = {
  theme: "system" | "light" | "dark";
  accent: string;
  density: "compact" | "comfortable";
  workspaceName: string;
  priorityDisplayStyle: PriorityDisplayStyle;
  activeProjectId: string | null;
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
  addWorkItem: (partial: Partial<WorkItem> & { title: string }, options?: { logActivity?: boolean }) => string;
  updateWorkItem: (id: string, patch: Partial<WorkItem>) => void;
  deleteWorkItem: (id: string) => void;
  setWorkItemStatus: (id: string, status: Status) => void;
  setWorkItemPriority: (id: string, priority: Priority) => void;
  reorderWorkItem: (id: string, targetStatus: Status, beforeId: string | null, scopeProjectId?: string | null) => void;

  // checklist (per work item)
  addChecklistItem: (taskId: string, text: string) => void;
  toggleChecklistItem: (taskId: string, itemId: string) => void;
  removeChecklistItem: (taskId: string, itemId: string) => void;

  // inbox
  addInboxItem: (title: string, options?: { createWorkItem?: boolean }) => string;
  removeInboxItem: (id: string) => void;
  updateInboxItem: (id: string, patch: Partial<InboxItem>) => void;
  inboxToWorkItem: (id: string, partial?: Partial<WorkItem>) => string | null;

  // notes
  addNote: (partial: Partial<Note> & { title: string }) => string;
  updateNote: (id: string, patch: Partial<Note>) => void;
  removeNote: (id: string) => void;

  // projects
  addProject: (partial: Partial<Project> & { name: string }) => string;
  updateProject: (id: string, patch: Partial<Project>) => void;
  removeProject: (id: string) => void;
  setProjects: (projects: Project[]) => void;

  // members
  updateMember: (id: string, patch: Partial<Member>) => void;

  // settings
  updateSettings: (patch: Partial<Settings>) => void;

  // activity helpers
  logActivity: (item: ActivityItem) => void;

  // bulk
  resetData: () => void;
};

const defaultSettings: Settings = {
  theme: "system",
  accent: "oklch(0.395 0.120 155)",
  density: "compact",
  workspaceName: "PlanGlade Workspace",
  priorityDisplayStyle: DEFAULT_PRIORITY_DISPLAY_STYLE,
  activeProjectId: "general",
  notifications: {
    "Assigned to me": true,
    "Mentioned": true,
    "Comments on my items": true,
    "Status changes": false,
    "Weekly digest": false,
  },
};

const legacyDefaultAccent = "oklch(0.52 0.09 195)";

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

      addWorkItem: (partial, options) => {
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
          start: partial.start ?? ((partial.due ?? new Date().toISOString().slice(0, 10)).split("T")[0]),
          project: partial.project ?? "general",
        };
        const logActivity = options?.logActivity !== false;
        set((s) => ({
          workItems: [item, ...s.workItems],
          activity: logActivity
            ? prependActivity(s.activity, { who: item.assignee, action: "created", target: `${item.id} ${item.title}`, time: timeLabel() })
            : s.activity,
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

      reorderWorkItem: (id, targetStatus, beforeId, scopeProjectId) => {
        set((s) => {
          const moved = s.workItems.find((w) => w.id === id);
          if (!moved) return s;
          const without = s.workItems.filter((w) => w.id !== id);
          const updated: WorkItem = { ...moved, status: targetStatus };
          const inScope = (w: WorkItem) =>
            w.status === targetStatus && (!scopeProjectId || w.project === scopeProjectId);
          let insertAt: number;
          if (beforeId) {
            const idx = without.findIndex((w) => w.id === beforeId);
            if (idx !== -1) {
              insertAt = idx;
            } else {
              let lastScopedIdx = -1;
              for (let i = without.length - 1; i >= 0; i--) {
                if (inScope(without[i])) { lastScopedIdx = i; break; }
              }
              insertAt = lastScopedIdx === -1 ? without.length : lastScopedIdx + 1;
            }
          } else {
            // Append after the last existing scoped item; if none exist, append to end.
            let lastIdx = -1;
            for (let i = without.length - 1; i >= 0; i--) {
              if (inScope(without[i])) { lastIdx = i; break; }
            }
            insertAt = lastIdx === -1 ? without.length : lastIdx + 1;
          }
          const next = [...without.slice(0, insertAt), updated, ...without.slice(insertAt)];
          const statusChanged = moved.status !== targetStatus;
          const activityNext = statusChanged
            ? prependActivity(s.activity, { who: moved.assignee, action: "moved", target: `${moved.id} ${moved.title}`, to: targetStatus, time: timeLabel() })
            : s.activity;
          return { workItems: next, activity: activityNext };
        });
      },

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

      addInboxItem: (title, options) => {
        const state = get();
        const trimmed = title.trim();
        const id = nextNumericId(state.inboxItems, "i");
        const captureProject = options?.createWorkItem ? state.settings.activeProjectId ?? undefined : undefined;
        const workItemId = options?.createWorkItem
          ? get().addWorkItem(
              {
                title: trimmed,
                due: localDateKey(),
                project: state.settings.activeProjectId ?? "general",
              },
              { logActivity: false }
            )
          : undefined;
        set((s) => ({
          inboxItems: [{ id, title: trimmed, captured: "just now", workItemId, project: captureProject }, ...s.inboxItems],
          activity: prependActivity(s.activity, { who: "AM", action: "captured", target: trimmed, time: timeLabel() }),
        }));
        return id;
      },

      removeInboxItem: (id) => {
        const item = get().inboxItems.find((i) => i.id === id);
        set((s) => ({
          inboxItems: s.inboxItems.filter((i) => i.id !== id),
          workItems: item?.workItemId ? s.workItems.filter((w) => w.id !== item.workItemId) : s.workItems,
        }));
      },

      updateInboxItem: (id, patch) => {
        const previous = get().inboxItems.find((i) => i.id === id);
        if (!previous) return;
        const hasTriagePatch = "project" in patch || "due" in patch || "priority" in patch;
        set((s) => {
          const nextInbox = s.inboxItems.map((i) => (i.id === id ? { ...i, ...patch } : i));
          if (!previous.workItemId || !hasTriagePatch) {
            return { inboxItems: nextInbox };
          }

          const workItemPatch: Partial<WorkItem> = {};
          const summaryParts: string[] = [];
          if ("project" in patch) {
            const nextProject = patch.project ?? s.settings.activeProjectId ?? "general";
            workItemPatch.project = nextProject;
            const name = s.projects.find((p) => p.id === nextProject)?.name ?? "Project";
            summaryParts.push(`project ${name}`);
          }
          if ("due" in patch) {
            const nextDue = patch.due ?? "";
            workItemPatch.due = nextDue;
            summaryParts.push(nextDue ? `due ${nextDue}` : "cleared due");
          }
          if ("priority" in patch) {
            const nextPriority = patch.priority ?? "Medium";
            workItemPatch.priority = nextPriority;
            summaryParts.push(`priority ${nextPriority}`);
          }

          return {
            inboxItems: nextInbox,
            workItems: s.workItems.map((w) => (w.id === previous.workItemId ? { ...w, ...workItemPatch } : w)),
            activity: prependActivity(s.activity, {
              who: "AM",
              action: "triaged",
              target: `${previous.workItemId} ${previous.title}`,
              to: summaryParts.join(", ") || undefined,
              time: timeLabel(),
            }),
          };
        });
      },

      inboxToWorkItem: (id, partial) => {
        const item = get().inboxItems.find((i) => i.id === id);
        if (!item) return null;
        // Merge any accumulated triage fields from the inbox item with the override partial
        const accumulated: Partial<WorkItem> = {};
        if (item.project) accumulated.project = item.project;
        if (item.due) accumulated.due = item.due;
        if (item.priority) accumulated.priority = item.priority;

        if (item.workItemId) {
          set((s) => ({
            workItems: s.workItems.map((w) => (w.id === item.workItemId ? { ...w, ...accumulated, ...partial } : w)),
            inboxItems: s.inboxItems.filter((i) => i.id !== id),
            activity: prependActivity(s.activity, {
              who: "AM",
              action: "created",
              target: `${item.workItemId} ${item.title}`,
              time: timeLabel(),
            }),
          }));
          return item.workItemId;
        }

        const newId = get().addWorkItem({ title: item.title, ...accumulated, ...partial });
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

      addProject: (partial) => {
        const state = get();
        const palette = ["oklch(0.55 0.15 250)", "oklch(0.62 0.15 30)", "oklch(0.6 0.14 145)", "oklch(0.65 0.16 330)", "oklch(0.52 0.09 195)", "oklch(0.6 0.16 80)"];
        const slug = partial.id
          ? partial.id
          : partial.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || `p-${state.projects.length + 1}`;
        const usedIds = new Set(state.projects.map((p) => p.id));
        let uniqueId = slug;
        let n = 2;
        while (usedIds.has(uniqueId)) uniqueId = `${slug}-${n++}`;
        const project: Project = {
          id: uniqueId,
          name: partial.name,
          status: partial.status ?? "Active",
          due: partial.due ?? "",
          owner: partial.owner ?? "AM",
          progress: partial.progress ?? 0,
          accent: partial.accent ?? palette[state.projects.length % palette.length],
        };
        set((s) => ({ projects: [...s.projects, project] }));
        return uniqueId;
      },

      updateProject: (id, patch) =>
        set((s) => ({ projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      removeProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          workItems: s.workItems.filter((w) => w.project !== id),
          settings: {
            ...s.settings,
            activeProjectId: s.settings.activeProjectId === id ? null : s.settings.activeProjectId,
          },
        })),

      setProjects: (projects) =>
        set((s) => ({
          projects,
          settings: {
            ...s.settings,
            activeProjectId: projects.some((project) => project.id === s.settings.activeProjectId)
              ? s.settings.activeProjectId
              : null,
          },
        })),

      updateMember: (id, patch) =>
        set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      logActivity: (item) => set((s) => ({ activity: prependActivity(s.activity, { ...item, time: item.time ?? timeLabel() }) })),

      resetData: () => set(() => ({ ...initialState, settings: get().settings })),
    }),
    {
      name: "fb.store.v2",
      storage: createJSONStorage(() => (typeof window !== "undefined" ? window.localStorage : (undefined as unknown as Storage))),
      version: 6,
      migrate: (persisted: unknown) => {
        const state = (persisted ?? {}) as Partial<State>;
        if (Array.isArray(state.workItems)) {
          state.workItems = dedupByIdAndTitle(state.workItems as WorkItem[], "FB") as WorkItem[];
          state.workItems = (state.workItems as WorkItem[]).map((item) => {
            if (item.start) return item;
            const start = item.due ? item.due.split("T")[0] : "";
            return { ...item, start };
          }) as WorkItem[];
        }
        if (Array.isArray(state.notes)) {
          state.notes = dedupByIdAndTitle(state.notes as Note[], "n") as Note[];
        }
        if (Array.isArray(state.inboxItems)) {
          state.inboxItems = dedupByIdOnly(state.inboxItems as InboxItem[], "i") as InboxItem[];
        }
        if (state.settings?.accent === legacyDefaultAccent) {
          state.settings = { ...(state.settings as Settings), accent: defaultSettings.accent };
        }
        if (state.settings?.workspaceName === "FlowBoard Workspace") {
          state.settings = { ...(state.settings as Settings), workspaceName: defaultSettings.workspaceName };
        }
        if (state.settings && (!("activeProjectId" in state.settings) || state.settings.activeProjectId === undefined)) {
          state.settings = { ...(state.settings as Settings), activeProjectId: defaultSettings.activeProjectId };
        }
        if (state.settings) {
          state.settings = normalizeAppearanceSettings(state.settings as Settings);
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
import { useSyncExternalStore } from "react";
export function useHasHydrated() {
  return useSyncExternalStore(
    (callback) => useStore.persist.onFinishHydration(callback),
    () => useStore.persist.hasHydrated(),
    () => false
  );
}
