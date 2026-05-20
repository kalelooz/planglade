"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";

/**
 * Autosave indicator for the Settings page.
 * Subscribes to settings + members; flashes "Saving…" → "Saved" briefly on any
 * change, otherwise shows a quiet "All changes saved" hint.
 */
export function SaveIndicator() {
  const settings = useStore((s) => s.settings);
  const members = useStore((s) => s.members);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const initialMount = useRef(true);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (initialMount.current) {
      initialMount.current = false;
      return;
    }
    // Clear any in-flight timers
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const t0 = window.setTimeout(() => setState("saving"), 0);
    const t1 = window.setTimeout(() => setState("saved"), 300);
    const t2 = window.setTimeout(() => setState("idle"), 2200);
    timers.current.push(t0, t1, t2);

    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [settings, members]);

  if (state === "saving") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[12px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> Saving…
      </span>
    );
  }
  if (state === "saved") {
    return (
      <span className="flex shrink-0 items-center gap-1 text-[12px] font-medium text-emerald-600">
        <Check className="h-3 w-3" /> Saved
      </span>
    );
  }
  return (
    <span className="shrink-0 text-[12px] text-muted-foreground">All changes saved</span>
  );
}
