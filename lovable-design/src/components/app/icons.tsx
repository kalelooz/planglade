import { ArrowUp, ArrowRight, ArrowDown, Circle, CircleDashed, CircleDot, CircleCheck, Eye } from "lucide-react";
import type { Priority, Status } from "@/lib/mock-data";

export function PriorityIcon({ p, className = "" }: { p: Priority; className?: string }) {
  const Icon = p === "High" ? ArrowUp : p === "Medium" ? ArrowRight : ArrowDown;
  const color = p === "High" ? "text-priority-high" : p === "Medium" ? "text-priority-med" : "text-priority-low";
  return <Icon className={`h-3.5 w-3.5 ${color} ${className}`} strokeWidth={2.25} />;
}

export function StatusIcon({ s, className = "" }: { s: Status; className?: string }) {
  const base = `h-3.5 w-3.5 ${className}`;
  if (s === "Backlog") return <CircleDashed className={`${base} text-muted-foreground`} />;
  if (s === "To Do") return <Circle className={`${base} text-muted-foreground`} />;
  if (s === "In Progress") return <CircleDot className={`${base} text-primary`} />;
  if (s === "In Review") return <Eye className={`${base} text-amber-600`} />;
  return <CircleCheck className={`${base} text-emerald-600`} />;
}

export function Avatar({ id, name, size = 20 }: { id: string; name?: string; size?: number }) {
  const color = `oklch(0.62 0.08 ${(id.charCodeAt(0) * 7) % 360})`;
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-[10px] text-white"
      style={{ width: size, height: size, background: color }}
    >
      {id}
    </span>
  );
}
