import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex items-end justify-between border-b px-6 py-5">
      <div>
        <h1 className="text-[19px] font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionLabel({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-sidebar/70 px-6 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
      <span>{children}</span>
      {count != null && <span className="text-[10px] font-normal">{count}</span>}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex h-10 shrink-0 items-center gap-3 border-b bg-background px-4 text-[12px]">{children}</div>;
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
    neutral: "border-border bg-muted text-muted-foreground",
    accent: "border-primary/20 bg-primary/10 text-primary",
    danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300",
    warning: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300",
  };
  return <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] ${tones[tone]}`}>{children}</span>;
}
