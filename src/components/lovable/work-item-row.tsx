"use client";

import { MoreHorizontal, Trash2, ArrowRight } from "lucide-react";
import type { WorkItem, Status } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import { formatDueLabel } from "@/lib/dates";
import { Avatar, PriorityIcon, StatusIcon } from "./icons";
import { Chip } from "./page";
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
}: {
  item: WorkItem;
  selected?: boolean;
  onClick?: () => void;
  onMove?: (status: Status) => void;
  onDelete?: () => void;
  membersOverride?: { id: string; name: string }[];
}) {
  const storeMembers = useStore((s) => s.members);
  const density = useStore((s) => s.settings.density);
  const members = membersOverride ?? storeMembers;
  const m =
    members.find((member) => member.id === item.assignee) ??
    storeMembers.find((member) => member.id === item.assignee) ??
    { id: item.assignee, name: item.assignee.slice(0, 8) };
  const completed = item.status === "Done";
  const rowPadding = density === "compact" ? "py-1.5" : "py-2.5";

  const toggleComplete = () => {
    onMove?.(completed ? "In Progress" : "Done");
  };

  return (
    <div
      className={`group grid w-full grid-cols-[20px_48px_minmax(0,1fr)_minmax(54px,0.65fr)_minmax(76px,0.8fr)_minmax(54px,0.55fr)_minmax(48px,0.45fr)_24px] items-center gap-2 border-b px-2 text-[13px] ${rowPadding} ${selected ? "bg-primary/[0.04]" : "hover:bg-[var(--color-hover)]/40"} ${completed ? "text-muted-foreground" : ""}`}>
      <input
        type="checkbox"
        checked={completed}
        onChange={toggleComplete}
        onClick={(event) => event.stopPropagation()}
        className="h-3.5 w-3.5 accent-[var(--color-primary)]"
        aria-label={`${completed ? "Reopen" : "Complete"} ${item.title}`}
      />
      <span className="font-mono text-[11px] text-muted-foreground">{item.id}</span>
      <button
        type="button"
        onClick={onClick}
        title={item.title}
        className={`min-w-0 truncate text-left font-medium hover:underline focus:outline-none focus-visible:underline ${completed ? "line-through decoration-muted-foreground/60" : ""}`}
      >
        {item.title}
      </button>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <PriorityIcon p={item.priority} />
        <span className="text-[12px]">{item.priority}</span>
      </span>
      <span className="flex items-center gap-2 text-[12px]">
        <Avatar id={m.id} name={m.name} />
        <span className="truncate text-muted-foreground">{m.name}</span>
      </span>
      <span><Chip>{item.label}</Chip></span>
      <span className="text-[12px] text-muted-foreground">{formatDueLabel(item.due)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            title="More actions"
            onClick={(e) => e.stopPropagation()}
            className="lov-icon-btn opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-[11px] text-muted-foreground">{item.id}</DropdownMenuLabel>
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
    </div>
  );
}
