"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, MoreHorizontal, Trash2, ArrowRight, GripVertical,
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AppShell } from "@/components/lovable/shell";
import { Toolbar, Chip } from "@/components/lovable/page";
import { Avatar, PriorityIcon, StatusIcon } from "@/components/lovable/icons";
import { TaskDrawer } from "@/components/lovable/task-drawer";
import { formatDueLabel } from "@/lib/dates";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useStore } from "@/lib/store";
import { type Status, type WorkItem } from "@/lib/mock-data";

const cols: Status[] = ["Backlog", "To Do", "In Progress", "In Review", "Done"];

export default function Board() {
  const params = useSearchParams();
  const routeProjectId = params.get("project");
  const workItems = useStore((s) => s.workItems);
  const projects = useStore((s) => s.projects);
  const activeProjectId = useStore((s) => s.settings.activeProjectId);
  const updateSettings = useStore((s) => s.updateSettings);
  const addWorkItem = useStore((s) => s.addWorkItem);
  const deleteWorkItem = useStore((s) => s.deleteWorkItem);
  const setWorkItemStatus = useStore((s) => s.setWorkItemStatus);
  const reorderWorkItem = useStore((s) => s.reorderWorkItem);
  const scopedProjectId = routeProjectId ?? activeProjectId;
  const activeProject = scopedProjectId ? projects.find((p) => p.id === scopedProjectId) ?? null : null;
  const scopedWorkItems = scopedProjectId ? workItems.filter((w) => w.project === scopedProjectId) : workItems;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusNew, setFocusNew] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const selected = selectedId ? scopedWorkItems.find((w) => w.id === selectedId) ?? null : null;
  const activeDragItem = activeDragId ? scopedWorkItems.find((w) => w.id === activeDragId) ?? null : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    if (routeProjectId && routeProjectId !== activeProjectId) {
      updateSettings({ activeProjectId: routeProjectId });
    }
  }, [activeProjectId, routeProjectId, updateSettings]);

  const createAndFocus = (status: Status) => {
    const id = addWorkItem({
      title: "Untitled task",
      status,
      project: scopedProjectId ?? projects[0]?.id ?? "core",
    });
    setSelectedId(id);
    setFocusNew(true);
    toast.success("Task created - fill in the details", { description: `${id} - ${status}` });
  };

  const handleDelete = (item: WorkItem) => {
    deleteWorkItem(item.id);
    if (selectedId === item.id) {
      setSelectedId(null);
      setFocusNew(false);
    }
    toast.success("Task deleted", { description: `${item.id} - ${item.title}` });
  };

  const onDragStart = (e: DragStartEvent) => {
    setActiveDragId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveDragId(null);
    const activeId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId || overId === activeId) return;

    const moved = scopedWorkItems.find((w) => w.id === activeId);
    if (!moved) return;

    // Drop on a column droppable (empty area / column header zone) and append to end.
    if ((cols as string[]).includes(overId)) {
      const targetStatus = overId as Status;
      const list = scopedWorkItems.filter((w) => w.status === targetStatus);
      if (moved.status === targetStatus && list[list.length - 1]?.id === activeId) return;
      reorderWorkItem(activeId, targetStatus, null, scopedProjectId);
      if (moved.status !== targetStatus) {
        toast.success(`Moved ${activeId}`, { description: `to ${targetStatus}` });
      }
      return;
    }

    // Drop on another card and place before or after based on pointer position.
    const overItem = scopedWorkItems.find((w) => w.id === overId);
    if (!overItem) return;
    const targetStatus = overItem.status;
    const activeRect = e.active.rect.current.translated;
    const overRect = e.over?.rect;
    const isBelowTarget = activeRect && overRect
      ? activeRect.top + activeRect.height / 2 > overRect.top + overRect.height / 2
      : false;

    if (isBelowTarget) {
      const columnItems = scopedWorkItems.filter((w) => w.status === targetStatus);
      const overIndex = columnItems.findIndex((w) => w.id === overItem.id);
      const nextItem = overIndex === -1 ? null : columnItems[overIndex + 1]?.id ?? null;
      reorderWorkItem(activeId, targetStatus, nextItem, scopedProjectId);
    } else {
      reorderWorkItem(activeId, targetStatus, overItem.id, scopedProjectId);
    }

    if (moved.status !== targetStatus) {
      toast.success(`Moved ${activeId}`, { description: `to ${targetStatus}` });
    }
  };

  return (
    <AppShell
      title={
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">Tasks</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="font-medium">{activeProject?.name ?? "All Tasks"}</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="text-muted-foreground">Board</span>
        </div>
      }
      toolbar={
        <Toolbar>
          <span className="text-[12px] text-muted-foreground">
            {scopedWorkItems.length} task{scopedWorkItems.length === 1 ? "" : "s"} on board
          </span>
          <span className="ml-auto" />
          <button
            onClick={() => createAndFocus("Backlog")}
            className="lov-btn lov-btn-primary"
          >
            <Plus className="h-3 w-3" /> New task
          </button>
        </Toolbar>
      }
    >
      <div className="flex h-full min-h-0 w-full">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActiveDragId(null)}
          >
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
              <div className="grid h-full grid-cols-[repeat(5,minmax(220px,1fr))] gap-3 p-4">
                {cols.map((col) => {
                  const items = scopedWorkItems.filter((w) => w.status === col);
                  return (
                    <Column
                      key={col}
                      status={col}
                      items={items}
                      selectedId={selectedId}
                      onSelect={(id) => setSelectedId(id)}
                      onAdd={() => createAndFocus(col)}
                      onMove={(id, s) => setWorkItemStatus(id, s)}
                      onDelete={handleDelete}
                    />
                  );
                })}
              </div>
            </div>
            <DragOverlay>
              {activeDragItem ? <CardGhost item={activeDragItem} /> : null}
            </DragOverlay>
          </DndContext>
        </div>

        <TaskDrawer
          item={selected}
          focusTitle={focusNew}
          onTitleFocused={() => setFocusNew(false)}
          onClose={() => { setSelectedId(null); setFocusNew(false); }}
        />
      </div>
    </AppShell>
  );
}

function Column({
  status,
  items,
  selectedId,
  onAdd,
  onSelect,
  onMove,
  onDelete,
}: {
  status: Status;
  items: WorkItem[];
  selectedId: string | null;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onMove: (id: string, status: Status) => void;
  onDelete: (item: WorkItem) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex min-w-0 flex-col">
      <div className="mb-2 flex items-center gap-2 px-1 text-[12px] font-medium">
        <StatusIcon s={status} />
        <span>{status}</span>
        <span className="text-[11px] font-normal text-muted-foreground">{items.length}</span>
        <button onClick={onAdd} className="lov-icon-btn ml-auto h-6 w-6" title={`Quick add to ${status}`}>
          <Plus className="h-3 w-3" />
        </button>
      </div>
      <div
        ref={setNodeRef}
        className={`flex flex-1 flex-col gap-2 overflow-y-auto rounded-md border p-2 transition-colors ${isOver ? "border-primary/40 bg-primary/5" : "bg-sidebar/40"}`}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((w) => (
            <Card
              key={w.id}
              item={w}
              selected={selectedId === w.id}
              onSelect={() => onSelect(w.id)}
              onMove={(s) => onMove(w.id, s)}
              onDelete={() => onDelete(w)}
            />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="rounded border border-dashed px-2 py-6 text-center text-[11px] text-muted-foreground hover:border-foreground/30 hover:text-foreground"
          >
            {isOver ? "Drop here" : `Add to ${status}`}
          </button>
        )}
      </div>
    </div>
  );
}

function Card({
  item,
  selected,
  onSelect,
  onMove,
  onDelete,
}: {
  item: WorkItem;
  selected: boolean;
  onSelect: () => void;
  onMove: (status: Status) => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });
  const members = useStore((s) => s.members);
  const m = members.find((member) => member.id === item.assignee) ?? members[0];
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: "relative",
  };
  const checklist = item.checklist ?? [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-md border bg-card p-3 text-[12px] transition-shadow ${selected ? "border-primary/40 ring-1 ring-primary/30" : "hover:border-foreground/20 hover:shadow-sm"}`}
    >
      {/* Row 1: one concise metadata line */}
      <div className="mb-2 flex items-center gap-2">
        <button
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          title="Drag task"
          aria-label={`Drag ${item.title}`}
          className="lov-icon-btn h-6 w-6 shrink-0 cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        {item.label && <Chip>{item.label}</Chip>}
        <span className="ml-auto text-[11px] text-muted-foreground">{formatDueLabel(item.due)}</span>
        <PriorityIcon p={item.priority} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="More actions"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="lov-icon-btn ml-auto h-6 w-6 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44" onPointerDown={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">{item.id}</DropdownMenuLabel>
            <DropdownMenuItem onSelect={onSelect}>Open details</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowRight className="h-3.5 w-3.5" /> Move to
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-40">
                {cols.filter((s) => s !== item.status).map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => onMove(s)}>
                    <StatusIcon s={s} /> {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete task
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Row 2: title */}
      <button
        type="button"
        onClick={onSelect}
        className="mb-2.5 block w-full text-left text-[13.5px] font-medium leading-[1.4] hover:underline"
      >
        {item.title}
      </button>

      {/* Row 3: assignee */}
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar id={m.id} name={m.name} size={20} />
          <span className="truncate">{m.name}</span>
        </div>
      </div>
    </div>
  );
}

function CardGhost({ item }: { item: WorkItem }) {
  const members = useStore((s) => s.members);
  const m = members.find((member) => member.id === item.assignee) ?? members[0];
  return (
    <div className="w-[260px] rotate-1 rounded-md border bg-card p-3 text-[12px] shadow-xl ring-2 ring-primary/30">
      <div className="mb-2 flex items-center gap-2">
        {item.label && <Chip>{item.label}</Chip>}
        <span className="ml-auto text-[11px] text-muted-foreground">{formatDueLabel(item.due)}</span>
        <PriorityIcon p={item.priority} />
      </div>
      <div className="mb-2.5 text-[13.5px] font-medium leading-[1.4]">{item.title}</div>
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-1.5">
          <Avatar id={m.id} name={m.name} size={20} />
          <span className="truncate">{m.name}</span>
        </div>
      </div>
    </div>
  );
}
