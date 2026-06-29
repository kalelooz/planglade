"use client";
import { useEffect, useRef, useState } from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import Papa from "papaparse";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import type { WorkItem, Status, Priority } from "@/lib/mock-data";
import { AppShell } from "@/components/lovable/shell";
import { Avatar } from "@/components/lovable/icons";
import { PriorityIndicator } from "@/components/lovable/priority-indicator";
import { TaskCompletionToggle } from "@/components/lovable/task-completion-toggle";
import { useStore, type PriorityDisplayStyle } from "@/lib/store";
import { AvatarPicker } from "@/components/lovable/avatar-picker";
import { SaveIndicator } from "@/components/lovable/save-indicator";
import { apiFetch, getServerSession } from "@/lib/server-session-client";
import { DEFAULT_NOTIFICATION_PREFERENCES, normalizeNotificationPreferences } from "@/lib/notification-preferences";

const sections = ["General", "Appearance", "Data", "Account"] as const;
type Section = (typeof sections)[number];
const isDevelopment = process.env.NODE_ENV === "development";
const sectionDescriptions: Record<Section, string> = {
  General: "Manage your PlanGlade Workspace label and notification preferences.",
  Appearance: "Choose how PlanGlade looks on this device.",
  Data: "Export backups and safely merge a previewed PlanGlade workspace file.",
  Account: "Manage your local profile details.",
};

type WorkspaceSnapshot = {
  version?: number;
  exportedAt?: string;
  generatedAt?: string;
  workspace?: { id: string; slug?: string; name?: string };
  projects?: unknown[];
  tasks?: unknown[];
  inboxItems?: unknown[];
  notes?: unknown[];
  labels?: unknown[];
  taskLabels?: unknown[];
  legacyDocs?: unknown[];
  settings?: {
    userId?: string;
    theme?: "system" | "light" | "dark" | null;
    density?: "compact" | "comfortable" | null;
    accent?: string | null;
    taskPriorityDisplayStyle?: PriorityDisplayStyle | null;
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
    projectDocs?: Array<{
      id: string;
      project?: string;
      title: string;
      body?: string;
      status?: "ACTIVE" | "ARCHIVED";
      archivedAt?: string;
    }>;
  };
};

type ImportPreview = {
  counts: {
    projects: number;
    tasks: number;
    notes: number;
    projectDocs: number;
    settings: number;
    archivedProjectDocs: number;
  };
  duplicateCandidates?: {
    projects?: number;
    tasks?: number;
    notes?: number;
    projectDocs?: number;
  };
  relationIssues?: {
    tasksMissingProjects?: number;
    projectDocsMissingProjects?: number;
    tasksMissingNotes?: number;
  };
  warnings: Array<{ code: string; message: string; count?: number }>;
  writes: false;
};

type ImportSummary = {
  imported: {
    projects: number;
    workItems: number;
    notes: number;
    projectDocs: number;
  };
  skipped: {
    workItems: number;
    notes: number;
    projectDocs: number;
  };
  warnings?: {
    projectDocsMissingProjects?: number;
  };
};

function getGuidedImportFileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function getDuplicateCandidateCount(preview: ImportPreview | null) {
  if (!preview?.duplicateCandidates) return 0;
  return Object.values(preview.duplicateCandidates).reduce((total, count) => total + (count ?? 0), 0);
}

const ACCENTS = [
  { value: "oklch(0.395 0.120 155)", label: "Moss" },
  { value: "oklch(0.21 0.006 286)", label: "Black" },
  { value: "oklch(0.52 0.09 195)", label: "Teal" },
  { value: "oklch(0.55 0.15 250)", label: "Blue" },
  { value: "oklch(0.55 0.13 145)", label: "Green" },
  { value: "oklch(0.65 0.16 330)", label: "Rose" },
  { value: "oklch(0.62 0.15 30)", label: "Orange" },
];

const PRIORITY_DISPLAY_OPTIONS: Array<{ key: PriorityDisplayStyle; title: string }> = [
  { key: "text", title: "Text" },
  { key: "dot", title: "Dots" },
  { key: "badge", title: "Badge" },
  { key: "arrow", title: "Arrows" },
];

const STATIC_PREVIEW_TASKS: Array<Pick<WorkItem, "id" | "title" | "priority" | "status">> = [
  { id: "preview-high", title: "Prepare launch checklist", priority: "High", status: "To Do" },
  { id: "preview-medium", title: "Review project notes", priority: "Medium", status: "In Progress" },
  { id: "preview-low", title: "Clean up inbox captures", priority: "Low", status: "Backlog" },
];

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-3 border-b pb-5 sm:grid-cols-[180px_1fr] sm:gap-6">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[12px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AppearancePreview({
  density,
  priorityDisplayStyle,
}: {
  density: "compact" | "comfortable";
  priorityDisplayStyle: PriorityDisplayStyle;
}) {
  const relaxed = density === "comfortable";
  const rowPadding = relaxed ? "py-2.5" : "py-1.5";
  const rowGap = relaxed ? "gap-3" : "gap-2";

  return (
    <div data-priority-preview="live" className="max-w-xl overflow-hidden rounded-md border border-zinc-200/80 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-200/80 px-3 py-1.5">
        <div className="text-[10px] font-medium uppercase text-muted-foreground">Task row sample</div>
        <div className="hidden text-[10px] text-muted-foreground sm:block">High / Medium / Low</div>
      </div>

      <div className="min-w-0">
        {STATIC_PREVIEW_TASKS.map((task) => (
          <div
            key={task.id}
            data-preview-task-row="true"
            className={`grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center ${rowGap} border-b px-3 text-[13px] last:border-b-0 ${rowPadding}`}
          >
            <TaskCompletionToggle checked={false} onToggle={() => undefined} ariaLabel={`Complete ${task.title}`} />
            <PriorityIndicator priority={task.priority} style={priorityDisplayStyle} />
            <span className="min-w-0 truncate font-medium">{task.title}</span>
            <PreviewStaticMeta status={task.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PriorityStyleOptionExample({ style }: { style: PriorityDisplayStyle }) {
  if (style === "text") {
    return (
      <span className="flex min-w-0 items-center gap-1 text-[10px] text-zinc-500">
        <span>High</span>
        <span className="text-zinc-300">/</span>
        <span>Medium</span>
        <span className="text-zinc-300">/</span>
        <span>Low</span>
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {(["High", "Medium", "Low"] as const).map((priority) => (
        <PriorityIndicator key={priority} priority={priority} style={style} />
      ))}
    </span>
  );
}

function PreviewStaticMeta({ status }: { status: string }) {
  return (
    <span className="hidden max-w-28 truncate rounded border border-zinc-200/80 bg-zinc-50 px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-flex">
      {status}
    </span>
  );
}

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("General");
  const [serverImportBusy, setServerImportBusy] = useState(false);
  const [workspaceExportBusy, setWorkspaceExportBusy] = useState(false);
  const [workspaceExportMessage, setWorkspaceExportMessage] = useState<string | null>(null);
  const [workspaceExportError, setWorkspaceExportError] = useState<string | null>(null);
  const [snapshotImportMode, setSnapshotImportMode] = useState<"append" | "replace">("append");
  const [guidedImportBusy, setGuidedImportBusy] = useState(false);
  const [guidedImportConfirm, setGuidedImportConfirm] = useState(false);
  const [guidedImportError, setGuidedImportError] = useState<string | null>(null);
  const [guidedImportFileName, setGuidedImportFileName] = useState<string | null>(null);
  const [guidedImportFileKey, setGuidedImportFileKey] = useState<string | null>(null);
  const [guidedImportPreviewFileKey, setGuidedImportPreviewFileKey] = useState<string | null>(null);
  const [lastGuidedImportFileKey, setLastGuidedImportFileKey] = useState<string | null>(null);
  const [guidedImportPreview, setGuidedImportPreview] = useState<ImportPreview | null>(null);
  const [guidedImportSnapshot, setGuidedImportSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [guidedImportSummary, setGuidedImportSummary] = useState<ImportSummary | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
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
  const guidedImportFileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const currentMember = members.find((m) => m.id === "AM") ?? members[0] ?? {
    id: "AM",
    name: "Alex Morgan",
    role: "Product Lead",
    color: "oklch(0.62 0.13 195)",
  };
  const guidedImportDuplicateCount = getDuplicateCandidateCount(guidedImportPreview);
  const guidedImportPreviewIsCurrent =
    Boolean(guidedImportFileKey) &&
    guidedImportFileKey === guidedImportPreviewFileKey &&
    Boolean(guidedImportPreview) &&
    Boolean(guidedImportSnapshot) &&
    !guidedImportError;
  const guidedImportSameFileJustImported =
    Boolean(guidedImportFileKey) && guidedImportFileKey === lastGuidedImportFileKey;
  const canRunGuidedImport =
    Boolean(workspaceId) &&
    guidedImportPreviewIsCurrent &&
    guidedImportConfirm &&
    !guidedImportBusy &&
    !guidedImportSameFileJustImported;

  const persistUserSettings = async (patch: Partial<{
    theme: "system" | "light" | "dark";
    density: "compact" | "comfortable";
    accent: string;
    notifications: Record<string, boolean>;
    taskPriorityDisplayStyle: PriorityDisplayStyle;
  }>) => {
    if (!workspaceId || !currentUserId) return;
    await apiFetch("/api/settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
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

        const response = await apiFetch(
          `/api/settings?workspaceId=${encodeURIComponent(session.workspace.id)}&userId=${encodeURIComponent(session.user.id)}`,
          {
            cache: "no-store",
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
          workspace?: {
            taskPriorityDisplayStyle: PriorityDisplayStyle | null;
          } | null;
        };

        if (!active) return;

        const notifications = normalizeNotificationPreferences(payload.settings?.notifications);
        updateSettings({
          ...(payload.settings?.theme ? { theme: payload.settings.theme } : {}),
          ...(payload.settings?.density ? { density: payload.settings.density } : {}),
          ...(payload.settings?.accent ? { accent: payload.settings.accent } : {}),
          ...(payload.workspace?.taskPriorityDisplayStyle ? { priorityDisplayStyle: payload.workspace.taskPriorityDisplayStyle } : {}),
          notifications,
        });
        if (payload.settings?.theme) {
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
    if (!workspaceId) {
      toast.error("Session not ready for export");
      setWorkspaceExportError("Session not ready for export.");
      setWorkspaceExportMessage(null);
      return;
    }

    setWorkspaceExportBusy(true);
    setWorkspaceExportError(null);
    setWorkspaceExportMessage(null);
    try {
      const response = await apiFetch(
        `/api/workspace/export?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to export workspace data");
      }

      const payload = (await response.json()) as WorkspaceSnapshot;
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const fileName = `planglade-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
      setWorkspaceExportMessage(`Downloaded ${fileName}.`);
      toast.success("Downloaded workspace JSON");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to export workspace data";
      setWorkspaceExportError(message);
      toast.error(message);
    } finally {
      setWorkspaceExportBusy(false);
    }
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

      const importResponse = await apiFetch("/api/workspace/import-local", {
        method: "POST",
        headers: {
          "content-type": "application/json",
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
        const settingsResponse = await apiFetch("/api/settings", {
          method: "PUT",
          headers: {
            "content-type": "application/json",
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

      toast.success(`Imported PlanGlade Workspace snapshot (${mode})`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid snapshot JSON");
    } finally {
      setServerImportBusy(false);
    }
  };

  const previewGuidedImport = async (file: File) => {
    if (!workspaceId) {
      toast.error("Session not ready for import preview");
      return;
    }

    setGuidedImportBusy(true);
    setGuidedImportConfirm(false);
    setGuidedImportError(null);
    setGuidedImportPreview(null);
    setGuidedImportSnapshot(null);
    setGuidedImportSummary(null);
    setGuidedImportFileName(file.name);
    setGuidedImportFileKey(getGuidedImportFileKey(file));
    setGuidedImportPreviewFileKey(null);

    try {
      const text = await file.text();
      const snapshot = JSON.parse(text) as WorkspaceSnapshot;
      const response = await apiFetch(
        `/api/workspace/import-preview?workspaceId=${encodeURIComponent(workspaceId)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(snapshot),
        }
      );

      const payload = (await response.json()) as ImportPreview | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Import preview failed");
      }

      setGuidedImportSnapshot(snapshot);
      setGuidedImportPreview(payload as ImportPreview);
      setGuidedImportPreviewFileKey(getGuidedImportFileKey(file));
      toast.success("Import preview ready");
    } catch (error) {
      setGuidedImportError(error instanceof Error ? error.message : "Invalid workspace JSON");
      toast.error(error instanceof Error ? error.message : "Invalid workspace JSON");
    } finally {
      setGuidedImportBusy(false);
    }
  };

  const runGuidedImport = async () => {
    if (!workspaceId || !guidedImportPreview || !guidedImportSnapshot || !guidedImportConfirm || !canRunGuidedImport) {
      return;
    }

    setGuidedImportBusy(true);
    setGuidedImportError(null);
    setGuidedImportSummary(null);

    try {
      const response = await apiFetch("/api/workspace/import-local", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          mode: "append",
          projects: guidedImportSnapshot.data?.projects ?? [],
          workItems: guidedImportSnapshot.data?.workItems ?? [],
          notes: guidedImportSnapshot.data?.notes ?? [],
          projectDocs: guidedImportSnapshot.data?.projectDocs ?? [],
        }),
      });

      const payload = (await response.json()) as ImportSummary | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "Workspace import failed");
      }

      setGuidedImportSummary(payload as ImportSummary);
      setGuidedImportConfirm(false);
      setLastGuidedImportFileKey(guidedImportFileKey);
      toast.success("Workspace import merged");
    } catch (error) {
      setGuidedImportError(error instanceof Error ? error.message : "Workspace import failed");
      toast.error(error instanceof Error ? error.message : "Workspace import failed");
    } finally {
      setGuidedImportBusy(false);
    }
  };

  const onReset = () => {
    resetData();
    setResetConfirmOpen(false);
    toast("Development seed data restored");
  };

  const exportCSV = () => {
    const rows = useStore.getState().workItems;
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `planglade-tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} tasks as CSV`);
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
            project: r.project ?? "general",
          }));
        if (parsed.length === 0) { toast.error("No valid rows in CSV"); return; }
        useStore.setState((s) => ({ workItems: [...parsed, ...s.workItems.filter((w) => !parsed.some((p) => p.id === w.id))] }));
        toast.success(`Imported ${parsed.length} tasks`);
      },
      error: () => toast.error("CSV parse failed"),
    });
  };

  const importLocalToServer = async (mode: "append" | "replace") => {
    setServerImportBusy(true);
    try {
      const session = await getServerSession();
      const response = await apiFetch("/api/workspace/import-local", {
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
      <div className="flex h-full min-w-0 flex-col overflow-y-auto md:flex-row">
        <aside className="shrink-0 border-b bg-sidebar/40 p-3 md:w-56 md:border-r md:border-b-0">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</div>
          <div className="flex gap-1 overflow-x-auto md:block md:space-y-1 md:overflow-visible">
            {sections.map((x) => (
              <button key={x} onClick={() => setSection(x)}
                className={`lov-menu-item shrink-0 py-1.5 text-[13px] md:w-full ${section === x ? "lov-menu-item-active" : ""}`}>{x}</button>
            ))}
          </div>
        </aside>

        <div className="mx-auto w-full min-w-0 max-w-2xl px-4 py-6 sm:px-6 md:px-8 md:py-8">
          <div className="flex items-baseline justify-between gap-3">
            <h1 className="text-[19px] font-semibold tracking-tight">{section}</h1>
            <SaveIndicator />
          </div>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{sectionDescriptions[section]}</p>

          {section === "General" && (
            <div className="mt-8 space-y-6">
              <Field label="Workspace name" hint="Shown in the sidebar as your PlanGlade Workspace label.">
                <input
                  value={settings.workspaceName}
                  onChange={(e) => updateSettings({ workspaceName: e.target.value })}
                  className="lov-input"
                />
              </Field>
              <Field label="Notifications" hint="Choose which PlanGlade updates should notify you.">
                <div className="space-y-2">
                  {Object.keys(DEFAULT_NOTIFICATION_PREFERENCES).map((key) => (
                    <label key={key} className="flex items-center justify-between border-b py-2 text-[13px] last:border-b-0">
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
              </Field>
            </div>
          )}

          {section === "Appearance" && (
            <div className="mt-6 max-w-4xl space-y-4">
              <Field label="Theme">
                <div className="flex flex-wrap gap-2">
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
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Accent">
                <div className="flex flex-wrap gap-2">
                  {ACCENTS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => {
                        updateSettings({ accent: c.value });
                        void persistUserSettings({ accent: c.value });
                      }}
                      title={c.label}
                      className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[12px] ${settings.accent === c.value ? "border-ring ring-2 ring-ring/30" : "border-border/70"}`}
                    >
                      <span className="h-4 w-4 rounded-full" style={{ background: c.value }} />
                      {c.label}
                    </button>
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
              <Field label="Priority display" hint="How priority appears in task rows, board cards, and the task drawer.">
                <div data-priority-picker-preview="connected" className="space-y-3">
                  <RadioGroupPrimitive.Root
                    data-priority-style-control="compact-options"
                    value={settings.priorityDisplayStyle}
                    onValueChange={(value) => {
                      const priorityDisplayStyle = value as PriorityDisplayStyle;
                      updateSettings({ priorityDisplayStyle });
                      void persistUserSettings({ taskPriorityDisplayStyle: priorityDisplayStyle });
                    }}
                    className="grid w-full max-w-xl grid-cols-2 gap-2"
                    aria-label="Priority display style"
                  >
                    {PRIORITY_DISPLAY_OPTIONS.map((opt) => {
                      return (
                        <RadioGroupPrimitive.Item
                          key={opt.key}
                          value={opt.key}
                          data-priority-style-option="true"
                          className="flex h-14 min-w-0 items-center justify-between gap-2 rounded-md border border-zinc-200/80 bg-white px-3 py-2 text-left text-xs text-zinc-600 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/20 focus-visible:ring-offset-1 data-[state=checked]:border-zinc-900 data-[state=checked]:bg-zinc-50 data-[state=checked]:text-zinc-950 data-[state=checked]:ring-1 data-[state=checked]:ring-zinc-900/10"
                          aria-label={`${opt.title} priority display`}
                        >
                          <span className="min-w-0 truncate font-medium">{opt.title}</span>
                          <PriorityStyleOptionExample style={opt.key} />
                        </RadioGroupPrimitive.Item>
                      );
                    })}
                  </RadioGroupPrimitive.Root>
                  <AppearancePreview density={settings.density} priorityDisplayStyle={settings.priorityDisplayStyle} />
                </div>
              </Field>
            </div>
          )}

          {section === "Data" && (
            <div className="mt-8 space-y-6">
              <Field label="PlanGlade export" hint="Download a server-backed snapshot of this workspace.">
                <div className="space-y-3">
                  <p className="max-w-xl text-[13px] text-muted-foreground">
                    Download workspace-owned projects, tasks, inbox captures, notes, labels, and backward-compatible legacy docs. Auth, session, password, and provider token data are never included.
                  </p>
                  <button
                    type="button"
                    onClick={() => void exportWorkspaceSnapshot()}
                    disabled={workspaceExportBusy || !workspaceId}
                    className="lov-btn"
                  >
                    {workspaceExportBusy ? "Downloading..." : "Download JSON"}
                  </button>
                  <div aria-live="polite" className="min-h-5">
                    {workspaceExportMessage && (
                      <p className="text-[12px] text-emerald-700 dark:text-emerald-300">{workspaceExportMessage}</p>
                    )}
                    {workspaceExportError && (
                      <p className="text-[12px] text-destructive">{workspaceExportError}</p>
                    )}
                  </div>
                </div>
              </Field>
              <Field label="PlanGlade import" hint="Preview a JSON backup, then merge it into this workspace.">
                <div className="space-y-4">
                  <input
                    ref={guidedImportFileRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void previewGuidedImport(file);
                      event.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => guidedImportFileRef.current?.click()}
                      disabled={guidedImportBusy || !workspaceId}
                      className="lov-btn"
                    >
                      {guidedImportBusy && !guidedImportPreview ? "Previewing..." : "Choose JSON to preview"}
                    </button>
                    {guidedImportFileName && (
                      <span className="text-[12px] text-muted-foreground">{guidedImportFileName}</span>
                    )}
                  </div>

                  {guidedImportError && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[13px] text-destructive">
                      {guidedImportError}
                    </div>
                  )}

                  {guidedImportPreview && (
                    <div className="space-y-4 rounded-md border bg-card p-3">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {[
                          ["Projects", guidedImportPreview.counts.projects],
                          ["Tasks", guidedImportPreview.counts.tasks],
                          ["Notes", guidedImportPreview.counts.notes],
                          ["Project Docs", guidedImportPreview.counts.projectDocs],
                          ["Settings", guidedImportPreview.counts.settings],
                          ["Archived docs", guidedImportPreview.counts.archivedProjectDocs],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded border bg-background px-2 py-2">
                            <div className="text-[11px] text-muted-foreground">{label}</div>
                            <div className="text-[16px] font-semibold">{value}</div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded border bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
                        This merge adds workspace items into the current workspace. Existing data stays in place. File settings are previewed only and are not applied.
                      </div>

                      {guidedImportDuplicateCount > 0 && (
                        <div className="rounded border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-900 dark:text-amber-100">
                          Possible duplicates found: PlanGlade checks simple name and title matches only. During merge, duplicate-looking items may be skipped, merged, or imported according to the existing import rules.
                        </div>
                      )}

                      {guidedImportPreview.warnings.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[12px] font-medium">Warnings</div>
                          <ul className="space-y-1">
                            {guidedImportPreview.warnings.map((warning) => (
                              <li key={`${warning.code}-${warning.count ?? 0}`} className="rounded border px-2 py-1.5 text-[12px] text-muted-foreground">
                                {warning.message}
                                {typeof warning.count === "number" ? ` (${warning.count})` : ""}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <label className="flex items-start gap-2 text-[13px]">
                        <input
                          type="checkbox"
                          checked={guidedImportConfirm}
                          onChange={(event) => setGuidedImportConfirm(event.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                        />
                        <span>I understand this will merge imported items into my current workspace.</span>
                      </label>

                      {guidedImportSameFileJustImported && (
                        <div className="rounded border bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
                          This file was just imported. Choose a different JSON file or preview this one again later to avoid an accidental repeat import.
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => void runGuidedImport()}
                        disabled={!canRunGuidedImport}
                        className="lov-btn lov-btn-primary"
                      >
                        {guidedImportBusy ? "Importing..." : "Import into this workspace"}
                      </button>
                    </div>
                  )}

                  {guidedImportSummary && (
                    <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-[13px]">
                      Import merged. Projects {guidedImportSummary.imported.projects}, tasks {guidedImportSummary.imported.workItems}, notes {guidedImportSummary.imported.notes}, Project Docs {guidedImportSummary.imported.projectDocs}. Refresh or open a workspace view to see imported items.
                    </div>
                  )}
                </div>
              </Field>
              {isDevelopment && (
                <details className="rounded-md border border-dashed bg-muted/20 p-4">
                  <summary className="cursor-pointer text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Development tools
                  </summary>
                  <p className="mt-2 text-[13px] text-muted-foreground">
                    These tools are hidden in production because they can overwrite workspace data or use local browser state.
                  </p>
                  <div className="mt-4 space-y-6">
                    <Field label="JSON import" hint="Admin-only server import. Append keeps current data; replace deletes workspace records first.">
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/json"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (
                              snapshotImportMode === "replace" &&
                              !window.confirm(
                                "Replace PlanGlade Workspace data? This deletes existing projects, tasks, and notes before importing the selected file. This cannot be undone."
                              )
                            ) {
                              e.target.value = "";
                              return;
                            }
                            void importWorkspaceSnapshot(f, snapshotImportMode);
                          }
                          e.target.value = "";
                        }}
                      />
                      <div className="flex flex-wrap gap-2">
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
                      </div>
                    </Field>
                    <Field label="Tasks CSV" hint="Local browser import/export for development checks only; not the production backup path.">
                      <input
                        ref={csvRef}
                        type="file"
                        accept=".csv,text/csv"
                        className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) importCSV(f); e.target.value = ""; }}
                      />
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => csvRef.current?.click()} className="lov-btn">Import CSV</button>
                        <button onClick={exportCSV} className="lov-btn">Export CSV</button>
                      </div>
                    </Field>
                    <Field
                      label="Local migration"
                      hint="Imports current local browser data into server persistence. Replace clears server records first."
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
                          onClick={() => {
                            if (!window.confirm(
                              "Replace server data? This clears projects, tasks, and notes in this workspace before importing local browser data. This cannot be undone."
                            )) return;
                            void importLocalToServer("replace");
                          }}
                          disabled={serverImportBusy}
                          className="lov-btn lov-btn-danger"
                        >
                          {serverImportBusy ? "Importing..." : "Replace server data"}
                        </button>
                      </div>
                    </Field>
                    <Field label="Seed data reset" hint="Development-only reset. Keeps settings but restores starter tasks, projects, and notes.">
                      <button onClick={() => setResetConfirmOpen(true)} className="lov-btn lov-btn-danger">Reset seed data</button>
                    </Field>
                  </div>
                </details>
              )}
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
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center">
          <div className="absolute inset-0 bg-foreground/30" onClick={() => setResetConfirmOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded-lg border bg-background p-5 shadow-xl">
            <h2 className="text-[15px] font-semibold">Reset seed data?</h2>
            <p className="mt-2 text-[13px] text-muted-foreground">
              This development-only action restores starter tasks, projects, and notes in local state while keeping your settings. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setResetConfirmOpen(false)} className="lov-btn lov-btn-ghost">Cancel</button>
              <button onClick={onReset} className="lov-btn lov-btn-danger">Reset seed data</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
