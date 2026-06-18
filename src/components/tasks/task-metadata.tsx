"use client";

import { StatusIcon, PriorityIcon } from "@/components/lovable/icons";
import { cn } from "@/lib/utils";
import { formatDueLabel } from "@/lib/dates";
import type { Priority, Status } from "@/lib/mock-data";
import type { ReactNode } from "react";

export const TASK_STATUSES: Status[] = ["Backlog", "To Do", "In Progress", "In Review", "Done"];
export const TASK_PRIORITIES: Priority[] = ["High", "Medium", "Low"];

export function taskPriorityClass(priority: Priority) {
  if (priority === "High") return "border-red-200 bg-red-50 text-red-700";
  if (priority === "Medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

export function taskStatusClass(status: Status) {
  if (status === "Done") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "In Review") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "In Progress") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-zinc-200 bg-zinc-50 text-zinc-600";
}

export function TaskMetaChip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex h-5 w-fit items-center gap-1 rounded border px-1.5 text-[11px] leading-none", className)}>
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <TaskMetaChip className={taskPriorityClass(priority)}>
      <PriorityIcon p={priority} />
      {priority}
    </TaskMetaChip>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  return (
    <TaskMetaChip className={taskStatusClass(status)}>
      <StatusIcon s={status} />
      {status}
    </TaskMetaChip>
  );
}

export function ProjectTagMeta({ project, tag }: { project?: string; tag?: string }) {
  return (
    <>
      {project ? <span className="max-w-[16rem] truncate">{project}</span> : null}
      {tag ? <span className="truncate text-zinc-400">{tag}</span> : null}
    </>
  );
}

export function DueMeta({ due, overdue }: { due?: string; overdue?: boolean }) {
  return <span className={cn("text-[11px]", overdue ? "font-medium text-red-700" : "text-zinc-500")}>{due ? formatDueLabel(due) : "No date"}</span>;
}

export function StatusSelect({ value, onChange }: { value: Status; onChange: (s: Status) => void }) {
  return (
    <label className={cn("inline-flex h-6 max-w-full items-center gap-1 rounded border px-1.5 text-[11px]", taskStatusClass(value))}>
      <StatusIcon s={value} />
      <select value={value} onChange={(e) => onChange(e.target.value as Status)} className="min-w-0 max-w-full bg-transparent outline-none">
        {TASK_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
      </select>
    </label>
  );
}

export function PrioritySelect({ value, onChange }: { value: Priority; onChange: (p: Priority) => void }) {
  return (
    <label className={cn("inline-flex h-6 items-center gap-1 rounded border px-1.5 text-[11px]", taskPriorityClass(value))}>
      <PriorityIcon p={value} />
      <select value={value} onChange={(e) => onChange(e.target.value as Priority)} className="bg-transparent outline-none">
        {TASK_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
      </select>
    </label>
  );
}
