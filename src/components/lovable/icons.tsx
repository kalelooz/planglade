"use client";
import { ArrowUp, ArrowRight, ArrowDown, Circle, CircleDashed, CircleDot, CircleCheck, Eye, Octagon, Triangle } from "lucide-react";
import type { Priority, Status } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import type { PriorityStyle } from "@/lib/store";

const ARROW_ICON = { High: ArrowUp, Medium: ArrowRight, Low: ArrowDown } as const;

const COLOR_TEXT: Record<Priority, string> = {
  High: "text-[var(--color-priority-high)]",
  Medium: "text-[var(--color-priority-med)]",
  Low: "text-[var(--color-priority-low)]",
};

const LABEL_CLASS: Record<Priority, string> = {
  High: "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  Medium: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  Low: "border-zinc-300 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400",
};

const LABEL_TEXT: Record<Priority, string> = { High: "P1", Medium: "P2", Low: "P3" };

export function PriorityIcon({ p, className = "", style }: { p: Priority; className?: string; style?: PriorityStyle }) {
  const settingStyle = useStore((s) => s.settings.priorityStyle);
  const effective: PriorityStyle = style ?? settingStyle ?? "arrows";

  if (effective === "labels") {
    return (
      <span
        title={`${p} priority`}
        className={`inline-flex h-[18px] min-w-[22px] items-center justify-center rounded border px-1 font-mono text-[10px] font-semibold ${LABEL_CLASS[p]} ${className}`}
      >
        {LABEL_TEXT[p]}
      </span>
    );
  }

  if (effective === "shapes") {
    if (p === "High") {
      return <Octagon className={`h-3.5 w-3.5 fill-red-500 stroke-red-700 ${className}`} strokeWidth={1.5} aria-label="High priority" />;
    }
    if (p === "Medium") {
      return <Triangle className={`h-3.5 w-3.5 fill-amber-400 stroke-amber-700 ${className}`} strokeWidth={1.5} aria-label="Medium priority" />;
    }
    return <Circle className={`h-3.5 w-3.5 fill-emerald-500 stroke-emerald-700 ${className}`} strokeWidth={1.5} aria-label="Low priority" />;
  }

  // arrows (default)
  const Icon = ARROW_ICON[p];
  return <Icon className={`h-3.5 w-3.5 ${COLOR_TEXT[p]} ${className}`} strokeWidth={2.25} aria-label={`${p} priority`} />;
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
