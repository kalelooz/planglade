"use client"

import { Monitor, Moon, Sun } from "lucide-react"

import { AppShell } from "@/components/lovable/shell"
import { DEMO_MODE_MESSAGE, demoSession } from "@/lib/demo-data"
import { useThemePreference } from "@/lib/theme-preference"

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const

export default function DemoSettingsPage() {
  const { theme, selectTheme } = useThemePreference()

  return (
    <AppShell title={<span className="font-medium">Settings</span>}>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6" data-demo-settings="true">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Demo settings</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">{DEMO_MODE_MESSAGE} Appearance changes apply only in this browser.</p>
        </header>

        <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="demo-appearance-title">
          <div className="border-b px-4 py-3"><h2 id="demo-appearance-title" className="text-sm font-semibold">Appearance</h2><p className="mt-0.5 text-xs text-muted-foreground">Choose how the demo looks on this device.</p></div>
          <div className="flex flex-wrap gap-2 p-4">
            {themes.map(({ value, label, icon: Icon }) => <button key={value} type="button" onClick={() => selectTheme(value)} aria-pressed={theme === value} className={`lov-btn gap-2 ${theme === value ? "border-foreground/30 bg-muted" : ""}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
          </div>
        </section>

        <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="demo-account-title">
          <div className="border-b px-4 py-3"><h2 id="demo-account-title" className="text-sm font-semibold">Demo account</h2><p className="mt-0.5 text-xs text-muted-foreground">Read-only sample identity and workspace information.</p></div>
          <dl className="grid gap-4 px-4 py-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">Account</dt><dd className="mt-1 font-medium">{demoSession.user.name}</dd><dd className="text-xs text-muted-foreground">{demoSession.user.email}</dd></div><div><dt className="text-xs text-muted-foreground">Current workspace</dt><dd className="mt-1 font-medium">{demoSession.workspace.name}</dd><dd className="text-xs text-muted-foreground">Role: {demoSession.members[0]?.role}</dd></div></dl>
        </section>
      </main>
    </AppShell>
  )
}
