"use client";
import { useState, useRef, useEffect } from "react";
import Papa from "papaparse";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import type { WorkItem, Status, Priority } from "@/lib/mock-data";
import { AppShell } from "@/components/lovable/shell";
import { Avatar, PriorityIcon } from "@/components/lovable/icons";
import { useStore, type PriorityStyle } from "@/lib/store";

const sections = ["General", "Appearance", "Notifications", "Data", "Account"] as const;
type Section = (typeof sections)[number];

const ACCENTS = [
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

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("General");
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const resetData = useStore((s) => s.resetData);
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);

  // Apply accent live to the document
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--primary", settings.accent);
    document.documentElement.style.setProperty("--ring", settings.accent);
    document.documentElement.style.setProperty("--accent", settings.accent);
  }, [settings.accent]);

  const exportJSON = () => {
    const data = useStore.getState();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `flowboard-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported workspace JSON");
  };

  const importJSON = (file: File) => {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text);
        useStore.setState(parsed);
        toast.success("Imported workspace from JSON");
      } catch {
        toast.error("Invalid JSON file");
      }
    });
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

  return (
    <AppShell title={<span className="font-medium">Settings</span>}>
      <div className="flex h-full">
        <aside className="w-56 shrink-0 border-r bg-sidebar/40 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</div>
          {sections.map((x) => (
            <button key={x} onClick={() => setSection(x)}
              className={`block w-full rounded px-2 py-1.5 text-left text-[13px] ${section === x ? "bg-[var(--color-hover)] font-medium" : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"}`}>{x}</button>
          ))}
        </aside>

        <div className="mx-auto w-full max-w-2xl px-8 py-8">
          <h1 className="text-[19px] font-semibold tracking-tight">{section}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Manage your {section.toLowerCase()} preferences.</p>

          {section === "General" && (
            <div className="mt-8 space-y-6">
              <Field label="Workspace name" hint="Shown in the sidebar.">
                <input
                  value={settings.workspaceName}
                  onChange={(e) => updateSettings({ workspaceName: e.target.value })}
                  className="lov-input"
                />
              </Field>
              <Field label="Week starts on">
                <select className="lov-input" defaultValue="Monday">
                  <option>Monday</option>
                  <option>Sunday</option>
                </select>
              </Field>
              <Field label="Danger zone" hint="Reset all tasks, projects, and notes to seed defaults.">
                <button onClick={onReset} className="rounded border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-50">Reset workspace</button>
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
                      onClick={() => { setTheme(t); updateSettings({ theme: t }); }}
                      className={`rounded border px-3 py-1.5 text-[12px] capitalize ${theme === t ? "border-ring bg-[var(--color-hover)]" : ""}`}
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
                      onClick={() => updateSettings({ accent: c.value })}
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
                  onChange={(e) => updateSettings({ density: e.target.value as "compact" | "comfortable" })}
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
                    { key: "shapes", title: "Shapes", desc: "Stop / caution / go" },
                  ] as { key: PriorityStyle; title: string; desc: string }[]).map((opt) => {
                    const active = settings.priorityStyle === opt.key;
                    return (
                      <button
                        key={opt.key}
                        onClick={() => updateSettings({ priorityStyle: opt.key })}
                        className={`flex flex-col items-start gap-2 rounded border bg-card p-3 text-left transition ${active ? "border-ring ring-2 ring-ring/30" : "hover:border-foreground/30"}`}
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
            </div>
          )}

          {section === "Notifications" && (
            <div className="mt-8 space-y-3">
              {Object.entries(settings.notifications).map(([key, val]) => (
                <label key={key} className="flex items-center justify-between border-b py-2 text-[13px]">
                  <span>{key}</span>
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => updateSettings({ notifications: { ...settings.notifications, [key]: e.target.checked } })}
                    className="h-4 w-7 appearance-none rounded-full bg-muted checked:bg-primary"
                  />
                </label>
              ))}
            </div>
          )}

          {section === "Data" && (
            <div className="mt-8 space-y-6">
              <Field label="JSON snapshot" hint="Full workspace including projects, notes, settings.">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) importJSON(f); e.target.value = ""; }}
                />
                <div className="flex gap-2">
                  <button onClick={() => fileRef.current?.click()} className="rounded border px-3 py-1.5 text-[12px]">Import JSON…</button>
                  <button onClick={exportJSON} className="rounded border px-3 py-1.5 text-[12px]">Export JSON</button>
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
                  <button onClick={() => csvRef.current?.click()} className="rounded border px-3 py-1.5 text-[12px]">Import CSV…</button>
                  <button onClick={exportCSV} className="rounded border px-3 py-1.5 text-[12px]">Export CSV</button>
                </div>
              </Field>
              <Field label="Reset" hint="Reload seed data (keeps your settings).">
                <button onClick={onReset} className="rounded border px-3 py-1.5 text-[12px]">Reset to seed</button>
              </Field>
            </div>
          )}

          {section === "Account" && (
            <div className="mt-8 space-y-6">
              <div className="flex items-center gap-3 border-b pb-5">
                <Avatar id="AM" name="Alex Morgan" size={40} />
                <div>
                  <div className="text-[14px] font-medium">Alex Morgan</div>
                  <div className="text-[12px] text-muted-foreground">alex@acme.com · Product Lead</div>
                </div>
              </div>
              <Field label="Display name"><input defaultValue="Alex Morgan" className="lov-input" /></Field>
              <Field label="Active sessions" hint="Sign out of all other devices.">
                <button className="rounded border px-3 py-1.5 text-[12px]">End all other sessions</button>
              </Field>
            </div>
          )}
        </div>
      </div>

      <style>{`.lov-input { height: 32px; width: 100%; max-width: 360px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-card); padding: 0 8px; font-size: 13px; outline: none; color: var(--color-foreground); }
      .lov-input:focus { border-color: var(--color-ring); }`}</style>
    </AppShell>
  );
}
