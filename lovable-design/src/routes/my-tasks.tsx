import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app/shell";
import { PriorityIcon, Avatar } from "@/components/app/icons";
import { Chip } from "@/components/app/page";
import { workItems, byInitials } from "@/lib/mock-data";

export const Route = createFileRoute("/my-tasks")({
  component: MyTasks,
  head: () => ({ meta: [{ title: "My Tasks — FlowBoard" }] }),
});

const tabs = ["Today", "Upcoming", "Overdue", "No date", "Completed"] as const;

function MyTasks() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Today");
  const all = workItems.filter((w) => w.assignee === "AM" || w.assignee === "LP");

  return (
    <AppShell title={<span className="font-medium">My Tasks</span>}>
      <div className="border-b px-6 py-5">
        <h1 className="text-[19px] font-semibold tracking-tight">My Tasks</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Personal task hub across all projects.</p>
      </div>

      <div className="flex h-10 items-center gap-1 border-b px-4 text-[13px]">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`relative flex h-full items-center px-2.5 ${tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            {t}
            {tab === t && <span className="absolute inset-x-2.5 -bottom-px h-px bg-foreground" />}
          </button>
        ))}
      </div>

      <div>
        {["Today", "Tomorrow", "This week"].map((group) => (
          <div key={group}>
            <div className="border-b bg-sidebar/60 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group}</div>
            {all.slice(0, 3).map((w) => {
              const m = byInitials(w.assignee);
              return (
                <div key={`${group}-${w.id}`} className="group flex items-center gap-3 border-b px-4 py-2 text-[13px] hover:bg-hover/60">
                  <input type="checkbox" className="h-3.5 w-3.5 accent-primary" />
                  <span className="font-mono text-[11px] text-muted-foreground">{w.id}</span>
                  <span className="flex-1 truncate">{w.title}</span>
                  <PriorityIcon p={w.priority} />
                  <Chip>{w.label}</Chip>
                  <Avatar id={m.id} name={m.name} />
                  <span className="w-16 text-right text-[12px] text-muted-foreground">{new Date(w.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
