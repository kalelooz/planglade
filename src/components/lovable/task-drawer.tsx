"use client";
import { forwardRef, useState, useRef, useEffect, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Link2, Plus, Trash2, FileText, MessageSquare, Send, History } from "lucide-react";
import Link from "next/link";
import type { WorkItem, Status, Priority } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { apiFetch } from "@/lib/server-session-client";
import { getDatePart, getTimePart } from "@/lib/dates";
import { DateField } from "./date-field";
import { Avatar, StatusIcon } from "./icons";
import { PriorityIndicator } from "./priority-indicator";
import { Chip } from "./page";
import { type ApiWorkItem, toApiWorkPriority, toApiWorkStatus, toIsoDateTime, toUiWorkItem } from "@/lib/server-ui-mappers";
import { applyWorkItemDependencyRelations, type WorkItemDependencyRelation } from "@/lib/work-item-dependencies";
import { getParentTask, subtaskProgress } from "@/lib/work-item-hierarchy";
import { TaskCompletionToggle } from "./task-completion-toggle";

const STATUSES: Status[] = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const INLINE_DRAWER_WIDTH = "clamp(340px, 34vw, 420px)";

function prettyActionLabel(action: DrawerHistoryEvent["action"]) {
  if (action === "CREATED") return "Created";
  if (action === "UPDATED") return "Updated";
  if (action === "MOVED") return "Moved";
  if (action === "COMPLETED") return "Completed";
  if (action === "DELETED") return "Deleted";
  if (action === "COMMENTED") return "Commented";
  if (action === "ASSIGNED") return "Assigned";
  return "Unassigned";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type DrawerMember = { id: string; name: string };
type DrawerProject = { id: string; name: string; accent?: string; icon?: string };
type DrawerNote = { id: string; title: string; tag: string; updated: string };
type DrawerComment = {
  id: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string | null; email: string };
  mentionUserIds?: string[];
};
type DrawerHistoryEvent = {
  id: string;
  action: "CREATED" | "UPDATED" | "MOVED" | "COMPLETED" | "DELETED" | "COMMENTED" | "ASSIGNED" | "UNASSIGNED";
  summary: string | null;
  metadata?: unknown;
  createdAt: string;
  actor: { id: string; name: string | null; email: string } | null;
};
export function TaskDrawer({
  item,
  onClose,
  focusTitle,
  initialFocusSection,
  onTitleFocused,
  workspaceId,
  currentUserId,
  membersOverride,
  projectsOverride,
  notesOverride,
  allItems,
  onItemPatched,
  onItemReplaced,
  onItemsReplaced,
  onSelectItem,
}: {
  item: WorkItem | null;
  onClose: () => void;
  focusTitle?: boolean;
  initialFocusSection?: "comments" | "history";
  onTitleFocused?: () => void;
  workspaceId?: string | null;
  currentUserId?: string | null;
  membersOverride?: DrawerMember[];
  projectsOverride?: DrawerProject[];
  notesOverride?: DrawerNote[];
  allItems?: WorkItem[];
  onItemPatched?: (id: string, patch: Partial<WorkItem>) => void;
  onItemReplaced?: (item: WorkItem) => void;
  onItemsReplaced?: (items: WorkItem[]) => void;
  onSelectItem?: (id: string) => void;
}) {
  return (
    <AnimatePresence initial={false}>
      {item && (
        <DrawerContent
          item={item}
          onClose={onClose}
          focusTitle={!!focusTitle}
          initialFocusSection={initialFocusSection}
          onTitleFocused={onTitleFocused}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          membersOverride={membersOverride}
          projectsOverride={projectsOverride}
          notesOverride={notesOverride}
          allItems={allItems}
          onItemPatched={onItemPatched}
          onItemReplaced={onItemReplaced}
          onItemsReplaced={onItemsReplaced}
          onSelectItem={onSelectItem}
        />
      )}
    </AnimatePresence>
  );
}

type DrawerContentProps = {
  item: WorkItem;
  onClose: () => void;
  focusTitle: boolean;
  initialFocusSection?: "comments" | "history";
  onTitleFocused?: () => void;
  workspaceId?: string | null;
  currentUserId?: string | null;
  membersOverride?: DrawerMember[];
  projectsOverride?: DrawerProject[];
  notesOverride?: DrawerNote[];
  allItems?: WorkItem[];
  onItemPatched?: (id: string, patch: Partial<WorkItem>) => void;
  onItemReplaced?: (item: WorkItem) => void;
  onItemsReplaced?: (items: WorkItem[]) => void;
  onSelectItem?: (id: string) => void;
};

function DrawerContent({
  item,
  onClose,
  focusTitle,
  initialFocusSection,
  onTitleFocused,
  workspaceId,
  currentUserId,
  membersOverride,
  projectsOverride,
  notesOverride,
  allItems,
  onItemPatched,
  onItemReplaced,
  onItemsReplaced,
  onSelectItem,
}: DrawerContentProps) {
  const setStatus = useStore((s) => s.setWorkItemStatus);
  const setPriority = useStore((s) => s.setWorkItemPriority);
  const updateWorkItem = useStore((s) => s.updateWorkItem);
  const addChecklistItem = useStore((s) => s.addChecklistItem);
  const toggleChecklistItem = useStore((s) => s.toggleChecklistItem);
  const removeChecklistItem = useStore((s) => s.removeChecklistItem);
  const storeMembers = useStore((s) => s.members);
  const storeProjects = useStore((s) => s.projects);
  const storeNotes = useStore((s) => s.notes);

  const checklist = item.checklist ?? [];
  const [newChecklistText, setNewChecklistText] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [dependencyPickerOpen, setDependencyPickerOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [descriptionDraft, setDescriptionDraft] = useState(item.description ?? "");
  const [labelDraft, setLabelDraft] = useState(item.label);
  const [knownLabels, setKnownLabels] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<DrawerComment[]>([]);
  const [historyEvents, setHistoryEvents] = useState<DrawerHistoryEvent[]>([]);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [postingComment, setPostingComment] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const commentsSectionRef = useRef<HTMLDivElement>(null);
  const historySectionRef = useRef<HTMLDivElement>(null);

  const members = membersOverride ?? storeMembers;
  const projects = projectsOverride ?? storeProjects;
  const notes = notesOverride ?? storeNotes;
  const serverMode = Boolean(workspaceId && onItemPatched);

  const linkedNoteIds = item.noteIds ?? [];
  const linkedNotes = notes.filter((n) => linkedNoteIds.includes(n.id));
  const linkableNotes = notes.filter((n) => !linkedNoteIds.includes(n.id));
  const drawerItems = allItems ?? [item];
  const blockerIds = item.blockerIds ?? [];
  const blockingIds = item.blockingIds ?? [];
  const blockedByLinks = item.dependencyLinks?.filter((link) => link.direction === "blockedBy") ?? [];
  const blockerItems = blockerIds.map((id) => drawerItems.find((candidate) => candidate.id === id)).filter((candidate): candidate is WorkItem => !!candidate);
  const blockingItems = blockingIds.map((id) => drawerItems.find((candidate) => candidate.id === id)).filter((candidate): candidate is WorkItem => !!candidate);
  const dependencyCandidates = drawerItems.filter((candidate) =>
    candidate.id !== item.id &&
    candidate.project === item.project &&
    !blockerIds.includes(candidate.id)
  );
  const subtasks = drawerItems.filter((candidate) => candidate.parentId === item.id);
  const parentTask = getParentTask(item, drawerItems);
  const progress = subtaskProgress(item, drawerItems);
  const startValue = getDatePart(item.start ?? "");
  const dueValue = getDatePart(item.due);
  const mentionQuery = /(^|\s)@([a-zA-Z0-9._-]{1,60})$/.exec(commentDraft);
  const mentionCandidates =
    mentionQuery && members.length > 0
      ? members.filter((member) =>
          member.name.toLowerCase().replace(/\s+/g, "").startsWith(mentionQuery[2].toLowerCase().replace(/\s+/g, ""))
        )
      : [];

  const applyLocalPatch = (patch: Partial<WorkItem>) => {
    if (onItemPatched) {
      onItemPatched(item.id, patch);
      return;
    }
    updateWorkItem(item.id, patch);
  };

  const restoreItem = (previous: WorkItem) => {
    if (onItemReplaced) {
      onItemReplaced(previous);
      return;
    }
    updateWorkItem(item.id, previous);
  };

  const patchServer = async (uiPatch: Partial<WorkItem>, apiPatch: Record<string, unknown>) => {
    const previous = item;
    applyLocalPatch(uiPatch);
    if (!workspaceId) return true;

    const response = await apiFetch(
      `/api/work-items/${encodeURIComponent(item.id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": currentUserId ?? "",
        },
        body: JSON.stringify(apiPatch),
      }
    );

    if (!response.ok) {
      restoreItem(previous);
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (!serverMode || !workspaceId) return;
    let active = true;
    void (async () => {
      const response = await apiFetch(`/api/labels?workspaceId=${encodeURIComponent(workspaceId)}`, {
        cache: "no-store",
      });
      if (!response.ok || !active) return;
      const payload = (await response.json()) as { labels: Array<{ id: string; name: string }> };
      if (!active) return;
      const next: Record<string, string> = {};
      payload.labels.forEach((label) => {
        next[label.name.toLowerCase()] = label.id;
      });
      setKnownLabels(next);
    })();
    return () => {
      active = false;
    };
  }, [serverMode, workspaceId]);

  useEffect(() => {
    setTitleDraft(item.title);
    setDescriptionDraft(item.description ?? "");
    setLabelDraft(item.label);
    setCommentDraft("");
    setSubtaskError(null);
  }, [item.id, item.title, item.description, item.label]);

  useEffect(() => {
    if (!serverMode || !workspaceId) return;
    let active = true;

    void (async () => {
      setCommentsLoading(true);
      try {
        const [commentsRes, historyRes] = await Promise.all([
          apiFetch(
            `/api/work-items/${encodeURIComponent(item.id)}/comments?workspaceId=${encodeURIComponent(workspaceId)}`,
            {
              cache: "no-store",
              headers: { "x-flowboard-user-id": currentUserId ?? "" },
            }
          ),
          apiFetch(
            `/api/work-items/${encodeURIComponent(item.id)}/history?workspaceId=${encodeURIComponent(workspaceId)}`,
            {
              cache: "no-store",
              headers: { "x-flowboard-user-id": currentUserId ?? "" },
            }
          ),
        ]);
        if (!active) return;

        if (commentsRes.ok) {
          const commentsPayload = (await commentsRes.json()) as { comments: DrawerComment[] };
          if (active) setComments(commentsPayload.comments ?? []);
        }

        if (historyRes.ok) {
          const historyPayload = (await historyRes.json()) as { events: DrawerHistoryEvent[] };
          if (active) setHistoryEvents(historyPayload.events ?? []);
        }
      } finally {
        if (active) setCommentsLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [serverMode, workspaceId, item.id, currentUserId]);

  const resolveLabelId = async (name: string) => {
    if (!workspaceId) return undefined;
    const trimmed = name.trim();
    if (!trimmed) return undefined;
    const key = trimmed.toLowerCase();
    if (knownLabels[key]) return knownLabels[key];

    const response = await apiFetch("/api/labels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, name: trimmed }),
    });
    if (!response.ok) return undefined;
    const payload = (await response.json()) as { label: { id: string; name: string } };
    setKnownLabels((current) => ({ ...current, [payload.label.name.toLowerCase()]: payload.label.id }));
    return payload.label.id;
  };

  const insertMention = (member: DrawerMember) => {
    const next = commentDraft.replace(/(^|\s)@([a-zA-Z0-9._-]{0,60})$/, `$1@${member.name.replace(/\s+/g, "")} `);
    setCommentDraft(next);
    commentRef.current?.focus();
  };

  const postComment = async () => {
    if (!serverMode || !workspaceId || !commentDraft.trim() || postingComment) return;
    setPostingComment(true);
    try {
      const response = await apiFetch(
        `/api/work-items/${encodeURIComponent(item.id)}/comments?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-flowboard-user-id": currentUserId ?? "",
          },
          body: JSON.stringify({ body: commentDraft.trim() }),
        }
      );
      if (!response.ok) return;

      const payload = (await response.json()) as { comment: DrawerComment };
      setComments((current) => [...current, payload.comment]);
      setCommentDraft("");

      const historyResponse = await apiFetch(
        `/api/work-items/${encodeURIComponent(item.id)}/history?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          cache: "no-store",
          headers: { "x-flowboard-user-id": currentUserId ?? "" },
        }
      );
      if (historyResponse.ok) {
        const historyPayload = (await historyResponse.json()) as { events: DrawerHistoryEvent[] };
        setHistoryEvents(historyPayload.events ?? []);
      }
    } finally {
      setPostingComment(false);
    }
  };

  const linkNote = (noteId: string) => {
    if (linkedNoteIds.includes(noteId)) return;
    const nextNoteIds = [...linkedNoteIds, noteId];
    if (!serverMode) {
      applyLocalPatch({ noteIds: nextNoteIds });
    } else {
      void patchServer({ noteIds: nextNoteIds }, { noteIds: nextNoteIds });
    }
    setNotePickerOpen(false);
  };

  const unlinkNote = (noteId: string) => {
    const nextNoteIds = linkedNoteIds.filter((id) => id !== noteId);
    if (!serverMode) {
      applyLocalPatch({ noteIds: nextNoteIds });
    } else {
      void patchServer({ noteIds: nextNoteIds }, { noteIds: nextNoteIds });
    }
  };

  const refreshDependencies = async () => {
    if (!workspaceId || !onItemsReplaced || drawerItems.length === 0) return;
    const response = await apiFetch(`/api/work-item-relations?workspaceId=${encodeURIComponent(workspaceId)}`, {
      cache: "no-store",
      headers: { "x-flowboard-user-id": currentUserId ?? "" },
    });
    if (!response.ok) return;
    const payload = (await response.json()) as { relations: WorkItemDependencyRelation[] };
    onItemsReplaced(applyWorkItemDependencyRelations(drawerItems, payload.relations));
  };

  const addBlocker = async (blockerId: string) => {
    if (!workspaceId || !serverMode || !onItemsReplaced) return;
    const response = await apiFetch("/api/work-item-relations", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify({
        workspaceId,
        sourceId: item.id,
        targetId: blockerId,
        relationType: "BLOCKED_BY",
      }),
    });
    if (response.ok) {
      setDependencyPickerOpen(false);
      await refreshDependencies();
    }
  };

  const removeBlocker = async (relationId: string) => {
    if (!workspaceId || !serverMode || !onItemsReplaced) return;
    const response = await apiFetch(
      `/api/work-item-relations/${encodeURIComponent(relationId)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: "DELETE",
        headers: { "x-flowboard-user-id": currentUserId ?? "" },
      }
    );
    if (response.ok) await refreshDependencies();
  };

  useEffect(() => {
    if (focusTitle && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
      onTitleFocused?.();
    }
  }, [focusTitle, item.id, onTitleFocused]);

  useEffect(() => {
    if (!serverMode || !initialFocusSection) return;
    const targetRef = initialFocusSection === "comments" ? commentsSectionRef : historySectionRef;
    const timerId = window.setTimeout(() => {
      targetRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      if (initialFocusSection === "comments") {
        commentRef.current?.focus();
      }
    }, 120);
    return () => window.clearTimeout(timerId);
  }, [serverMode, item.id, initialFocusSection]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const onStatusChange = async (status: Status) => {
    if (!serverMode) {
      setStatus(item.id, status);
      return;
    }
    await patchServer(
      { status },
      {
        status: toApiWorkStatus(status),
        completedAt: status === "Done" ? new Date().toISOString() : null,
      }
    );
  };

  const onPriorityChange = async (priority: Priority) => {
    if (!serverMode) {
      setPriority(item.id, priority);
      return;
    }
    await patchServer({ priority }, { priority: toApiWorkPriority(priority) });
  };

  const onAssigneeChange = async (assignee: string) => {
    if (!serverMode) {
      updateWorkItem(item.id, { assignee });
      return;
    }
    const assigneeId = assignee === "unassigned" ? null : assignee;
    await patchServer({ assignee }, { assigneeId });
  };

  const onDueChange = async (nextDue: string) => {
    const date = nextDue.trim();
    const time = getTimePart(item.due);
    const value = date ? (time ? `${date}T${time}` : date) : "";
    if (!serverMode) {
      updateWorkItem(item.id, { due: value });
      return;
    }
    await patchServer({ due: value }, { dueDate: date ? toIsoDateTime(value) : null });
  };

  const onStartChange = async (nextStart: string) => {
    const date = nextStart.trim();
    if (!serverMode) {
      updateWorkItem(item.id, { start: date });
      return;
    }
    await patchServer({ start: date }, { startDate: date ? toIsoDateTime(date) : null });
  };

  const onProjectChange = async (projectId: string) => {
    const nextProjectId = projectId.trim();
    if (!serverMode) {
      updateWorkItem(item.id, { project: nextProjectId });
      return;
    }
    await patchServer({ project: nextProjectId }, { projectId: nextProjectId || null });
  };

  const onLabelCommit = async () => {
    const nextLabel = labelDraft.trim() || "Task";
    if (nextLabel === item.label) return;

    if (!serverMode) {
      updateWorkItem(item.id, { label: nextLabel });
      return;
    }

    const labelId = await resolveLabelId(nextLabel);
    if (!labelId) return;
    await patchServer({ label: nextLabel }, { labelIds: [labelId] });
  };

  const onTitleCommit = async () => {
    const nextTitle = titleDraft.trim();
    if (!nextTitle || nextTitle === item.title) {
      setTitleDraft(item.title);
      return;
    }
    if (!serverMode) {
      updateWorkItem(item.id, { title: nextTitle });
      return;
    }
    await patchServer({ title: nextTitle }, { title: nextTitle });
  };

  const onDescriptionCommit = async () => {
    if (descriptionDraft === (item.description ?? "")) return;
    if (!serverMode) {
      updateWorkItem(item.id, { description: descriptionDraft });
      return;
    }
    await patchServer({ description: descriptionDraft }, { description: descriptionDraft });
  };

  const onAddChecklistItem = () => {
    const text = newChecklistText.trim();
    if (!text) return;
    const nextItem = {
      id: `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      text,
      done: false,
    };
    const nextChecklist = [...checklist, nextItem];

    if (!serverMode) {
      addChecklistItem(item.id, text);
      setNewChecklistText("");
      return;
    }

    void patchServer({ checklist: nextChecklist }, { checklist: nextChecklist });
    setNewChecklistText("");
  };

  const onToggleChecklistItem = (checklistItemId: string) => {
    if (!serverMode) {
      toggleChecklistItem(item.id, checklistItemId);
      return;
    }
    const nextChecklist = checklist.map((checklistItem) =>
      checklistItem.id === checklistItemId ? { ...checklistItem, done: !checklistItem.done } : checklistItem
    );
    void patchServer({ checklist: nextChecklist }, { checklist: nextChecklist });
  };

  const onRemoveChecklistItem = (checklistItemId: string) => {
    if (!serverMode) {
      removeChecklistItem(item.id, checklistItemId);
      return;
    }
    const nextChecklist = checklist.filter((checklistItem) => checklistItem.id !== checklistItemId);
    void patchServer({ checklist: nextChecklist }, { checklist: nextChecklist });
  };

  const createSubtask = async () => {
    const title = newSubtaskTitle.trim();
    if (!title || !workspaceId || !serverMode || !onItemsReplaced) return;
    setSubtaskError(null);
    const validAssigneeId = members.some((member) => member.id === item.assignee) ? item.assignee : undefined;
    const validProjectId = projects.some((project) => project.id === item.project) ? item.project : undefined;
    const response = await apiFetch("/api/work-items", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId ?? "",
      },
      body: JSON.stringify({
        workspaceId,
        projectId: validProjectId,
        parentId: item.id,
        title,
        status: "TODO",
        priority: "MEDIUM",
        assigneeId: validAssigneeId,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
      setSubtaskError(payload?.error ?? payload?.message ?? "Could not add subtask.");
      return;
    }
    const payload = (await response.json()) as { workItem: ApiWorkItem };
    const next = toUiWorkItem(payload.workItem, currentUserId ?? null);
    onItemsReplaced([next, ...drawerItems]);
    setNewSubtaskTitle("");
  };

  const setSubtaskDone = async (subtask: WorkItem, done: boolean) => {
    if (!workspaceId || !serverMode || !onItemsReplaced) return;
    const nextStatus: Status = done ? "Done" : "To Do";
    const snapshot = drawerItems;
    onItemsReplaced(drawerItems.map((candidate) => (candidate.id === subtask.id ? { ...candidate, status: nextStatus } : candidate)));
    const response = await apiFetch(
      `/api/work-items/${encodeURIComponent(subtask.id)}?workspaceId=${encodeURIComponent(workspaceId)}`,
      {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": currentUserId ?? "",
        },
        body: JSON.stringify({
          status: toApiWorkStatus(nextStatus),
          completedAt: done ? new Date().toISOString() : null,
        }),
      }
    );
    if (!response.ok) onItemsReplaced(snapshot);
  };

  const panelInitial = { opacity: 1, width: INLINE_DRAWER_WIDTH };
  const panelAnimate = { opacity: 1, width: INLINE_DRAWER_WIDTH };
  const panelExit = { opacity: 1, width: INLINE_DRAWER_WIDTH };

  return (
    <>
      <motion.aside
        key="inline-drawer"
        initial={panelInitial}
        animate={panelAnimate}
        exit={panelExit}
        transition={{ duration: 0, ease: "easeOut" }}
        className="drawer-inline flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l bg-background"
      >
      <div className="flex h-10 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3 text-[12px]">
          <span className="font-medium text-muted-foreground">Task</span>
          <StatusSelect value={item.status} onChange={(s) => { void onStatusChange(s); }} />
        </div>
        <button type="button" onClick={onClose} title="Close" aria-label="Close task drawer" className="lov-icon-btn"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <input
          ref={titleRef}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => { void onTitleCommit(); }}
          placeholder="Task title"
          className="mb-2 w-full rounded bg-transparent text-[16px] font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
        />
        {item.parentId && !parentTask && (
          <div className="mb-2 inline-flex rounded border bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground">
            Subtask
          </div>
        )}
        {parentTask && (
          <button
            type="button"
            onClick={() => onSelectItem?.(parentTask.id)}
            className="mb-2 inline-flex max-w-full items-center gap-1 rounded border bg-muted/45 px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
          >
            <span>Parent:</span>
            <span className="truncate font-medium">{parentTask.title}</span>
          </button>
        )}
        {progress.open > 0 && (
          <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
            {progress.open} open subtask{progress.open === 1 ? "" : "s"} remain. Finish or review them before closing the parent.
          </div>
        )}
        <textarea
          value={descriptionDraft}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={() => { void onDescriptionCommit(); }}
          placeholder="Add a description."
          rows={2}
          className="mb-2 min-h-14 w-full resize-y rounded-md border border-border bg-sidebar/60 px-2 py-1.5 text-[12px] leading-relaxed text-foreground/90 outline-none transition placeholder:text-muted-foreground/75 hover:border-foreground/25 hover:bg-card focus:bg-background focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
        />

        <dl className="mt-4 grid grid-cols-[72px_1fr] gap-y-2 text-[12px]">
          <dt className="pt-0.5 text-muted-foreground">Priority</dt>
          <dd>
            <PrioritySelect value={item.priority} onChange={(p) => { void onPriorityChange(p); }} />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Assignee</dt>
          <dd>
            <AssigneeSelect members={members} value={item.assignee} onChange={(id) => { void onAssigneeChange(id); }} />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Label</dt>
          <dd>
            <input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={() => {
                void onLabelCommit();
              }}
              className="h-7 w-32 rounded border bg-card px-2 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
            />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Due</dt>
          <dd>
            <DateField
              value={dueValue}
              onChange={(value) => {
                void onDueChange(value);
              }}
              className="h-7 text-[12px]"
            />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Start</dt>
          <dd>
            <DateField
              value={startValue}
              onChange={(value) => {
                void onStartChange(value);
              }}
              className="h-7 text-[12px]"
            />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Project</dt>
          <dd>
            <select
              value={item.project}
              onChange={(e) => {
                void onProjectChange(e.target.value);
              }}
              className="h-7 rounded border bg-card px-2 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </dd>
        </dl>

        <div className="mt-5 border-t pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Link2 className="h-3 w-3" /> Dependencies
            </h3>
            <button
              onClick={() => setDependencyPickerOpen((open) => !open)}
              disabled={!serverMode || dependencyCandidates.length === 0}
              className="lov-btn lov-btn-ghost h-6 px-1.5 text-[11px] disabled:opacity-50"
            >
              <Plus className="h-3 w-3" /> Blocked by
            </button>
          </div>

          {dependencyPickerOpen && (
            <>
              <div className="fixed inset-0 z-[70]" onMouseDown={() => setDependencyPickerOpen(false)} />
              <div className="relative z-[80] mb-3 max-h-52 overflow-y-auto rounded border bg-card shadow-lg">
                {dependencyCandidates.length === 0 ? (
                  <p className="px-3 py-2 text-[12px] text-muted-foreground">No same-project tasks available.</p>
                ) : (
                  dependencyCandidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      onClick={() => { void addBlocker(candidate.id); }}
                      className="lov-menu-item px-3 py-1.5 text-[13px]"
                    >
                      <StatusIcon s={candidate.status} />
                      <span className="flex-1 truncate">{candidate.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{candidate.status}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          <div className="space-y-2">
            <DependencyList
              title="Blocked by"
              empty="No blockers."
              items={blockerItems}
              links={blockedByLinks}
              onRemove={(relationId) => { void removeBlocker(relationId); }}
            />
            <DependencyList
              title="Blocking"
              empty="Not blocking other tasks."
              items={blockingItems}
            />
          </div>
        </div>

        <div className="mt-5 border-t pt-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Subtasks</h3>
            {subtasks.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {subtasks.filter((subtask) => subtask.status === "Done").length}/{subtasks.length}
              </span>
            )}
          </div>
          {subtaskError && <p className="mb-2 text-[11px] text-red-600">{subtaskError}</p>}
          <ul className="space-y-1 text-[13px]">
            {subtasks.map((subtask) => (
              <li key={subtask.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-[var(--color-hover)]">
                <TaskCompletionToggle
                  checked={subtask.status === "Done"}
                  onToggle={(checked) => { void setSubtaskDone(subtask, checked); }}
                  ariaLabel={`${subtask.status === "Done" ? "Reopen" : "Complete"} ${subtask.title}`}
                />
                <button
                  type="button"
                  onClick={() => onSelectItem?.(subtask.id)}
                  className={`min-w-0 flex-1 truncate text-left hover:underline ${subtask.status === "Done" ? "text-muted-foreground line-through" : ""}`}
                >
                  {subtask.title}
                </button>
                <Chip tone={subtask.status === "Done" ? "success" : "neutral"}>{subtask.status}</Chip>
              </li>
            ))}
            <li className="flex items-center gap-2 px-1 py-1">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={newSubtaskTitle}
                onChange={(event) => setNewSubtaskTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && newSubtaskTitle.trim()) {
                    void createSubtask();
                  }
                }}
                placeholder="Add a subtask."
                className="h-7 min-w-0 flex-1 rounded bg-transparent text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
              />
              <button
                type="button"
                onClick={() => { void createSubtask(); }}
                disabled={!newSubtaskTitle.trim()}
                className="lov-btn lov-btn-ghost h-7 px-2 text-[11px] disabled:opacity-50"
              >
                Add
              </button>
            </li>
          </ul>
        </div>

        <CompactSection title="Steps" count={checklist.length > 0 ? `${checklist.filter((c) => c.done).length}/${checklist.length}` : undefined} defaultOpen={checklist.length > 0}>
          <ul className="space-y-2 text-[13px]">
            {checklist.map((c) => (
              <li key={c.id} className="group flex items-center gap-2.5 rounded px-1 py-0.5">
                <TaskCompletionToggle
                  checked={c.done}
                  onToggle={() => onToggleChecklistItem(c.id)}
                  ariaLabel={`${c.done ? "Reopen" : "Complete"} ${c.text}`}
                />
                <span className={`flex-1 ${c.done ? "text-muted-foreground line-through" : ""}`}>{c.text}</span>
                <button
                  onClick={() => onRemoveChecklistItem(c.id)}
                  title="Remove"
                  className="lov-icon-btn h-7 w-7 opacity-0 hover:text-red-700 focus:opacity-100 group-hover:opacity-100"
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
                    onAddChecklistItem();
                  }
                }}
                placeholder={checklist.length === 0 ? "Add a checklist item." : "Add another."}
                className="h-7 flex-1 rounded bg-transparent text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
              />
            </li>
          </ul>
        </CompactSection>

        <CompactSection title="Linked notes" count={linkedNotes.length} defaultOpen={linkedNotes.length > 0}>
          <div className="mb-2 flex items-center justify-between">
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
                  <Link href={`/app/notes?id=${n.id}`} className="min-w-0 flex-1 truncate text-foreground hover:underline">
                    {n.title}
                  </Link>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{n.updated}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      unlinkNote(n.id);
                    }}
                    title={`Unlink ${n.title}`}
                    aria-label={`Unlink ${n.title}`}
                    className="lov-icon-btn h-6 w-6 hover:text-red-700"
                  >
                    <X className="h-3 w-3" />
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
        </CompactSection>

        {serverMode && (
          <CompactSection title="Comments" count={comments.length} defaultOpen={initialFocusSection === "comments"} ref={commentsSectionRef}>
            <div className="mb-2 flex items-center gap-1.5">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <MessageSquare className="h-3 w-3" /> Comments
              </h3>
              <span className="text-[11px] text-muted-foreground">{comments.length}</span>
            </div>

            <div className="mb-4">
              <textarea
                ref={commentRef}
                value={commentDraft}
                onChange={(event) => setCommentDraft(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void postComment();
                  }
                }}
                placeholder="Add a comment. Use @name to mention someone."
                rows={3}
                className="w-full resize-y rounded border bg-card px-2 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
              />

              {mentionCandidates.length > 0 && (
                <div className="mt-1 rounded border bg-card p-1">
                  {mentionCandidates.slice(0, 4).map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => insertMention(member)}
                      className="lov-menu-item px-2 py-1 text-[12px]"
                    >
                      {member.name}
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    void postComment();
                  }}
                  disabled={!commentDraft.trim() || postingComment}
                  className="lov-btn lov-btn-primary h-7 px-2 text-[11px] disabled:opacity-50"
                >
                  <Send className="h-3 w-3" />
                  Comment
                </button>
              </div>
            </div>

            {commentsLoading ? (
              <p className="px-1 text-[12px] text-muted-foreground">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="px-1 text-[12px] text-muted-foreground">No comments yet.</p>
            ) : (
              <ul className="divide-y">
                {comments.map((comment) => {
                  const authorName =
                    comment.author.name ??
                    members.find((member) => member.id === comment.author.id)?.name ??
                    comment.author.email;
                  return (
                    <li key={comment.id} className="py-2">
                      <div className="mb-0.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="truncate font-medium text-foreground">{authorName}</span>
                        <span className="shrink-0">{formatTimestamp(comment.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-[12px]">{comment.body}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CompactSection>
        )}

        {serverMode && (
          <CompactSection title="History" count={historyEvents.length} defaultOpen={initialFocusSection === "history"} ref={historySectionRef}>
            <div className="mb-2 flex items-center gap-1.5">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <History className="h-3 w-3" /> History
              </h3>
              <span className="text-[11px] text-muted-foreground">{historyEvents.length}</span>
            </div>

            {commentsLoading ? (
              <p className="px-1 text-[12px] text-muted-foreground">Loading history...</p>
            ) : historyEvents.length === 0 ? (
              <p className="px-1 text-[12px] text-muted-foreground">No history yet.</p>
            ) : (
              <ul className="divide-y">
                {historyEvents.map((event) => (
                  <li key={event.id} className="py-2">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="truncate font-medium">
                        {event.actor?.name ?? event.actor?.email ?? "System"} · {prettyActionLabel(event.action)}
                      </span>
                      <span className="shrink-0 text-muted-foreground">{formatTimestamp(event.createdAt)}</span>
                    </div>
                    <p className="text-[12px] text-muted-foreground">{event.summary ?? "Updated work item"}</p>
                  </li>
                ))}
              </ul>
            )}
          </CompactSection>
        )}
      </div>
      </motion.aside>
    </>
  );
}

const CompactSection = forwardRef<HTMLDivElement, { title: string; count?: number | string; defaultOpen?: boolean; children: ReactNode }>(
  function CompactSection({ title, count, defaultOpen = false, children }, ref) {
    return (
      <div ref={ref}>
        <details open={defaultOpen} className="group mt-4 border-t pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground">
            <span className="transition group-open:rotate-90">›</span>
            <span>{title}</span>
            {count !== undefined && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium normal-case tracking-normal">{count}</span>}
          </summary>
          <div className="mt-3">{children}</div>
        </details>
      </div>
    );
  }
);

function StatusSelect({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <StatusIcon s={value} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Status)}
        className="rounded bg-transparent text-[12px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
      >
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </label>
  );
}

function AssigneeSelect({ members, value, onChange }: { members: { id: string; name: string }[]; value: string; onChange: (id: string) => void }) {
  const fallback = members[0] ?? { id: "unassigned", name: "Unassigned" };
  const current = members.find((member) => member.id === value) ?? fallback;
  const options = members.length > 0 ? members : [fallback];
  return (
    <span className="flex items-center gap-2">
      <Avatar id={current.id} name={current.name} />
      <select
        value={members.some((member) => member.id === value) ? value : current.id}
        onChange={(e) => onChange(e.target.value)}
        className="rounded bg-transparent text-[12px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
      >
        {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </span>
  );
}

function PrioritySelect({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <span className="flex items-center gap-1.5">
      <PriorityIndicator priority={value} />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as Priority)}
        className="rounded bg-transparent text-[12px] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
      >
        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
    </span>
  );
}

function DependencyList({
  title,
  empty,
  items,
  links,
  onRemove,
}: {
  title: string;
  empty: string;
  items: WorkItem[];
  links?: Array<{ relationId: string; taskId: string; direction: "blockedBy" | "blocking" }>;
  onRemove?: (relationId: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <p className="px-2 text-[12px] text-muted-foreground/60">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((dependency) => {
            const relationId = links?.find((link) => link.taskId === dependency.id)?.relationId;
            return (
              <li key={dependency.id} className="group flex items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-[var(--color-hover)]">
                <StatusIcon s={dependency.status} />
                <span className="min-w-0 flex-1 truncate">{dependency.title}</span>
                <Chip tone={dependency.status === "Done" ? "success" : "neutral"}>{dependency.status}</Chip>
                {relationId && onRemove ? (
                  <button
                    type="button"
                    onClick={() => onRemove(relationId)}
                    title={`Remove dependency on ${dependency.title}`}
                    aria-label={`Remove dependency on ${dependency.title}`}
                    className="lov-icon-btn h-6 w-6 hover:text-red-700"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export { Chip };
