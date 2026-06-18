"use client";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { X, Link2, Plus, Trash2, FileText, MessageSquare, Send, History } from "lucide-react";
import Link from "next/link";
import type { WorkItem, Status, Priority } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { getDatePart, getTimePart } from "@/lib/dates";
import { Avatar } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";
import { PrioritySelect, StatusSelect } from "@/components/tasks/task-metadata";
import { toApiWorkPriority, toApiWorkStatus, toIsoDateTime } from "@/lib/server-ui-mappers";

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
type DrawerPlacement = "inline" | "overlay";

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
  onItemPatched,
  onItemReplaced,
  placement = "inline",
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
  onItemPatched?: (id: string, patch: Partial<WorkItem>) => void;
  onItemReplaced?: (item: WorkItem) => void;
  placement?: DrawerPlacement;
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
          onItemPatched={onItemPatched}
          onItemReplaced={onItemReplaced}
          placement={placement}
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
  onItemPatched?: (id: string, patch: Partial<WorkItem>) => void;
  onItemReplaced?: (item: WorkItem) => void;
  placement: DrawerPlacement;
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
  onItemPatched,
  onItemReplaced,
  placement,
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
  const [notePickerOpen, setNotePickerOpen] = useState(false);
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
  const reduceMotion = useReducedMotion();

  const members = membersOverride ?? storeMembers;
  const projects = projectsOverride ?? storeProjects;
  const notes = notesOverride ?? storeNotes;
  const serverMode = Boolean(workspaceId && onItemPatched);

  const linkedNoteIds = item.noteIds ?? [];
  const linkedNotes = notes.filter((n) => linkedNoteIds.includes(n.id));
  const linkableNotes = notes.filter((n) => !linkedNoteIds.includes(n.id));
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

    const response = await fetch(
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
      const response = await fetch(`/api/labels?workspaceId=${encodeURIComponent(workspaceId)}`, {
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
  }, [item.id, item.title, item.description, item.label]);

  useEffect(() => {
    if (!serverMode || !workspaceId) return;
    let active = true;

    void (async () => {
      setCommentsLoading(true);
      try {
        const [commentsRes, historyRes] = await Promise.all([
          fetch(
            `/api/work-items/${encodeURIComponent(item.id)}/comments?workspaceId=${encodeURIComponent(workspaceId)}`,
            {
              cache: "no-store",
              headers: { "x-flowboard-user-id": currentUserId ?? "" },
            }
          ),
          fetch(
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

    const response = await fetch("/api/labels", {
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
      const response = await fetch(
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

      const historyResponse = await fetch(
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

  const panelInitial = reduceMotion ? { opacity: 1 } : { opacity: 0, x: 24 };
  const panelAnimate = { opacity: 1, x: 0 };
  const panelExit = reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 };

  return (
    <>
      {placement === "overlay" && (
        <motion.div
          key={`backdrop-${item.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
          onClick={onClose}
          className="fixed inset-0 z-[80] bg-background/35 backdrop-blur-[1px]"
        />
      )}
      <motion.aside
        key={item.id}
        initial={panelInitial}
        animate={panelAnimate}
        exit={panelExit}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={placement === "overlay"
          ? "fixed inset-y-0 right-0 z-[90] flex w-full max-w-[420px] flex-col border-l border-zinc-200/80 bg-white shadow-xl"
          : "flex w-full min-w-0 flex-col rounded-lg border border-zinc-200/80 bg-white shadow-xs lg:sticky lg:top-4 lg:max-h-[calc(100vh-9rem)] lg:w-[360px] lg:shrink-0"}
      >
      <div className="flex h-11 items-center justify-between border-b border-zinc-100 px-4">
        <div className="flex items-center gap-3 text-[12px]">
          <span className="font-medium text-muted-foreground">Task</span>
          <StatusSelect value={item.status} onChange={(s) => { void onStatusChange(s); }} />
        </div>
        <button onClick={onClose} title="Close" className="lov-icon-btn"><X className="h-3.5 w-3.5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Task details</div>
        <input
          ref={titleRef}
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => { void onTitleCommit(); }}
          placeholder="Task title"
          className="mb-1.5 w-full bg-transparent text-[17px] font-semibold tracking-tight outline-none focus:underline focus:underline-offset-2"
        />
        <textarea
          value={descriptionDraft}
          onChange={(e) => setDescriptionDraft(e.target.value)}
          onBlur={() => { void onDescriptionCommit(); }}
          placeholder="Add a description."
          rows={2}
          className="mb-2 w-full resize-y bg-transparent text-[13px] leading-relaxed text-foreground/90 outline-none placeholder:text-muted-foreground/60"
        />

        <dl className="mt-4 grid grid-cols-[80px_1fr] gap-y-3 text-[12px]">
          <dt className="pt-0.5 text-muted-foreground">Assignee</dt>
          <dd>
            <AssigneeSelect members={members} value={item.assignee} onChange={(id) => { void onAssigneeChange(id); }} />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Priority</dt>
          <dd>
            <PrioritySelect value={item.priority} onChange={(p) => { void onPriorityChange(p); }} />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Due</dt>
          <dd>
            <input
              type="date"
              value={dueValue}
              onChange={(e) => {
                void onDueChange(e.target.value);
              }}
              className="rounded border bg-card px-2 py-1 text-[12px] outline-none focus:border-ring"
            />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Start</dt>
          <dd>
            <input
              type="date"
              value={startValue}
              onChange={(e) => {
                void onStartChange(e.target.value);
              }}
              className="rounded border bg-card px-2 py-1 text-[12px] outline-none focus:border-ring"
            />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Label</dt>
          <dd>
            <input
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onBlur={() => {
                void onLabelCommit();
              }}
              className="w-32 rounded border bg-card px-2 py-1 text-[12px] outline-none focus:border-ring"
            />
          </dd>

          <dt className="pt-0.5 text-muted-foreground">Project</dt>
          <dd>
            <select
              value={item.project}
              onChange={(e) => {
                void onProjectChange(e.target.value);
              }}
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

        <div className="mt-5 border-t pt-4">
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
                  onChange={() => onToggleChecklistItem(c.id)}
                  className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                />
                <span className={`flex-1 ${c.done ? "text-muted-foreground line-through" : ""}`}>{c.text}</span>
                <button
                  onClick={() => onRemoveChecklistItem(c.id)}
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
                    onAddChecklistItem();
                  }
                }}
                placeholder={checklist.length === 0 ? "Add a checklist item." : "Add another."}
                className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/60"
              />
            </li>
          </ul>
        </div>

        <div className="mt-5 border-t pt-4">
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

        {serverMode && (
          <div ref={commentsSectionRef} className="mt-5 border-t pt-4">
            <div className="mb-3 flex items-center gap-1.5">
              <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <MessageSquare className="h-3 w-3" /> Comments
              </h3>
              <span className="text-[11px] text-muted-foreground">{comments.length}</span>
            </div>

            <div className="mb-3">
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
                className="w-full resize-y rounded border bg-card px-2 py-1.5 text-[12px] outline-none focus:border-ring"
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
              <ul className="space-y-2">
                {comments.map((comment) => {
                  const authorName =
                    comment.author.name ??
                    members.find((member) => member.id === comment.author.id)?.name ??
                    comment.author.email;
                  return (
                    <li key={comment.id} className="rounded border bg-card px-2 py-1.5">
                      <div className="mb-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                        <span className="truncate font-medium text-foreground">{authorName}</span>
                        <span className="shrink-0">{formatTimestamp(comment.createdAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-[12px]">{comment.body}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}

        {serverMode && (
          <div ref={historySectionRef} className="mt-5 border-t pt-4">
            <div className="mb-3 flex items-center gap-1.5">
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
              <ul className="space-y-2">
                {historyEvents.map((event) => (
                  <li key={event.id} className="rounded border bg-card px-2 py-1.5">
                    <div className="mb-1 flex items-center justify-between gap-2 text-[11px]">
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
          </div>
        )}
      </div>
      </motion.aside>
    </>
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
        className="bg-transparent text-[12px] outline-none hover:underline"
      >
        {options.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
      </select>
    </span>
  );
}

export { Chip };
