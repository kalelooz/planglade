import { X, ExternalLink, Link2 } from "lucide-react";
import type { WorkItem } from "@/lib/mock-data";
import { byInitials } from "@/lib/mock-data";
import { Avatar, PriorityIcon, StatusIcon } from "./icons";
import { Chip } from "./page";

export function TaskDrawer({ item, onClose }: { item: WorkItem | null; onClose: () => void }) {
  if (!item) return null;
  const m = byInitials(item.assignee);
  return (
    <aside className="flex w-[420px] shrink-0 flex-col border-l bg-background">
      <div className="flex h-12 items-center justify-between border-b px-4">
        <div className="flex items-center gap-3 text-[12px]">
          <span className="font-mono text-muted-foreground">{item.id}</span>
          <span className="flex items-center gap-1.5">
            <StatusIcon s={item.status} /> {item.status}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded p-1 text-muted-foreground hover:bg-hover"><ExternalLink className="h-3.5 w-3.5" /></button>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-hover"><X className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <h2 className="text-[18px] font-semibold tracking-tight">{item.title}</h2>

        <dl className="mt-6 grid grid-cols-[88px_1fr] gap-y-3 text-[12px]">
          <dt className="text-muted-foreground">Assignee</dt>
          <dd className="flex items-center gap-2"><Avatar id={m.id} /> {m.name}</dd>
          <dt className="text-muted-foreground">Priority</dt>
          <dd className="flex items-center gap-1.5"><PriorityIcon p={item.priority} /> {item.priority}</dd>
          <dt className="text-muted-foreground">Due</dt>
          <dd>{new Date(item.due).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</dd>
          <dt className="text-muted-foreground">Label</dt>
          <dd><Chip>{item.label}</Chip></dd>
          <dt className="text-muted-foreground">Project</dt>
          <dd className="text-muted-foreground">Core Product</dd>
        </dl>

        <div className="mt-6 border-t pt-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</h3>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Map Figma user IDs to FlowBoard workspace members and surface embeds inline. Requires a dedicated OAuth flow and a thin canvas adapter for the editor.
          </p>
        </div>

        <div className="mt-5">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Checklist</h3>
          <ul className="space-y-1.5 text-[13px]">
            {["Research Figma REST API", "Prototype auth redirect", "Handle token refresh", "Wire embed renderer"].map((t, i) => (
              <li key={t} className="flex items-center gap-2">
                <input type="checkbox" defaultChecked={i < 2} className="h-3 w-3 accent-primary" />
                <span className={i < 2 ? "text-muted-foreground line-through" : ""}>{t}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5">
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <Link2 className="h-3 w-3" /> Linked notes
          </h3>
          <ul className="space-y-1 text-[13px]">
            <li className="rounded px-2 py-1 hover:bg-hover">Design Brief — Mobile v2</li>
            <li className="rounded px-2 py-1 hover:bg-hover">Team Meeting Notes — May 12</li>
          </ul>
        </div>
      </div>
      <div className="border-t p-3">
        <input placeholder="Add a comment…" className="h-8 w-full rounded border bg-sidebar px-2 text-[13px] outline-none focus:border-ring" />
      </div>
    </aside>
  );
}
