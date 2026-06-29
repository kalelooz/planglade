"use client";

import { MoreHorizontal, Trash2, ArrowRight } from "lucide-react";
import type { WorkItem, Status } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { formatDueLabel } from "@/lib/dates";
import { Avatar, StatusIcon } from "./icons";
import { PriorityIndicator } from "./priority-indicator";
import { Chip } from "./page";
import { FlowMetaPill, FlowRow } from "./flow-ui";
import { DependencyBadge } from "./dependency-badge";
import { TaskCompletionToggle } from "./task-completion-toggle";
import { getParentTask, subtaskProgress } from "@/lib/work-item-hierarchy";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

const STATUSES: Status[] = ["Backlog", "To Do", "In Progress", "In Review", "Done"];

export function WorkItemRow({
  item,
  selected,
  onClick,
  onMove,
  onDelete,
  membersOverride,
  allItems,
}: {
  item: WorkItem;
  selected?: boolean;
  onClick?: () => void;
  onMove?: (status: Status) => void;
  onDelete?: () => void;
  membersOverride?: { id: string; name: string }[];
  allItems?: WorkItem[];
}) {
  const storeMembers = useStore((s) => s.members);
  const density = useStore((s) => s.settings.density);
  const members = membersOverride ?? storeMembers;
  const m =
    members.find((member) => member.id === item.assignee) ??
    storeMembers.find((member) => member.id === item.assignee) ??
    { id: item.assignee, name: item.assignee.slice(0, 8) };
  const completed = item.status === "Done";
  const rowPadding = density === "compact" ? "py-2" : "py-3";
  const parentTask = allItems ? getParentTask(item, allItems) : null;
  const progress = allItems ? subtaskProgress(item, allItems) : { done: 0, total: 0, open: 0 };

  const toggleComplete = () => {
    onMove?.(completed ? "In Progress" : "Done");
  };

  return (
    <FlowRow
      selected={selected}
      completed={completed}
      interactive
      onClick={onClick}
      className={`group grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 px-2 text-[13px] sm:grid-cols-[auto_minmax(22rem,1fr)_96px_minmax(6rem,8rem)_auto_104px_32px] ${rowPadding}`}
    >
      <TaskCompletionToggle
        checked={completed}
        onToggle={toggleComplete}
        ariaLabel={`${completed ? "Reopen" : "Complete"} ${item.title}`}
      />
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick?.();
        }}
        title={item.title}
        className={`-mx-1 min-w-0 truncate rounded px-1 py-1 text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 ${completed ? "text-muted-foreground line-through" : ""}`}
      >
        <span className="inline-flex min-w-0 items-center gap-2">
          {item.parentId && <span className="shrink-0 text-muted-foreground">↳</span>}
          <span className="truncate">{item.title}</span>
          <DependencyBadge item={item} allItems={allItems} />
          {progress.total > 0 && <Chip tone={progress.open > 0 ? "warning" : "success"}>{progress.done}/{progress.total} subtasks</Chip>}
        </span>
        {parentTask && <span className="mt-0.5 block truncate text-[11px] font-normal text-muted-foreground">Parent: {parentTask.title}</span>}
      </button>
      <span className="col-start-2 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:contents">
        <FlowMetaPill className="border-transparent bg-transparent">
          <PriorityIndicator priority={item.priority} />
        </FlowMetaPill>
        <span className="flex min-w-0 max-w-36 items-center gap-2 text-[12px] sm:max-w-none">
          <Avatar id={m.id} name={m.name} />
          <span className="truncate text-foreground/75">{m.name}</span>
        </span>
        <span className="shrink-0"><Chip>{item.label}</Chip></span>
        <FlowMetaPill className="border-transparent bg-transparent">{formatDueLabel(item.due)}</FlowMetaPill>
      </span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="More actions"
            onClick={(e) => e.stopPropagation()}
            className="lov-icon-btn opacity-0 focus:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-[11px] text-muted-foreground">Task actions</DropdownMenuLabel>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRight className="h-3.5 w-3.5" /> Move to
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-40">
              {STATUSES.filter((s) => s !== item.status).map((s) => (
                <DropdownMenuItem key={s} onSelect={() => onMove?.(s)}>
                  <StatusIcon s={s} /> {s}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => onDelete?.()}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete task
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </FlowRow>
  );
}
