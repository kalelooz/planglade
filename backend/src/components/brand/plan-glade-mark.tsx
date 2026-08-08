type PlanGladeMarkProps = {
  className?: string;
};

export function PlanGladeMark({ className = "" }: PlanGladeMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded bg-foreground text-[12px] font-extrabold leading-none tracking-tight text-background ${className}`}
    >
      PG
    </span>
  );
}
