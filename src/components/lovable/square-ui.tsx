import type { ReactNode } from "react";
import { Calendar as CalendarDays } from "@phosphor-icons/react";

import { cn } from "@/lib/utils";
import { Chip } from "@/components/lovable/page";

type SquareMetricCardProps = {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  accent?: string;
};

export function SquareMetricCard({ label, value, caption, accent }: SquareMetricCardProps) {
  return (
    <div className="sq-panel relative overflow-hidden px-3 py-3">
      {accent ? <span className="absolute inset-x-0 top-0 h-0.5" style={{ background: accent }} /> : null}
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-[24px] font-semibold leading-none tracking-tight">{value}</div>
      {caption ? <div className="mt-2 text-[11px] text-muted-foreground">{caption}</div> : null}
    </div>
  );
}

type SquareTaskCardProps = {
  title: string;
  priority: ReactNode;
  due: string;
  statusIcon?: ReactNode;
  accent?: string;
  onClick: () => void;
};

export function SquareTaskCard({ title, priority, due, statusIcon, accent, onClick }: SquareTaskCardProps) {
  return (
    <button type="button" onClick={onClick} className="sq-card group w-full overflow-hidden text-left">
      <div className="px-3 py-2.5">
        <div className="mb-2 flex items-start gap-2">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[3px] bg-muted text-muted-foreground">
            {statusIcon}
          </span>
          <p className="min-w-0 flex-1 truncate text-[13px] font-medium">{title}</p>
        </div>
        {accent ? <span className="block h-0.5 w-12 rounded-full transition-all group-hover:w-20" style={{ background: accent }} /> : null}
      </div>
      <div className="sq-card-footer flex flex-wrap items-center gap-2 px-3 py-2 text-[11px] text-muted-foreground">
        <Chip>{priority}</Chip>
        <span className={cn("sq-meta-chip", due === "-" ? "opacity-70" : "")}>
          <CalendarDays className="h-3 w-3" />
          {due}
        </span>
      </div>
    </button>
  );
}
