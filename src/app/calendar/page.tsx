"use client";
import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar, ToolButton } from "@/components/lovable/page";
import { useStore } from "@/lib/store";

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function daysInMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); }
function leadingBlanks(d: Date) {
  const day = startOfMonth(d).getDay(); // 0=Sun
  return (day + 6) % 7; // shift so Monday is 0
}

export default function CalendarPage() {
  const workItems = useStore((s) => s.workItems);
  const [cursor, setCursor] = useState(() => new Date());

  const today = new Date();
  const isThisMonth = cursor.getFullYear() === today.getFullYear() && cursor.getMonth() === today.getMonth();

  const cells = useMemo(() => {
    const dim = daysInMonth(cursor);
    const lead = leadingBlanks(cursor);
    const arr: { day: number | null }[] = [];
    for (let i = 0; i < lead; i++) arr.push({ day: null });
    for (let d = 1; d <= dim; d++) arr.push({ day: d });
    while (arr.length % 7) arr.push({ day: null });
    return arr;
  }, [cursor]);

  const itemsByDay = useMemo(() => {
    const map: Record<number, typeof workItems> = {};
    for (const w of workItems) {
      const d = new Date(w.due);
      if (d.getFullYear() === cursor.getFullYear() && d.getMonth() === cursor.getMonth()) {
        const k = d.getDate();
        (map[k] ||= []).push(w);
      }
    }
    return map;
  }, [workItems, cursor]);

  return (
    <AppShell
      title={<span className="font-medium">Calendar</span>}
      toolbar={
        <Toolbar>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} className="rounded p-1 hover:bg-[var(--color-hover)]"><ChevronLeft className="h-3.5 w-3.5" /></button>
          <span className="font-medium">{cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</span>
          <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded p-1 hover:bg-[var(--color-hover)]"><ChevronRight className="h-3.5 w-3.5" /></button>
          <ToolButton><span onClick={() => setCursor(new Date())}>Today</span></ToolButton>
          <span className="h-3 w-px bg-border" />
          <div className="flex items-center gap-px rounded border p-0.5">
            <button className="rounded-sm bg-[var(--color-hover)] px-2 py-0.5 text-[11px]">Month</button>
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
        {cells.map((c, idx) => {
          const day = c.day;
          const isToday = !!day && isThisMonth && day === today.getDate();
          const dayItems = day ? itemsByDay[day] ?? [] : [];
          return (
            <div key={idx} className={`min-h-28 border-r border-t p-1.5 ${day ? "" : "bg-sidebar/30"}`}>
              {day && (
                <>
                  <div className={`mb-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${isToday ? "bg-primary font-semibold text-primary-foreground" : "text-muted-foreground"}`}>{day}</div>
                  <div className="space-y-0.5">
                    {dayItems.slice(0, 3).map((t) => (
                      <div key={t.id} className="truncate rounded border-l-2 border-primary bg-primary/5 px-1.5 py-0.5 text-[11px]" title={t.title}>{t.title}</div>
                    ))}
                    {dayItems.length > 3 && <div className="px-1.5 text-[10px] text-muted-foreground">+{dayItems.length - 3} more</div>}
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
