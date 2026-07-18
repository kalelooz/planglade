"use client";

import { Check } from "@phosphor-icons/react";

export function TaskCompletionToggle({
  checked,
  onToggle,
  ariaLabel,
  disabled = false,
  className = "",
}: {
  checked: boolean;
  onToggle: (checked: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle(!checked);
      }}
      className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 ${checked ? "text-white" : ""} ${className}`}
    >
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
          checked ? "border-zinc-900 bg-zinc-900" : "border-zinc-300 bg-white hover:border-zinc-500"
        }`}
      >
        {checked ? <Check className="h-2.5 w-2.5" weight="bold" /> : null}
      </span>
    </button>
  );
}
