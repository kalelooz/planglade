import type { KeyboardEventHandler, ReactNode } from "react";

import { cn } from "@/lib/utils";

type FlowHeaderProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  compact?: boolean;
};

export function FlowHeader({ eyebrow, title, subtitle, actions, compact = false }: FlowHeaderProps) {
  return (
    <div className={cn("flow-header", compact ? "min-h-10 px-4 py-2" : "min-h-14 px-6 py-3")}>
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</div> : null}
        <h1 className={cn("truncate font-semibold tracking-tight", compact ? "text-[15px]" : "text-[20px]")}>{title}</h1>
        {subtitle ? <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function FlowActionBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flow-action-bar", className)}>{children}</div>;
}

type FlowRowProps = {
  children: ReactNode;
  as?: "div" | "button";
  selected?: boolean;
  completed?: boolean;
  interactive?: boolean;
  className?: string;
  onClick?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  role?: string;
  tabIndex?: number;
  ariaLabel?: string;
  title?: string;
};

export function FlowRow({
  children,
  as = "div",
  selected = false,
  completed = false,
  interactive = false,
  className,
  onClick,
  onKeyDown,
  role,
  tabIndex,
  ariaLabel,
  title,
}: FlowRowProps) {
  const Comp = as;
  const handleKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.currentTarget !== event.target || !interactive || !onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <Comp
      type={as === "button" ? "button" : undefined}
      title={title}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={role ?? (interactive && as !== "button" ? "button" : undefined)}
      tabIndex={tabIndex ?? (interactive && as !== "button" ? 0 : undefined)}
      aria-label={ariaLabel}
      className={cn(
        "flow-row",
        interactive && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1",
        selected && "flow-row-selected",
        completed && "text-muted-foreground",
        className
      )}
    >
      {children}
    </Comp>
  );
}

export function FlowMetaPill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "danger" | "success" | "warning";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "border-border/80 bg-muted/65 text-muted-foreground",
    accent: "border-primary/25 bg-primary/10 text-primary",
    danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  };

  return <span className={cn("flow-meta-pill", tones[tone], className)}>{children}</span>;
}

export function FlowEmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flow-empty">
      <p className="text-[14px] font-medium text-foreground">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
