"use client";
import { useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar, ToolButton } from "@/components/lovable/page";
import { useStore } from "@/lib/store";
import { byInitials } from "@/lib/mock-data";
import { Avatar } from "@/components/lovable/icons";

export default function ActivityPage() {
  const activity = useStore((s) => s.activity);
  const [query, setQuery] = useState("");

  const days = activity
    .map((d) => ({ ...d, items: d.items.filter((it) => !query || it.target.toLowerCase().includes(query.toLowerCase()) || it.action.toLowerCase().includes(query.toLowerCase())) }))
    .filter((d) => d.items.length > 0);

  return (
    <AppShell
      title={<span className="font-medium">Activity</span>}
      toolbar={
        <Toolbar>
          <ToolButton>All users</ToolButton>
          <ToolButton>All projects</ToolButton>
          <ToolButton>All actions</ToolButton>
          <span className="ml-auto flex h-7 items-center gap-1.5 rounded border bg-sidebar px-2 text-[12px] text-muted-foreground">
            <Search className="h-3 w-3" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} className="w-40 bg-transparent outline-none" placeholder="Search activity…" />
          </span>
        </Toolbar>
      }
    >
      <div className="mx-auto max-w-3xl px-6 py-8">
        {days.length === 0 && <div className="py-16 text-center text-[13px] text-muted-foreground">No activity matches.</div>}
        {days.map((d) => (
          <section key={d.date} className="mb-8">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{d.date}</div>
            <div className="border-y">
              {d.items.map((it, i) => {
                const m = byInitials(it.who);
                return (
                  <div key={i} className="grid grid-cols-[20px_minmax(0,1fr)_60px] items-center gap-3 border-b py-2.5 text-[13px] last:border-0">
                    <Avatar id={m.id} name={m.name} />
                    <span className="text-foreground/90">
                      <span className="font-medium">{m.name}</span> <span className="text-muted-foreground">{it.action}</span>{" "}
                      <span>{it.target}</span>
                      {it.to && <> <span className="text-muted-foreground">→</span> <span>{it.to}</span></>}
                    </span>
                    <span className="text-right font-mono text-[11px] text-muted-foreground">{it.time}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
