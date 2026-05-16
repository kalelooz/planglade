import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app/shell";
import { Avatar } from "@/components/app/icons";

export const Route = createFileRoute("/settings")({
  component: Settings,
  head: () => ({ meta: [{ title: "Settings — FlowBoard" }] }),
});

const sections = ["General", "Appearance", "Notifications", "Data", "Account"] as const;

function Settings() {
  const [s, setS] = useState<(typeof sections)[number]>("General");
  return (
    <AppShell title={<span className="font-medium">Settings</span>}>
      <div className="flex h-full">
        <aside className="w-56 shrink-0 border-r bg-sidebar/40 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace</div>
          {sections.map((x) => (
            <button key={x} onClick={() => setS(x)}
              className={`block w-full rounded px-2 py-1.5 text-left text-[13px] ${s === x ? "bg-hover font-medium" : "text-muted-foreground hover:bg-hover hover:text-foreground"}`}>{x}</button>
          ))}
        </aside>

        <div className="mx-auto w-full max-w-2xl px-8 py-8">
          <h1 className="text-[19px] font-semibold tracking-tight">{s}</h1>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Manage your {s.toLowerCase()} preferences for Acme Inc.</p>

          {s === "General" && (
            <div className="mt-8 space-y-6">
              <Field label="Workspace name" hint="Shown in the sidebar and shared links."><input defaultValue="Acme Inc." className="input" /></Field>
              <Field label="Workspace URL" hint="flowboard.app/—"><input defaultValue="acme" className="input" /></Field>
              <Field label="Default project"><select className="input"><option>Core Product</option><option>Website Redesign</option></select></Field>
              <Field label="Week starts on"><select className="input"><option>Monday</option><option>Sunday</option></select></Field>
              <Divider />
              <Field label="Danger zone" hint="Permanently delete this workspace and all its data."><button className="rounded border border-red-200 px-3 py-1.5 text-[12px] font-medium text-red-700 hover:bg-red-50">Delete workspace</button></Field>
            </div>
          )}

          {s === "Appearance" && (
            <div className="mt-8 space-y-6">
              <Field label="Theme">
                <div className="flex gap-2">
                  {["System", "Light", "Dark"].map((t, i) => (
                    <button key={t} className={`rounded border px-3 py-1.5 text-[12px] ${i === 1 ? "border-ring bg-hover" : ""}`}>{t}</button>
                  ))}
                </div>
              </Field>
              <Field label="Accent">
                <div className="flex gap-2">
                  {["oklch(0.52 0.09 195)","oklch(0.55 0.15 250)","oklch(0.55 0.13 145)","oklch(0.65 0.16 330)","oklch(0.62 0.15 30)"].map((c, i) => (
                    <button key={c} className={`h-6 w-6 rounded-full ring-offset-2 ${i === 0 ? "ring-2 ring-ring" : ""}`} style={{ background: c }} />
                  ))}
                </div>
              </Field>
              <Field label="Density"><select className="input"><option>Compact</option><option>Comfortable</option></select></Field>
            </div>
          )}

          {s === "Notifications" && (
            <div className="mt-8 space-y-3">
              {["Assigned to me","Mentioned","Comments on my items","Status changes","Weekly digest"].map((n, i) => (
                <label key={n} className="flex items-center justify-between border-b py-2 text-[13px]">
                  <span>{n}</span>
                  <input type="checkbox" defaultChecked={i < 3} className="h-4 w-7 appearance-none rounded-full bg-muted checked:bg-primary" />
                </label>
              ))}
            </div>
          )}

          {s === "Data" && (
            <div className="mt-8 space-y-6">
              <Field label="Import" hint="Bring in tasks from a CSV or another tool."><button className="rounded border px-3 py-1.5 text-[12px]">Import CSV…</button></Field>
              <Field label="Export" hint="Download a full snapshot of your workspace."><button className="rounded border px-3 py-1.5 text-[12px]">Export JSON</button></Field>
            </div>
          )}

          {s === "Account" && (
            <div className="mt-8 space-y-6">
              <div className="flex items-center gap-3 border-b pb-5">
                <Avatar id="AM" name="Alex Morgan" size={40} />
                <div>
                  <div className="text-[14px] font-medium">Alex Morgan</div>
                  <div className="text-[12px] text-muted-foreground">alex@acme.com · Product Lead</div>
                </div>
              </div>
              <Field label="Display name"><input defaultValue="Alex Morgan" className="input" /></Field>
              <Field label="Active sessions" hint="Sign out of all other devices.">
                <button className="rounded border px-3 py-1.5 text-[12px]">End all other sessions</button>
              </Field>
            </div>
          )}
        </div>
      </div>

      <style>{`.input { height: 32px; width: 100%; max-width: 360px; border-radius: 6px; border: 1px solid var(--color-border); background: var(--color-card); padding: 0 8px; font-size: 13px; outline: none; }
      .input:focus { border-color: var(--color-ring); }`}</style>
    </AppShell>
  );
}

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
function Divider() { return <div className="h-px bg-border" />; }
