"use client";

import { toast } from "sonner";

import { DEMO_MODE_MESSAGE } from "@/lib/demo-data";

export function blockReadOnlyMutation(readOnly: boolean) {
  if (!readOnly) return false;
  toast(DEMO_MODE_MESSAGE, { id: "demo-read-only" });
  return true;
}
