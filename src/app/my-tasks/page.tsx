"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/lovable/shell";

function MyTasksRedirect() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const next = new URLSearchParams();
    next.set("filter", "mine");

    const tab = params.get("tab");
    const scope = params.get("scope");
    const taskId = params.get("taskId");
    const focus = params.get("focus");

    if (tab === "Today") next.set("filter", "today");
    if (tab === "Upcoming") next.set("filter", "upcoming");
    if (tab === "Overdue") next.set("filter", "overdue");
    if (tab === "Blocked") next.set("filter", "blocked");
    if (tab === "No date") next.set("filter", "no-date");
    if (tab === "Completed") next.set("filter", "completed");
    if (scope === "all" && !tab) next.set("filter", "all");
    if (taskId) next.set("task", taskId);
    if (focus) next.set("focus", focus);

    router.replace(`/app/tasks?${next.toString()}`);
  }, [params, router]);

  return (
    <AppShell title={<span className="font-medium">Tasks</span>}>
      <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
        Opening Tasks...
      </div>
    </AppShell>
  );
}

export default function MyTasks() {
  return (
    <Suspense fallback={null}>
      <MyTasksRedirect />
    </Suspense>
  );
}
