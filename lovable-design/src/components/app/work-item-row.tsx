import { MoreHorizontal } from "lucide-react";
import type { WorkItem } from "@/lib/mock-data";
import { byInitials } from "@/lib/mock-data";
import { Avatar, PriorityIcon } from "./icons";
import { Chip } from "./page";

function fmt(d: string) {
  const date = new Date(d);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WorkItemRow({ item, selected, onClick }: { item: WorkItem; selected?: boolean; onClick?: () => void }) {
  const m = byInitials(item.assignee);
  return (
    <div onClick={onClick}
      className={`group grid cursor-default grid-cols-[28px_72px_1fr_88px_140px_120px_72px_28px] items-center gap-2 border-b px-4 text-[13px] ${selected ? "bg-primary/[0.04]" : "hover:bg-hover/60"}`}>
      <input type="checkbox" className="h-3 w-3 opacity-0 accent-primary group-hover:opacity-100" />
      <span className="font-mono text-[11px] text-muted-foreground">{item.id}</span>
      <span className="truncate py-2 font-medium">{item.title}</span>
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <PriorityIcon p={item.priority} />
        <span className="text-[12px]">{item.priority}</span>
      </span>
      <span className="flex items-center gap-2 text-[12px]">
        <Avatar id={m.id} name={m.name} />
        <span className="truncate text-muted-foreground">{m.name}</span>
      </span>
      <span><Chip>{item.label}</Chip></span>
      <span className="text-[12px] text-muted-foreground">{fmt(item.due)}</span>
      <button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-hover group-hover:opacity-100">
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
