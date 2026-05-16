import { createFileRoute } from "@tanstack/react-router";
import { Archive, Trash2, FolderPlus, Calendar, Flag } from "lucide-react";
import { AppShell } from "@/components/app/shell";
import { Toolbar, ToolButton } from "@/components/app/page";
import { inboxItems } from "@/lib/mock-data";

export const Route = createFileRoute("/inbox")({
  component: Inbox,
  head: () => ({ meta: [{ title: "Inbox — FlowBoard" }] }),
});

function Inbox() {
  return (
    <AppShell
      title={<span className="font-medium">Inbox</span>}
      toolbar={
        <Toolbar>
          <span className="text-muted-foreground">{inboxItems.length} unsorted</span>
          <span className="h-3 w-px bg-border" />
          <ToolButton><FolderPlus className="h-3 w-3" /> Assign project</ToolButton>
          <ToolButton><Calendar className="h-3 w-3" /> Due date</ToolButton>
          <ToolButton><Flag className="h-3 w-3" /> Priority</ToolButton>
          <span className="ml-auto" />
          <ToolButton><Archive className="h-3 w-3" /> Archive</ToolButton>
          <ToolButton><Trash2 className="h-3 w-3" /> Delete</ToolButton>
        </Toolbar>
      }
    >
      <div>
        {inboxItems.map((i) => (
          <div key={i.id} className="group grid grid-cols-[28px_1fr_auto_auto_auto_72px] items-center gap-3 border-b px-4 py-2.5 text-[13px] hover:bg-hover/60">
            <input type="checkbox" className="h-3 w-3 accent-primary" />
            <span className="truncate">{i.title}</span>
            <button className="rounded border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-0 hover:bg-hover group-hover:opacity-100">+ project</button>
            <button className="rounded border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-0 hover:bg-hover group-hover:opacity-100">+ due</button>
            <button className="rounded border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground opacity-0 hover:bg-hover group-hover:opacity-100">+ priority</button>
            <span className="text-right text-[11px] text-muted-foreground">{i.captured}</span>
          </div>
        ))}

        <div className="border-b px-4 py-16 text-center">
          <p className="text-[13px] text-muted-foreground">You've reached the bottom of your inbox.</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Press <kbd className="rounded border bg-muted px-1 font-mono text-[10px]">C</kbd> to capture something.</p>
        </div>
      </div>
    </AppShell>
  );
}
