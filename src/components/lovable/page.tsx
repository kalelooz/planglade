import type { ReactNode } from "react";

import { FlowActionBar, FlowHeader, FlowMetaPill } from "@/components/lovable/flow-ui";

export function TitleCrumbs({ items }: { items: string[] }) {
  return (
    <div className="flex min-w-0 max-w-full items-center gap-1.5 overflow-hidden text-[13px]">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className={index < items.length - 2 ? "hidden sm:contents" : "contents"}>
          {index > 0 && <span className="text-muted-foreground/50">/</span>}
          <span className={`${index === 0 ? "font-medium" : "text-muted-foreground"} min-w-0 truncate`}>{item}</span>
        </span>
      ))}
    </div>
  );
}

export function ProjectViewTitle({ projectName, view }: { projectName?: string | null; view: string }) {
  return <TitleCrumbs items={[projectName ?? "All projects", view]} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return <FlowHeader title={title} subtitle={subtitle} actions={actions} />;
}

export function SectionLabel({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-sidebar/70 px-6 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
      <span>{children}</span>
      {count != null && <span className="sq-count-pill h-4 min-w-4 px-1 text-[10px] font-medium">{count}</span>}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <FlowActionBar>{children}</FlowActionBar>;
}

export function ToolButton({ children, active, onClick, disabled }: { children: ReactNode; active?: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`lov-btn lov-btn-ghost ${active ? "lov-btn-active" : ""}`}
    >
      {children}
    </button>
  );
}

export function Chip({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "danger" | "success" | "warning" }) {
  const tones: Record<string, string> = {
    neutral: "border-border/80 bg-muted/75 text-foreground/75",
    accent: "border-primary/30 bg-primary/10 text-primary",
    danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  };
  return <FlowMetaPill tone={tone} className={tones[tone]}>{children}</FlowMetaPill>;
}
