"use client";

import { toast } from "sonner";

import { DEMO_MODE_MESSAGE } from "@/lib/demo-data";
import { DEMO_READ_ONLY_HEADER } from "@/lib/server-session-client";

export function blockReadOnlyMutation(readOnly: boolean) {
  if (!readOnly) return false;
  toast(DEMO_MODE_MESSAGE, { id: "demo-read-only" });
  return true;
}

export function handleDemoReadOnlyResponse(response: Response) {
  if (response.status !== 403 || response.headers.get(DEMO_READ_ONLY_HEADER) !== "true") return false;
  toast(DEMO_MODE_MESSAGE, { id: "demo-read-only" });
  return true;
}
