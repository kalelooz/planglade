"use client";
import { useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import type { WorkItem, Status, Priority } from "@/lib/mock-data";
import { AppShell } from "@/components/lovable/shell";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";
import { useStore, type PriorityStyle } from "@/lib/store";
import { AvatarPicker } from "@/components/lovable/avatar-picker";
import { SaveIndicator } from "@/components/lovable/save-indicator";
import { getServerSession } from "@/lib/server-session-client";
import { DEFAULT_NOTIFICATION_PREFERENCES, normalizeNotificationPreferences } from "@/lib/notification-preferences";

const sections = ["General", "Appearance", "Notifications", "Data", "Account"] as const;
type Section = (typeof sections)[number];

type WorkspaceSnapshot = {
  version?: number;
  generatedAt?: string;
  workspace?: { id: string; slug?: string; name?: string };
  settings?: {
    userId?: string;
    theme?: "system" | "light" | "dark" | null;
    density?: "compact" | "comfortable" | null;
    accent?: string | null;
    notifications?: Record<string, boolean> | null;
  } | null;
  data?: {
    projects?: Array<{
      id: string;
      name: string;
      status: string;
      mode?: string;
      featureFlags?: Record<string, boolean>;
      due?: string;
      accent?: string;
    }>;
    workItems?: Array<{
      id: string;
      title: string;
      status: string;
      priority: string;
      assignee?: string;
      due?: string;
      start?: string;
      project?: string;
      description?: string;
      noteIds?: string[];
      checklist?: Array<{ id: string; text: string; done: boolean }>;
    }>;
    notes?: Array<{ id: string; title: string; tag?: string; excerpt?: string; body?: string }>;
  };
};

const ACCENTS = [
  { value: "oklch(0.24 0.006 286)", label: "Slate" },
  { value: "oklch(0.52 0.09 195)", label: "Teal" },
  { value: "oklch(0.55 0.15 250)", label: "Blue" },
  { value: "oklch(0.55 0.13 145)", label: "Green" },
  { value: "oklch(0.65 0.16 330)", label: "Rose" },
  { value: "oklch(0.62 0.15 30)", label: "Orange" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[180px_1fr] gap-6 border-b pb-5">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-muted-foreground">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function AppearancePreview({
  accent,
  density,
  priorityStyle,
}: {
  accent: string;
  density: "compact" | "comfortable";
  priorityStyle: PriorityStyle;
}) {
  const relaxed = density === "comfortable";
  const rowPadding = relaxed ? "py-2.5" : "py-1.5";
  const rowGap = relaxed ? "gap-3" : "gap-2";
  const sampleTasks = [
    { id: "FB-65", title: "Review integration copy", priority: "High" as Priority, status: "In Progress" },
    { id: "FB-87", title: "Triage mobile feedback", priority: "Medium" as Priority, status: "To Do" },
    { id: "FB-111", title: "Archive stale checklist", priority: "Low" as Priority, status: "Backlog" },
  ];

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div>
          <div className="text-[12px] font-medium">Appearance preview</div>
          <div className="text-[11px] text-muted-foreground">Accent, density, and priority style update here first.</div>
        </div>
        <button
          type="button"
          style={{ background: accent }}
          className="lov-btn lov-btn-primary h-7 text-[11px] shadow-xs"
        >
          Primary action
        </button>
      </div>

      <div className="grid gap-0 md:grid-cols-[1fr_180px]">
        <div className="min-w-0 border-b md:border-r md:border-b-0">
          {sampleTasks.map((task) => (
            <div key={task.id} className={`flex items-center ${rowGap} border-b px-3 text-[13px] last:border-b-0 ${rowPadding}`}>
              <input type="checkbox" className="h-3.5 w-3.5 accent-[var(--color-primary)]" aria-label={`Complete ${task.title}`} />
              <PriorityIcon p={task.priority} style={priorityStyle} />
              <span className="min-w-0 flex-1 truncate font-medium">{task.title}</span>
              <span className="rounded border px-1.5 py-0.5 text-[10px] text-muted-foreground">{task.status}</span>
            </div>
          ))}
        </div>

        <div className="p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Menu sample</div>
          <div className="overflow-hidden rounded border">
            <div className={`px-2 text-[12px] ${rowPadding}`} style={{ background: `color-mix(in oklch, ${accent} 14%, transparent)` }}>
              Assign to me
            </div>
            <div className={`px-2 text-[12px] text-muted-foreground ${rowPadding}`}>Move to today</div>
            <div className={`px-2 text-[12px] text-muted-foreground ${rowPadding}`}>Copy link</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-[11px] text-muted-foreground">
        <span>Priority colors:</span>
        <PriorityIcon p="High" style="arrows" />
        <PriorityIcon p="Medium" style="arrows" />
        <PriorityIcon p="Low" style="arrows" />
        <PriorityIcon p="High" style="labels" />
        <PriorityIcon p="Medium" style="labels" />
        <PriorityIcon p="Low" style="labels" />
        <PriorityIcon p="High" style="shapes" />
        <PriorityIcon p="Medium" style="shapes" />
        <PriorityIcon p="Low" style="shapes" />
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("General");
  const [serverImportBusy, setServerImportBusy] = useState(false);
  const [snapshotImportMode, setSnapshotImportMode] = useState<"append" | "replace">("append");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const settings = useStore((s) => s.settings);
  const members = useStore((s) => s.members);
  const projects = useStore((s) => s.projects);
  const notes = useStore((s) => s.notes);
  const workItems = useStore((s) => s.workItems);
  const updateSettings = useStore((s) => s.updateSettings);
  const updateMember = useStore((s) => s.updateMember);
  const resetData = useStore((s) => s.resetData);
  const { setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const currentMember = members.find((m) => m.id === "AM") ?? members[0] ?? {
    id: "AM",
    name: "Alex Morgan",
    role: "Product Lead",
    color: "oklch(0.62 0.13 195)",
  };

  const persistUserSettings = async (patch: Partial<{
    theme: "system" | "light" | "dark";
    density: "compact" | "comfortable";
    accent: string;
    notifications: Record<string, boolean>;
  }>) => {
    if (!workspaceId || !currentUserId) return;
    await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": currentUserId,
      },
      body: JSON.stringify({
        workspaceId,
        userId: currentUserId,
        ...patch,
      }),
    });
  };

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getServerSession();
        if (!active) return;
        setWorkspaceId(session.workspace.id);
        setCurrentUserId(session.user.id);

        const response = await fetch(
          `/api/settings?workspaceId=${encodeURIComponent(session.workspace.id)}&userId=${encodeURIComponent(session.user.id)}`,
          {
            cache: "no-store",
            headers: { "x-flowboard-user-id": session.user.id },
          }
        );
        if (!response.ok) return;

        const payload = (await response.json()) as {
          settings: {
            theme: "system" | "light" | "dark" | null;
            density: "compact" | "comfortable" | null;
            accent: string | null;
            notifications: unknown;
          } | null;
        };

        if (!payload.settings || !active) return;

        const notifications = normalizeNotificationPreferences(payload.settings.notifications);
        updateSettings({
          ...(payload.settings.theme ? { theme: payload.settings.theme } : {}),
          ...(payload.settings.density ? { density: payload.settings.density } : {}),
          ...(payload.settings.accent ? { accent: payload.settings.accent } : {}),
          notifications,
        });
        if (payload.settings.theme) {
          setTheme(payload.settings.theme);
        }
      } catch {
        // keep local defaults when remote settings are unavailable
      }
    })();

    return () => {
      active = false;
    };
  }, [setTheme, updateSettings]);

  const exportWorkspaceSnapshot = async () => {
    if (!workspaceId || !currentUserId) {
      toast.error("Session not ready for export");
      return;
    }

    const response = await fetch(
      `/api/workspace/export?workspaceId=${encodeURIComponent(workspaceId)}&userId=${encodeURIComponent(currentUserId)}`,
      {
        cache: "no-store",
        headers: { "x-flowboard-user-id": currentUserId },
      }
    );

    if (!response.ok) {
      toast.error("Failed to export workspace snapshot");
      return;
    }

    const payload = (await response.json()) as WorkspaceSnapshot;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowboard-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported workspace snapshot");
  };

  const importWorkspaceSnapshot = async (file: File, mode: "append" | "replace") => {
    if (!workspaceId || !currentUserId) {
      toast.error("Session not ready for import");
      return;
    }

    setServerImportBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as WorkspaceSnapshot;
      const projectsPayload = parsed.data?.projects ?? [];
      const workItemsPayload = parsed.data?.workItems ?? [];
      const notesPayload = parsed.data?.notes ?? [];

      const importResponse = await fetch("/api/workspace/import-local", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": currentUserId,
        },
        body: JSON.stringify({
          workspaceId,
          actorUserId: currentUserId,
          mode,
          projects: projectsPayload,
          workItems: workItemsPayload,
          notes: notesPayload,
        }),
      });

      if (!importResponse.ok) {
        throw new Error("Failed to import workspace snapshot");
      }

      if (parsed.settings) {
        const notifications = normalizeNotificationPreferences(parsed.settings.notifications ?? {});
        const settingsResponse = await fetch("/api/settings", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
            "x-flowboard-user-id": currentUserId,
          },
          body: JSON.stringify({
            workspaceId,
            userId: currentUserId,
            ...(parsed.settings.theme ? { theme: parsed.settings.theme } : {}),
            ...(parsed.settings.density ? { density: parsed.settings.density } : {}),
            ...(parsed.settings.accent ? { accent: parsed.settings.accent } : {}),
            notifications,
          }),
        });
        if (!settingsResponse.ok) {
          throw new Error("Workspace data imported, but restoring settings failed");
        }

        updateSettings({
          ...(parsed.settings.theme ? { theme: parsed.settings.theme } : {}),
          ...(parsed.settings.density ? { density: parsed.settings.density } : {}),
          ...(parsed.settings.accent ? { accent: parsed.settings.accent } : {}),
          notifications,
        });
        if (parsed.settings.theme) {
          setTheme(parsed.settings.theme);
        }
      }

      toast.success(`Imported workspace snapshot (${mode})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid snapshot JSON");
    } finally {
      setServerImportBusy(false);
    }
  };

  const onReset = () => {
    if (confirm("Reset all data to seed defaults? This cannot be undone.")) {
      resetData();
      toast("Workspace reset to seed data");
    }
  };

  const exportCSV = () => {
    const rows = useStore.getState().workItems;
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowboard-work-items-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} work items as CSV`);
  };

  const importCSV = (file: File) => {
    Papa.parse<WorkItem>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed = (result.data as Partial<WorkItem>[])
          .filter((r) => r.id && r.title)
          .map<WorkItem>((r) => ({
            id: r.id!,
            title: r.title!,
            status: (r.status as Status) ?? "Backlog",
            priority: (r.priority as Priority) ?? "Medium",
            assignee: r.assignee ?? "AM",
            label: r.label ?? "Task",
            due: r.due ?? new Date().toISOString().slice(0, 10),
            project: r.project ?? "core",
          }));
        if (parsed.length === 0) { toast.error("No valid rows in CSV"); return; }
        useStore.setState((s) => ({ workItems: [...parsed, ...s.workItems.filter((w) => !parsed.some((p) => p.id === w.id))] }));
        toast.success(`Imported ${parsed.length} work items`);
      },
      error: () => toast.error("CSV parse failed"),
    });
  };

  const importLocalToServer = async (mode: "append" | "replace") => {
    setServerImportBusy(true);
    try {
      const session = await getServerSession();
      const response = await fetch("/api/workspace/import-local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId: session.workspace.id,
          actorUserId: session.user.id,
          mode,
          projects: projects.map((project) => ({
            id: project.id,
            name: project.name,
            status: project.status,
            due: project.due,
            accent: project.accent,
          })),
          workItems: workItems.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
            priority: item.priority,
            assignee: item.assignee,
            due: item.due,
            start: item.start,
            project: item.project,
            description: item.description,
          })),
          notes: notes.map((note) => ({
            id: note.id,
            title: note.title,
            tag: note.tag,
            excerpt: note.excerpt,
            body: note.excerpt,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error("Server import failed");
      }

      const payload = (await response.json()) as {
        imported: { projects: number; workItems: number; notes: number };
        skipped: { workItems: number; notes: number };
      };

      toast.success(`Server import complete (${mode})`, {
        description: `Projects ${payload.imported.projects}, Tasks ${payload.imported.workItems}, Notes ${payload.imported.notes}`,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to import local data to server");
    } finally {
      setServerImportBusy(false);
    }
  };

  return (
    <AppShell title={<span className="font-medium">Settings</span>}>
      <div className="flex h-full">
        <aside className="w-56 shrink-0 border-r bg-sidebar/40 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</div>
          {sections.map((x) => (
            <button key={x} onClick={() => setSection(x)}
              className={`lov-menu-item py-1.5 text-[13px] ${section === x ? "lov-menu-item-active" : ""}`}>{x}</button>
          ))}
        </aside>

        <div className="mx-auto w-full max-w-2xl px-8 py-8">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[19px] font-semibold tracking-tight">{section}</h1>
            <SaveIndicator />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Manage your {section.toLowerCase()} preferences. Changes save automatically.</p>

          {section === "General" && (
            <div className="mt-8 space-y-6">
              <Field label="Workspace name" hint="Shown in the sidebar.">
                <input
                  value={settings.workspaceName}
                  onChange={(e) => updateSettings({ workspaceName: e.target.value })}
                  className="lov-input"
                />
              </Field>
              <Field label="Danger zone" hint="Reset all tasks, projects, and notes to seed defaults.">
                <button onClick={onReset} className="lov-btn lov-btn-danger">Reset workspace</button>
              </Field>
            </div>
          )}

          {section === "Appearance" && (
            <div className="mt-8 space-y-6">
              <Field label="Theme">
                <div className="flex gap-2">
                  {(["system", "light", "dark"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTheme(t);
                        updateSettings({ theme: t });
                        void persistUserSettings({ theme: t });
                      }}
                      className={`lov-btn capitalize ${settings.theme === t ? "lov-btn-active" : ""}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Accent">
                <div className="flex gap-2">
                  {ACCENTS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => {
                        updateSettings({ accent: c.value });
                        void persistUserSettings({ accent: c.value });
                      }}
                      title={c.label}
                      className={`h-6 w-6 rounded-full ring-offset-2 ${settings.accent === c.value ? "ring-2 ring-ring" : ""}`}
                      style={{ background: c.value }}
                    />
                  ))}
                </div>
              </Field>
              <Field label="Density">
                <select
                  value={settings.density}
                  onChange={(e) => {
                    const density = e.target.value as "compact" | "comfortable";
                    updateSettings({ density });
                    void persistUserSettings({ density });
                  }}
                  className="lov-input"
                >
                  <option value="compact">Compact</option>
                  <option value="comfortable">Comfortable</option>
                </select>
              </Field>
              <Field label="Priority display" hint="How priority shows up across boards, tables, and the task drawer.">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {([
                    { key: "arrows", title: "Arrows", desc: "Up / right / down" },
                    { key: "labels", title: "P1 / P2 / P3", desc: "Jira-style chips" },
                    { key: "shapes", title: "Shapes", desc: "Stop / caution / neutral" },
                  ] as { key: PriorityStyle; title: string; desc: string }[]).map((opt) => {
                    const active = settings.priorityStyle === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => updateSettings({ priorityStyle: opt.key })}
                        className={`flex flex-col items-start gap-2 rounded border bg-card p-3 text-left transition ${active ? "border-ring bg-[color-mix(in_oklch,var(--color-primary)_11%,var(--color-card))] ring-2 ring-ring/30" : "hover:bg-[var(--color-hover)]"}`}
                      >
                        <div className="flex items-center gap-2">
                          <PriorityIcon p="High" style={opt.key} />
                          <PriorityIcon p="Medium" style={opt.key} />
                          <PriorityIcon p="Low" style={opt.key} />
                        </div>
                        <div>
                          <div className="text-[12px] font-medium">{opt.title}</div>
                          <div className="text-[11px] text-muted-foreground">{opt.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Live preview" hint="Use this to compare accent, density, and priority choices before leaving settings.">
                <AppearancePreview accent={settings.accent} density={settings.density} priorityStyle={settings.priorityStyle} />
              </Field>
            </div>
          )}

          {section === "Notifications" && (
            <div className="mt-8 space-y-3">
              {Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).map((key) => (
                <label key={key} className="flex items-center justify-between border-b py-2 text-[13px]">
                  <span>{key}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(settings.notifications[key])}
                    onChange={(event) => updateSettings({
                      notifications: (() => {
                        const next = {
                          ...normalizeNotificationPreferences(settings.notifications),
                          [key]: event.target.checked,
                        };
                        void persistUserSettings({ notifications: next });
                        return next;
                      })(),
                    })}
                    className="h-4 w-7 appearance-none rounded-full bg-muted checked:bg-primary"
                  />
                </label>
              ))}
            </div>
          )}

          {section === "Data" && (
            <div className="mt-8 space-y-6">
              <Field label="JSON snapshot" hint="Server-backed workspace snapshot (active workspace only), including user settings.">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importWorkspaceSnapshot(f, snapshotImportMode);
                    e.target.value = "";
                  }}
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSnapshotImportMode("append");
                      fileRef.current?.click();
                    }}
                    disabled={serverImportBusy}
                    className="lov-btn"
                  >
                    {serverImportBusy ? "Importing..." : "Import JSON (append)"}
                  </button>
                  <button
                    onClick={() => {
                      setSnapshotImportMode("replace");
                      fileRef.current?.click();
                    }}
                    disabled={serverImportBusy}
                    className="lov-btn lov-btn-danger"
                  >
                    {serverImportBusy ? "Importing..." : "Import JSON (replace)"}
                  </button>
                  <button onClick={() => void exportWorkspaceSnapshot()} className="lov-btn">
                    Export JSON
                  </button>
                </div>
              </Field>
              <Field label="Work items (CSV)" hint="Import or export tasks for spreadsheet workflows.">
                <input
                  ref={csvRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importCSV(f); e.target.value = ""; }}
                />
                <div className="flex gap-2">
                  <button onClick={() => csvRef.current?.click()} className="lov-btn">Import CSV</button>
                  <button onClick={exportCSV} className="lov-btn">Export CSV</button>
                </div>
              </Field>
              <Field label="Reset" hint="Reload seed data (keeps your settings).">
                <button onClick={onReset} className="lov-btn lov-btn-danger">Reset to seed</button>
              </Field>
              <Field
                label="Server migration"
                hint="Import current local workspace into server persistence. Append keeps existing server records; Replace clears workspace records first."
              >
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => void importLocalToServer("append")}
                    disabled={serverImportBusy}
                    className="lov-btn"
                  >
                    {serverImportBusy ? "Importing..." : "Append to server"}
                  </button>
                  <button
                    onClick={() => void importLocalToServer("replace")}
                    disabled={serverImportBusy}
                    className="lov-btn lov-btn-danger"
                  >
                    {serverImportBusy ? "Importing..." : "Replace server data"}
                  </button>
                </div>
              </Field>
            </div>
          )}

          {section === "Account" && (
            <div className="mt-8 space-y-6">
              <div className="flex items-center gap-3 border-b pb-5">
                <Avatar id={currentMember.id} name={currentMember.name} size={40} />
                <div>
                  <div className="text-[14px] font-medium">{currentMember.name}</div>
                  <div className="text-[12px] text-muted-foreground">{currentMember.role}</div>
                </div>
              </div>
              <Field label="Avatar" hint="Pick a generated avatar style or revert to initials.">
                <AvatarPicker memberId={currentMember.id} />
              </Field>
              <Field label="Display name">
                <input
                  value={currentMember.name}
                  onChange={(event) => updateMember(currentMember.id, { name: event.target.value })}
                  className="lov-input"
                />
              </Field>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
