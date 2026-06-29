"use client";

import { ArrowDown, ArrowRight, ArrowUp, type LucideIcon } from "lucide-react";
import type { Priority } from "@/lib/mock-data";
import { DEFAULT_PRIORITY_DISPLAY_STYLE, type PriorityDisplayStyle } from "@/lib/appearance-defaults";
import { useStore } from "@/lib/store";

const PRIORITY_LABEL: Record<Priority, string> = {
  High: "High",
  Medium: "Medium",
  Low: "Low",
};

const PRIORITY_SHORT_LABEL: Record<Priority, string> = {
  High: "P1",
  Medium: "P2",
  Low: "P3",
};

const PRIORITY_TEXT_TONE: Record<Priority, string> = {
  High: "text-red-700 dark:text-red-300",
  Medium: "text-amber-700 dark:text-amber-300",
  Low: "text-sky-700 dark:text-sky-300",
};

const PRIORITY_BADGE_TONE: Record<Priority, string> = {
  High: "border-red-300 bg-red-50 text-red-700 dark:border-red-900/70 dark:bg-red-950/30 dark:text-red-300",
  Medium: "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300",
  Low: "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/30 dark:text-sky-300",
};

const DOT_TONE: Record<Priority, string> = {
  High: "bg-red-600",
  Medium: "bg-amber-500",
  Low: "bg-sky-500",
};

const ARROW_TONE: Record<Priority, string> = {
  High: "text-red-600 dark:text-red-300",
  Medium: "text-amber-600 dark:text-amber-300",
  Low: "text-sky-600 dark:text-sky-300",
};

const ARROW_ICON: Record<Priority, LucideIcon> = {
  High: ArrowUp,
  Medium: ArrowRight,
  Low: ArrowDown,
};

export function PriorityIndicator({
  priority,
  style,
  className = "",
}: {
  priority: Priority;
  style?: PriorityDisplayStyle;
  className?: string;
}) {
  const settingStyle = useStore((s) => s.settings.priorityDisplayStyle);
  const effective = style ?? settingStyle ?? DEFAULT_PRIORITY_DISPLAY_STYLE;
  const label = PRIORITY_LABEL[priority];

  if (effective === "dot") {
    return (
      <span
        title={`${label} priority`}
        aria-label={`${label} priority`}
        data-priority={priority}
        data-priority-style={effective}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center whitespace-nowrap ${className}`}
      >
        <span className={`h-2 w-2 rounded-full ${DOT_TONE[priority]}`} />
      </span>
    );
  }

  if (effective === "badge") {
    return (
      <span
        title={`${label} priority`}
        aria-label={`${label} priority`}
        data-priority={priority}
        data-priority-style={effective}
        className={`inline-flex h-5 shrink-0 items-center whitespace-nowrap rounded border px-1.5 font-mono text-[10px] font-semibold leading-none ${PRIORITY_BADGE_TONE[priority]} ${className}`}
      >
        {PRIORITY_SHORT_LABEL[priority]}
      </span>
    );
  }

  if (effective === "arrow") {
    const Icon = ARROW_ICON[priority];
    return (
      <span
        title={`${label} priority`}
        aria-label={`${label} priority`}
        data-priority={priority}
        data-priority-style={effective}
        className={`inline-flex h-4 w-4 shrink-0 items-center justify-center whitespace-nowrap ${ARROW_TONE[priority]} ${className}`}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      title={`${label} priority`}
      data-priority={priority}
      data-priority-style={effective}
      className={`inline-flex shrink-0 items-center whitespace-nowrap text-[11px] font-semibold leading-none ${PRIORITY_TEXT_TONE[priority]} ${className}`}
    >
      {label}
    </span>
  );
}
