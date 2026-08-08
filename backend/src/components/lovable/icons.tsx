"use client";
import type { CSSProperties } from "react";
import { ArrowUp, ArrowRight, ArrowDown, Circle, CircleDashed, CircleDot, CircleCheck, Eye, Octagon, Triangle } from "lucide-react";
import BoringAvatar from "boring-avatars";
import type { Priority, Status } from "@/lib/mock-data";
import { useStore } from "@/lib/store";
import type { PriorityDisplayStyle } from "@/lib/store";

const ARROW_ICON = { High: ArrowUp, Medium: ArrowRight, Low: ArrowDown } as const;

const PRIORITY_COLOR: Record<Priority, string> = {
  High: "var(--color-foreground)",
  Medium: "var(--color-muted-foreground)",
  Low: "oklch(0.705 0.015 286)",
};

const LABEL_STYLE: Record<Priority, CSSProperties> = {
  High: {
    color: "var(--color-foreground)",
    borderColor: "oklch(0.705 0.015 286)",
    background: "oklch(0.92 0.004 286)",
  },
  Medium: {
    color: "var(--color-muted-foreground)",
    borderColor: "oklch(0.87 0.006 286)",
    background: "oklch(0.967 0.001 286)",
  },
  Low: {
    color: "oklch(0.705 0.015 286)",
    borderColor: "oklch(0.92 0.004 286)",
    background: "oklch(0.985 0 0)",
  },
};

const LABEL_TEXT: Record<Priority, string> = { High: "P1", Medium: "P2", Low: "P3" };

type LegacyPriorityStyle = PriorityDisplayStyle | "arrows" | "labels" | "shapes";

function normalizePriorityStyle(style: LegacyPriorityStyle | undefined): LegacyPriorityStyle {
  if (style === "text") return "arrows";
  if (style === "badge") return "labels";
  if (style === "dot") return "shapes";
  return style ?? "arrows";
}

export function PriorityIcon({ p, className = "", style }: { p: Priority; className?: string; style?: LegacyPriorityStyle }) {
  const settingStyle = useStore((s) => s.settings.priorityDisplayStyle);
  const effective = normalizePriorityStyle(style ?? settingStyle);

  if (effective === "labels") {
    return (
      <span
        title={`${p} priority`}
        style={LABEL_STYLE[p]}
        className={`inline-flex h-[18px] min-w-[24px] items-center justify-center rounded border px-1 font-mono text-[10px] font-bold ${className}`}
      >
        {LABEL_TEXT[p]}
      </span>
    );
  }

  if (effective === "shapes") {
    if (p === "High") {
      return <Octagon style={{ color: PRIORITY_COLOR.High, fill: "oklch(0.21 0.006 286)" }} className={`h-3.5 w-3.5 ${className}`} strokeWidth={1.7} aria-label="High priority" />;
    }
    if (p === "Medium") {
      return <Triangle style={{ color: PRIORITY_COLOR.Medium, fill: "oklch(0.442 0.017 286)" }} className={`h-3.5 w-3.5 ${className}`} strokeWidth={1.7} aria-label="Medium priority" />;
    }
    return <Circle style={{ color: PRIORITY_COLOR.Low, fill: "oklch(0.87 0.006 286)" }} className={`h-3.5 w-3.5 ${className}`} strokeWidth={1.7} aria-label="Low priority" />;
  }

  // arrows (default)
  const Icon = ARROW_ICON[p];
  return <Icon style={{ color: PRIORITY_COLOR[p] }} className={`h-3.5 w-3.5 ${className}`} strokeWidth={2.8} aria-label={`${p} priority`} />;
}

export function StatusIcon({ s, className = "" }: { s: Status; className?: string }) {
  const base = `h-3.5 w-3.5 ${className}`;
  if (s === "Backlog") return <CircleDashed className={`${base} text-muted-foreground`} />;
  if (s === "To Do") return <Circle className={`${base} text-muted-foreground`} />;
  if (s === "In Progress") return <CircleDot className={`${base} text-primary`} />;
  if (s === "In Review") return <Eye className={`${base} text-amber-600`} />;
  return <CircleCheck className={`${base} text-muted-foreground`} />;
}

export function Avatar({ id, name, size = 20 }: { id: string; name?: string; size?: number }) {
  // Look up the member to check if they've set a Boring Avatar.
  const member = useStore((s) => s.members.find((m) => m.id === id));
  if (member?.avatar) {
    const seed = member.avatar.seed ?? member.name;
    return (
      <span title={name ?? member.name} className="inline-flex shrink-0 overflow-hidden rounded-full" style={{ width: size, height: size }}>
        <BoringAvatar size={size} name={seed} variant={member.avatar.variant} colors={member.avatar.colors} />
      </span>
    );
  }
  // Fallback: toned-down initials chip.
  const hue = (id.charCodeAt(0) * 53) % 360;
  const bg = `oklch(0.94 0.03 ${hue})`;
  const fg = `oklch(0.38 0.06 ${hue})`;
  const label = name
    ? name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : id.slice(0, 2).toUpperCase();
  return (
    <span
      title={name}
      className="inline-flex shrink-0 items-center justify-center rounded-full font-medium text-[10px]"
      style={{ width: size, height: size, background: bg, color: fg }}
    >
      {label || id.slice(0, 2).toUpperCase()}
    </span>
  );
}
