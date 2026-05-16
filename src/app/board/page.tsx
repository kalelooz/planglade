"use client";
import { Plus, Filter } from "lucide-react";
import { toast } from "sonner";
import { DndContext, useDraggable, useDroppable, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar, ToolButton, Chip } from "@/components/lovable/page";
import { Avatar, PriorityIcon, StatusIcon } from "@/components/lovable/icons";
import { useStore } from "@/lib/store";
import { byInitials, type Status, type WorkItem } from "@/lib/mock-data";

const cols: Status[] = ["Backlog", "To Do", "In Progress", "In Review", "Done"];

export default function Board() {
  const workItems = useStore((s) => s.workItems);
  const setStatus = useStore((s) => s.setWorkItemStatus);
  const addWorkItem = useStore((s) => s.addWorkItem);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const targetStatus = cols.find((c) => c === overId);
    if (!targetStatus) return;
    const item = workItems.find((w) => w.id === id);
    if (item && item.status !== targetStatus) {
      setStatus(id, targetStatus);
      toast.success(`Moved ${id}`, { description: `→ ${targetStatus}` });
    }
  };

  return (
    <AppShell
      title={<span className="font-medium">Core Product · Board</span>}
      tabs={[
        { label: "Overview", to: "/projects" },
        { label: "Tasks", to: "/work-items" },
        { label: "Board", to: "/board", active: true },
        { label: "Calendar", to: "/calendar" },
        { label: "Timeline", to: "/timeline" },
        { label: "Notes", to: "/notes" },
      ]}
      toolbar={
        <Toolbar>
          <ToolButton><Filter className="h-3 w-3" /> Filter</ToolButton>
          <span className="ml-auto" />
          <button
            onClick={() => { addWorkItem({ title: "New work item", status: "Backlog" }); toast.success("Created work item"); }}
            className="flex h-7 items-center gap-1 rounded bg-primary px-2 text-[12px] font-medium text-primary-foreground"
          >
            <Plus className="h-3 w-3" /> Add
          </button>
        </Toolbar>
      }
    >
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="mx-auto flex h-full w-full max-w-7xl gap-3 overflow-x-auto p-4">
          {cols.map((col) => {
            const items = workItems.filter((w) => w.status === col);
            return <Column key={col} status={col} items={items} onAdd={() => { addWorkItem({ title: "New work item", status: col }); toast.success(`Added to ${col}`); }} />;
          })}
        </div>
      </DndContext>
    </AppShell>
  );
}

function Column({ status, items, onAdd }: { status: Status; items: WorkItem[]; onAdd: () => void }) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1 text-[12px] font-medium">
        <StatusIcon s={status} />
        <span>{status}</span>
        <span className="text-[11px] font-normal text-muted-foreground">{items.length}</span>
        <button onClick={onAdd} className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-[var(--color-hover)]" title={`Quick add to ${status}`}>
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-1.5 rounded-md border p-1.5 transition-colors ${isOver ? "border-primary/40 bg-primary/5" : "bg-sidebar/40"}`}
      >
        {items.map((w) => <Card key={w.id} item={w} />)}
        {items.length === 0 && (
          <div className="rounded border border-dashed px-2 py-6 text-center text-[11px] text-muted-foreground">{isOver ? "Drop here" : "No items"}</div>
        )}
      </div>
    </div>
  );
}

function Card({ item }: { item: WorkItem }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const m = byInitials(item.assignee);
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? "grabbing" : "grab",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="rounded border bg-card px-2.5 py-2 text-[12px] hover:border-foreground/20"
    >
      <div className="mb-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
        <span className="font-mono">{item.id}</span>
        <PriorityIcon p={item.priority} />
      </div>
      <div className="mb-2 text-[13px] font-medium leading-snug">{item.title}</div>
      <div className="flex items-center justify-between">
        <Chip>{item.label}</Chip>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">{new Date(item.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          <Avatar id={m.id} name={m.name} size={18} />
        </div>
      </div>
    </div>
  );
}
