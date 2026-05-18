"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { Plus, X, FolderPlus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/lovable/shell";
import { useStore } from "@/lib/store";
import { byInitials, type ProjectStatus } from "@/lib/mock-data";
import { Avatar } from "@/components/lovable/icons";
import { Chip } from "@/components/lovable/page";
import { ProjectIcon, IconPicker } from "@/components/lovable/project-icon";

const STATUSES: ProjectStatus[] = ["Active", "In Review", "On Hold", "Archived"];

function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function ProjectsInner() {
  const params = useSearchParams();
  const projects = useStore((s) => s.projects);
  const workItems = useStore((s) => s.workItems);
  const members = useStore((s) => s.members);
  const addProject = useStore((s) => s.addProject);
  const updateProject = useStore((s) => s.updateProject);
  const updateSettings = useStore((s) => s.updateSettings);
  const activeProjectId = useStore((s) => s.settings.activeProjectId);
  const router = useRouter();

  const [modalOpen, setModalOpen] = useState(false);
  const [iconEditingId, setIconEditingId] = useState<string | null>(null);

  const cols = "grid-cols-[minmax(64px,0.7fr)_minmax(140px,1.7fr)_minmax(96px,1fr)_minmax(100px,1fr)_minmax(72px,0.7fr)_minmax(44px,0.45fr)_minmax(44px,0.45fr)]";
  const todayKey = localToday();
  const selectedProjectId = params.get("project");
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (selectedProject && selectedProject.id !== activeProjectId) {
      updateSettings({ activeProjectId: selectedProject.id });
    }
  }, [activeProjectId, selectedProject, updateSettings]);

  if (selectedProject) {
    const owner = byInitials(selectedProject.owner);
    const items = workItems.filter((workItem) => workItem.project === selectedProject.id);
    const done = items.filter((workItem) => workItem.status === "Done").length;
    const open = items.length - done;
    const overdue = items.filter((workItem) => workItem.status !== "Done" && workItem.due < todayKey).length;
    const progress = items.length === 0 ? 0 : Math.round((done / items.length) * 100);

    return (
      <AppShell title={<span className="font-medium">Projects / {selectedProject.name}</span>}>
        <div className="h-full overflow-y-scroll [scrollbar-gutter:stable]">
          <div className="mx-auto w-full max-w-4xl px-6 py-8 lg:px-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <ProjectIcon name={selectedProject.icon} accent={selectedProject.accent} size={18} />
                  <h1 className="truncate text-[22px] font-semibold tracking-tight">{selectedProject.name}</h1>
                </div>
                <p className="text-[13px] text-muted-foreground">Project overview. Use the Advanced pages for tasks, board, timeline, activity, and reports.</p>
              </div>
              <button onClick={() => router.push("/projects")} className="lov-btn lov-btn-ghost">All projects</button>
            </div>

            <section className="border-y py-4">
              <dl className="grid grid-cols-2 gap-y-3 text-[13px] md:grid-cols-4">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Status</dt>
                  <dd className="mt-1"><Chip tone={selectedProject.status === "Active" ? "accent" : selectedProject.status === "On Hold" ? "warning" : "neutral"}>{selectedProject.status}</Chip></dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Manager</dt>
                  <dd className="mt-1 flex items-center gap-2"><Avatar id={owner.id} name={owner.name} /> {owner.name}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Due</dt>
                  <dd className="mt-1 text-muted-foreground">{selectedProject.due ? new Date(selectedProject.due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No date"}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Progress</dt>
                  <dd className="mt-1 text-muted-foreground">{progress}% complete</dd>
                </div>
              </dl>
            </section>

            <section className="mt-8 grid gap-4 md:grid-cols-4">
              {[
                ["Open", open],
                ["Done", done],
                ["Overdue", overdue],
                ["Total", items.length],
              ].map(([label, value]) => (
                <div key={label} className="border-t pt-3">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
                  <div className="mt-1 text-[24px] font-semibold tracking-tight">{value}</div>
                </div>
              ))}
            </section>

            <section className="mt-10">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h2 className="text-[14px] font-semibold tracking-tight">Recent work</h2>
                <button
                  onClick={() => router.push(`/my-tasks?project=${selectedProject.id}`)}
                  className="lov-btn"
                >
                  Open work items
                </button>
              </div>
              <div className="border-t">
                {items.slice(0, 6).map((workItem) => (
                  <div key={workItem.id} className="grid grid-cols-[72px_minmax(0,1fr)_100px_88px] items-center gap-3 border-b py-2 text-[13px]">
                    <span className="font-mono text-[11px] text-muted-foreground">{workItem.id}</span>
                    <span className="truncate font-medium">{workItem.title}</span>
                    <Chip>{workItem.status}</Chip>
                    <span className="text-right text-[12px] text-muted-foreground">{new Date(workItem.due).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                ))}
                {items.length === 0 && <div className="py-10 text-center text-[13px] text-muted-foreground">No work items in this project yet.</div>}
              </div>
            </section>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title={<span className="font-medium">Projects</span>}>
      <div className="h-full overflow-y-scroll [scrollbar-gutter:stable]">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 lg:px-8">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h1 className="text-[20px] font-semibold tracking-tight">Projects</h1>
            <div className="flex items-center gap-3">
              <span className="text-[12px] text-muted-foreground">{projects.length} in your workspace</span>
              <button
                onClick={() => setModalOpen(true)}
                className="lov-btn lov-btn-primary"
              >
                <Plus className="h-3.5 w-3.5" /> New project
              </button>
            </div>
          </div>
          <p className="mb-6 text-[13px] text-muted-foreground">Click a project to open its overview.</p>

          {projects.length === 0 ? (
            <EmptyState onCreate={() => setModalOpen(true)} />
          ) : (
            <>
              {/* Column headers */}
              <div className={`grid ${cols} items-center gap-3 border-b border-border px-2 pb-2 pt-1 text-[13px] font-semibold tracking-tight text-foreground`}>
                <span>Status</span>
                <span>Project</span>
                <span>Manager</span>
                <span>Progress</span>
                <span>Due</span>
                <span className="text-right">Tasks</span>
                <span className="text-right">Done</span>
              </div>

              {projects.map((p) => {
                const m = byInitials(p.owner);
                const items = workItems.filter((w) => w.project === p.id);
                const done = items.filter((w) => w.status === "Done").length;
                const progress = items.length === 0 ? 0 : Math.round((done / items.length) * 100);
                const overdue = !!p.due && p.due < todayKey && p.status !== "Archived";
                return (
                  <div
                    key={p.id}
                    role="link"
                    tabIndex={0}
                    onClick={() => { updateSettings({ activeProjectId: p.id }); router.push(`/projects?project=${p.id}`); }}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); updateSettings({ activeProjectId: p.id }); router.push(`/projects?project=${p.id}`); } }}
                    className={`grid ${cols} cursor-pointer items-center gap-3 border-b border-border/40 px-2 py-3 text-[13px] hover:bg-[var(--color-hover)]/40 focus:bg-[var(--color-hover)]/40 focus:outline-none`}
                  >
                    <span>
                      <Chip tone={p.status === "Active" ? "accent" : p.status === "On Hold" ? "warning" : "neutral"}>{p.status}</Chip>
                    </span>
                    <span className="relative flex items-center gap-2 font-medium text-foreground">
                      <button
                        type="button"
                        title="Change icon"
                        onClick={(e) => { e.stopPropagation(); setIconEditingId(iconEditingId === p.id ? null : p.id); }}
                        className="lov-icon-btn h-6 w-6"
                      >
                        <ProjectIcon name={p.icon} accent={p.accent} />
                      </button>
                      <span className="whitespace-nowrap">{p.name}</span>
                      {iconEditingId === p.id && (
                        <>
                          <div className="fixed inset-0 z-[70]" onMouseDown={(e) => { e.stopPropagation(); setIconEditingId(null); }} />
                          <div className="absolute left-0 top-8 z-[80] w-[336px]" onClick={(e) => e.stopPropagation()}>
                            <IconPicker
                              value={p.icon ?? "Folder"}
                              accent={p.accent}
                              onChange={(name) => { updateProject(p.id, { icon: name }); setIconEditingId(null); }}
                            />
                          </div>
                        </>
                      )}
                    </span>
                    <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                      <Avatar id={m.id} name={m.name} /> <span className="truncate">{m.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="h-2 w-20 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full transition-all" style={{ width: `${progress}%`, background: p.accent }} />
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{progress}%</span>
                    </span>
                    <span className={overdue ? "font-medium text-red-600" : "text-muted-foreground"}>
                      {p.due ? new Date(p.due).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                    </span>
                    <span className="text-right text-muted-foreground">{items.length}</span>
                    <span className="text-right text-muted-foreground">{done}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>

      {modalOpen && (
        <NewProjectModal
          members={members}
          onClose={() => setModalOpen(false)}
          onCreate={(input) => {
            const id = addProject(input);
            updateSettings({ activeProjectId: id });
            toast.success(`Created project "${input.name}"`);
            setModalOpen(false);
            router.push(`/projects?project=${id}`);
          }}
        />
      )}
    </AppShell>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsInner />
    </Suspense>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border/60 bg-card/40 py-16 text-center">
      <FolderPlus className="h-8 w-8 text-muted-foreground/60" />
      <p className="text-[14px] font-medium text-foreground">No projects yet</p>
      <p className="max-w-sm text-[13px] text-muted-foreground">Projects group related work items. Create one to start organizing your tasks.</p>
      <button
        onClick={onCreate}
        className="lov-btn lov-btn-primary mt-1"
      >
        <Plus className="h-3.5 w-3.5" /> New project
      </button>
    </div>
  );
}

function NewProjectModal({
  members,
  onClose,
  onCreate,
}: {
  members: { id: string; name: string }[];
  onClose: () => void;
  onCreate: (input: { name: string; status: ProjectStatus; owner: string; due: string; icon: string }) => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("Folder");
  const [status, setStatus] = useState<ProjectStatus>("Active");
  const [owner, setOwner] = useState(members[0]?.id ?? "AM");
  const [due, setDue] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onCreate({ name: name.trim(), status, owner, due, icon });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-foreground/30" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-lg border bg-background p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold tracking-tight">New project</h2>
          <button onClick={onClose} className="lov-icon-btn" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <Field label="Name">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-card">
                <ProjectIcon name={icon} accent="var(--color-primary)" size={16} />
              </span>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
                placeholder="e.g. Mobile App v3"
                className="h-9 flex-1 rounded-md border bg-card px-2.5 text-[13px] outline-none focus:border-ring"
              />
            </div>
          </Field>

          <Field label="Icon">
            <IconPicker value={icon} accent="var(--color-primary)" onChange={setIcon} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ProjectStatus)}
                className="h-9 w-full rounded-md border bg-card px-2 text-[13px] outline-none focus:border-ring"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Manager">
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                className="h-9 w-full rounded-md border bg-card px-2 text-[13px] outline-none focus:border-ring"
              >
                {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Due (optional)">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              className="h-9 w-full rounded-md border bg-card px-2 text-[13px] outline-none focus:border-ring"
            />
          </Field>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="lov-btn lov-btn-ghost">Cancel</button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="lov-btn lov-btn-primary"
          >
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
