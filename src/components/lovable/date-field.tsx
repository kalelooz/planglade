"use client";

import type { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type DateFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  onChange: (value: string) => void;
};

export function DateField({ className, onChange, ...props }: DateFieldProps) {
  return (
    <input
      type="date"
      onChange={(event) => onChange(event.target.value)}
      className={cn(
        "h-9 min-w-0 max-w-full rounded-md border border-border bg-card px-2 text-[13px] text-foreground outline-none transition hover:border-foreground/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
