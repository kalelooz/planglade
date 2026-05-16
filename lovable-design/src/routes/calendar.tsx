import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { Toolbar, ToolButton } from "@/components/app/page";
import { workItems } from "@/lib/mock-data";

export const Route = createFileRoute("/calendar")({
  component: CalendarPage,
  head: () => ({ meta: [{ title: "Calendar — FlowBoard" }] }),
});

function CalendarPage() {
  const days = Array.from({ length: 35 }, (_, i) => i - 4); // May 2026, starts on Fri
  return (
    <AppShell
      title={<span className="font-medium">Calendar</span>}
      toolbar={
        <Toolbar>
          <button className="rounded p-1 hover:bg-hover"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="font-medium">May 2026</span>
          <button className="rounded p-1 hover:bg-hover"><ChevronRight className="h-3.5 w-3.5" /></button>
          <ToolButton>Today</ToolButton>
          <span className="h-3 w-px bg-border" />
          <div className="flex items-center gap-px rounded border p-0.5">
            <button className="rounded-sm bg-hover px-2 py-0.5 text-[11px]">Month</button>
            <button className="rounded-sm px-2 py-0.5 text-[11px] text-muted-foreground">Week</button>
          </div>
          <span className="ml-auto" />
          <ToolButton><Plus className="h-3 w-3" /> Event</ToolButton>
        </Toolbar>
      }
    >
      <div className="grid h-full grid-cols-7 border-b border-l text-[12px]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="border-r border-t bg-sidebar/50 px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{d}</div>
        ))}
        {days.map((d, idx) => {
          const day = d > 0 && d <= 31 ? d : null;
          const tasks = day ? workItems.filter((w) => new Date(w.due).getDate() % 7 === day % 7).slice(0, 2) : [];
          const isToday = day === 16;
          return (
            <div key={idx} className={`min-h-28 border-r border-t p-1.5 ${day ? "" : "bg-sidebar/30"}`}>
              {day && (
                <>
                  <div className={`mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}>{day}</div>
                  <div className="space-y-0.5">
                    {tasks.map((t) => (
                      <div key={`${idx}-${t.id}`} className="truncate rounded border-l-2 border-primary bg-primary/5 px-1.5 py-0.5 text-[11px]">{t.title}</div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
