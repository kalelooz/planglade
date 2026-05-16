"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import { Settings, Sun, Moon, Monitor, Download, Upload, Trash2, Check } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { cn } from "@/lib/utils"
import { settingsGeneralSchema, type SettingsGeneralValues } from "@/components/flowboard/schemas"

// ── Accent color presets ─────────────────────────────────────────────────

const ACCENT_PRESETS = [
  { name: "Teal", hue: 195, light: "oklch(0.40 0.07 195)", dark: "oklch(0.55 0.09 195)", preview: "#01696f" },
  { name: "Blue", hue: 240, light: "oklch(0.40 0.10 240)", dark: "oklch(0.55 0.12 240)", preview: "#3b5bdb" },
  { name: "Purple", hue: 280, light: "oklch(0.42 0.12 280)", dark: "oklch(0.58 0.14 280)", preview: "#7c3aed" },
  { name: "Orange", hue: 35, light: "oklch(0.55 0.15 35)", dark: "oklch(0.65 0.16 35)", preview: "#ea580c" },
  { name: "Rose", hue: 350, light: "oklch(0.45 0.15 350)", dark: "oklch(0.58 0.16 350)", preview: "#e11d48" },
  { name: "Green", hue: 155, light: "oklch(0.42 0.10 155)", dark: "oklch(0.55 0.12 155)", preview: "#059669" },
]

// ── In-memory settings state ─────────────────────────────────────────────

interface SettingsState {
  // General
  appName: string
  defaultView: string
  dateFormat: string
  language: string
  // Appearance
  accentPreset: string
  sidebarWidth: "compact" | "normal" | "wide"
  fontSize: "small" | "medium" | "large"
  // Notifications
  notifTaskAssigned: boolean
  notifTaskDueTomorrow: boolean
  notifCommentOnTask: boolean
  notifProjectStatusChanged: boolean
}

const DEFAULT_SETTINGS: SettingsState = {
  appName: "FlowBoard",
  defaultView: "dashboard",
  dateFormat: "MMM D, YYYY",
  language: "en",
  accentPreset: "Teal",
  sidebarWidth: "normal",
  fontSize: "medium",
  notifTaskAssigned: true,
  notifTaskDueTomorrow: true,
  notifCommentOnTask: false,
  notifProjectStatusChanged: true,
}

// ── Accent color CSS variable updater ────────────────────────────────────

function applyAccentPreset(presetName: string) {
  const preset = ACCENT_PRESETS.find((p) => p.name === presetName)
  if (!preset) return

  const root = document.documentElement

  // Build the full set of CSS variable overrides for BOTH light and dark themes.
  // We store them as data attributes so theme switching picks up the right values
  // without needing to re-apply the preset.
  const h = preset.hue

  const lightVars: Record<string, string> = {
    "--primary": preset.light,
    "--primary-foreground": "oklch(0.98 0.005 " + h + ")",
    "--ring": preset.light,
    "--chart-1": preset.light,
    "--chart-2": "oklch(0.55 0.08 " + h + ")",
    "--chart-3": "oklch(0.65 0.06 " + h + ")",
    "--chart-4": "oklch(0.75 0.05 " + h + ")",
    "--chart-5": "oklch(0.30 0.06 " + h + ")",
    "--sidebar-primary": preset.light,
    "--sidebar-primary-foreground": "oklch(0.98 0.005 " + h + ")",
    "--sidebar-ring": preset.light,
  }

  const darkVars: Record<string, string> = {
    "--primary": preset.dark,
    "--primary-foreground": "oklch(0.12 0.02 " + h + ")",
    "--ring": preset.dark,
    "--chart-1": preset.dark,
    "--chart-2": "oklch(0.65 0.07 " + h + ")",
    "--chart-3": "oklch(0.45 0.06 " + h + ")",
    "--chart-4": "oklch(0.75 0.05 " + h + ")",
    "--chart-5": "oklch(0.35 0.05 " + h + ")",
    "--sidebar-primary": preset.dark,
    "--sidebar-primary-foreground": "oklch(0.12 0.02 " + h + ")",
    "--sidebar-ring": preset.dark,
  }

  // Apply ONLY the variables for the current active theme.
  // Inline styles on :root always win over CSS rules, so we must
  // not set both sets at once — the dark values would overwrite the light ones.
  const isDark = root.classList.contains("dark")
  const activeVars = isDark ? darkVars : lightVars

  // Clear any previous accent overrides first
  const allVarNames = [...Object.keys(lightVars)]
  allVarNames.forEach((key) => root.style.removeProperty(key))

  // Apply the active theme's variables
  Object.entries(activeVars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })

  // Also update the underlying CSS custom properties so that when the theme
  // toggles, the globals.css base values are replaced. We do this by injecting
  // a <style> tag that overrides both :root and .dark selectors.
  let styleEl = document.getElementById("flowboard-accent-override") as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement("style")
    styleEl.id = "flowboard-accent-override"
    document.head.appendChild(styleEl)
  }

  const lightCSS = Object.entries(lightVars).map(([k, v]) => `${k}: ${v}`).join("; ")
  const darkCSS = Object.entries(darkVars).map(([k, v]) => `${k}: ${v}`).join("; ")
  styleEl.textContent = `:root { ${lightCSS} } .dark { ${darkCSS} }`
}

// ── Font size applier ────────────────────────────────────────────────────

function applyFontSize(size: "small" | "medium" | "large") {
  const root = document.documentElement
  const sizeMap = { small: "14px", medium: "16px", large: "18px" }
  root.style.fontSize = sizeMap[size]
}

// ── Component ────────────────────────────────────────────────────────────

export function SettingsView() {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = React.useState<SettingsState>(DEFAULT_SETTINGS)
  const [clearDialogOpen, setClearDialogOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Form for app name validation
  const appNameForm = useForm<SettingsGeneralValues>({
    resolver: zodResolver(settingsGeneralSchema),
    defaultValues: {
      appName: settings.appName,
    },
    mode: "onChange",
  })

  // Sync form default when settings change externally (e.g. import/clear)
  React.useEffect(() => {
    appNameForm.reset({ appName: settings.appName })
  }, [settings.appName, appNameForm])

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  // ── General handlers ───────────────────────────────────────────────────

  const handleAppNameSave = (values: SettingsGeneralValues) => {
    updateSetting("appName", values.appName)
    toast.success("App name saved")
  }

  const handleDefaultViewChange = (value: string) => {
    updateSetting("defaultView", value)
    toast.success("Default view updated", { description: `Will open ${value} on launch` })
  }

  const handleDateFormatChange = (value: string) => {
    updateSetting("dateFormat", value)
    toast.success("Date format updated", { description: value })
  }

  const handleLanguageChange = (value: string) => {
    updateSetting("language", value)
    toast.success("Language updated", { description: "English" })
  }

  // ── Appearance handlers ────────────────────────────────────────────────

  const handleThemeChange = (value: string) => {
    setTheme(value)
    // Re-apply accent since the computed values differ for light/dark
    setTimeout(() => applyAccentPreset(settings.accentPreset), 50)
    toast.success("Theme updated", { description: value.charAt(0).toUpperCase() + value.slice(1) + " mode" })
  }

  const handleAccentChange = (presetName: string) => {
    updateSetting("accentPreset", presetName)
    applyAccentPreset(presetName)
    toast.success("Accent color updated", { description: presetName })
  }

  const handleSidebarWidthChange = (value: "compact" | "normal" | "wide") => {
    updateSetting("sidebarWidth", value)
    toast.success("Sidebar width updated", { description: value.charAt(0).toUpperCase() + value.slice(1) })
  }

  const handleFontSizeChange = (value: "small" | "medium" | "large") => {
    updateSetting("fontSize", value)
    applyFontSize(value)
    toast.success("Font size updated", { description: value.charAt(0).toUpperCase() + value.slice(1) })
  }

  // ── Notification handlers ──────────────────────────────────────────────

  const handleNotifToggle = (key: keyof SettingsState, label: string) => {
    const current = settings[key] as boolean
    updateSetting(key, !current)
    toast.success(label, { description: !current ? "Enabled" : "Disabled" })
  }

  // ── Data handlers ──────────────────────────────────────────────────────

  const handleExportJSON = () => {
    const data = { settings, exportedAt: new Date().toISOString(), version: "1.0" }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "flowboard-settings.json"
    a.click()
    URL.revokeObjectURL(url)
    toast.success("Settings exported", { description: "flowboard-settings.json downloaded" })
  }

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string)
        if (data.settings) {
          setSettings({ ...DEFAULT_SETTINGS, ...data.settings })
          // Apply imported appearance settings
          if (data.settings.accentPreset) applyAccentPreset(data.settings.accentPreset)
          if (data.settings.fontSize) applyFontSize(data.settings.fontSize)
          toast.success("Settings imported", { description: "All settings restored from file" })
        } else {
          toast.error("Invalid file", { description: "No settings data found in the file" })
        }
      } catch {
        toast.error("Import failed", { description: "Could not parse the JSON file" })
      }
    }
    reader.readAsText(file)
    // Reset the input so the same file can be re-imported
    e.target.value = ""
  }

  const handleClearData = () => {
    setSettings(DEFAULT_SETTINGS)
    applyAccentPreset(DEFAULT_SETTINGS.accentPreset)
    applyFontSize(DEFAULT_SETTINGS.fontSize)
    setTheme("system")
    setClearDialogOpen(false)
    toast.success("All data cleared", { description: "Settings restored to defaults" })
  }

  // ── Render helpers ─────────────────────────────────────────────────────

  const ThemeOption = ({ value, icon: Icon, label }: { value: string; icon: React.ComponentType<{ className?: string }>; label: string }) => (
    <button
      onClick={() => handleThemeChange(value)}
      className={cn(
        "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all hover:bg-muted/50",
        theme === value ? "border-primary bg-primary/5" : "border-transparent bg-muted/30"
      )}
    >
      <Icon className={cn("size-5", theme === value ? "text-primary" : "text-muted-foreground")} />
      <span className={cn("text-xs font-medium", theme === value ? "text-primary" : "text-muted-foreground")}>
        {label}
      </span>
    </button>
  )

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="size-5 text-primary" />
        <h2 className="text-xl font-semibold tracking-tight">Settings</h2>
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        {/* ═══ GENERAL ═══ */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <Card className="py-0">
            <CardHeader className="pt-5">
              <CardTitle className="text-base">Application</CardTitle>
              <CardDescription>Configure basic application settings and preferences.</CardDescription>
            </CardHeader>
            <CardContent className="pb-5 space-y-5">
              {/* App name */}
              <Form {...appNameForm}>
                <form onSubmit={appNameForm.handleSubmit(handleAppNameSave)}>
                  <FormField
                    control={appNameForm.control}
                    name="appName"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 max-w-xs">
                            <FormLabel>App Name</FormLabel>
                            <div className="flex items-center gap-3 mt-1">
                              <FormControl><Input {...field} placeholder="FlowBoard" /></FormControl>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {field.value.length}/30
                              </span>
                            </div>
                            <FormMessage />
                          </div>
                          <Button
                            type="submit"
                            size="sm"
                            className="mt-6"
                            disabled={!appNameForm.formState.isDirty || !appNameForm.formState.isValid}
                          >
                            Save
                          </Button>
                        </div>
                        <FormDescription>Displayed in the sidebar header and browser tab.</FormDescription>
                      </FormItem>
                    )}
                  />
                </form>
              </Form>

              <Separator />

              {/* Default view */}
              <div className="space-y-2">
                <Label>Default View</Label>
                <Select value={settings.defaultView} onValueChange={handleDefaultViewChange}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dashboard">Home</SelectItem>
                    <SelectItem value="projects">Projects (Kanban)</SelectItem>
                    <SelectItem value="timeline">Timeline</SelectItem>
                    <SelectItem value="my-tasks">My Tasks</SelectItem>
                    <SelectItem value="notes">Notes</SelectItem>
                    <SelectItem value="graph-view">Graph View</SelectItem>
                    <SelectItem value="activity-log">Activity Log</SelectItem>
                    <SelectItem value="team">Team</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">The view shown when you first open FlowBoard.</p>
              </div>

              <Separator />

              {/* Date format */}
              <div className="space-y-2">
                <Label>Date Format</Label>
                <Select value={settings.dateFormat} onValueChange={handleDateFormatChange}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MMM D, YYYY">MMM D, YYYY (May 15, 2026)</SelectItem>
                    <SelectItem value="D MMM YYYY">D MMM YYYY (15 May 2026)</SelectItem>
                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (05/15/2026)</SelectItem>
                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (15/05/2026)</SelectItem>
                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2026-05-15)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Language */}
              <div className="space-y-2">
                <Label>Language</Label>
                <Select value={settings.language} onValueChange={handleLanguageChange}>
                  <SelectTrigger className="max-w-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">More languages coming soon.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ APPEARANCE ═══ */}
        <TabsContent value="appearance" className="mt-6 space-y-6">
          {/* Theme */}
          <Card className="py-0">
            <CardHeader className="pt-5">
              <CardTitle className="text-base">Theme</CardTitle>
              <CardDescription>Select your preferred color scheme for the interface.</CardDescription>
            </CardHeader>
            <CardContent className="pb-5">
              <div className="flex gap-3">
                <ThemeOption value="light" icon={Sun} label="Light" />
                <ThemeOption value="dark" icon={Moon} label="Dark" />
                <ThemeOption value="system" icon={Monitor} label="System" />
              </div>
            </CardContent>
          </Card>

          {/* Accent Color */}
          <Card className="py-0">
            <CardHeader className="pt-5">
              <CardTitle className="text-base">Accent Color</CardTitle>
              <CardDescription>Choose the primary accent color used throughout FlowBoard.</CardDescription>
            </CardHeader>
            <CardContent className="pb-5">
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    onClick={() => handleAccentChange(preset.name)}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all hover:scale-105",
                      settings.accentPreset === preset.name
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/30"
                    )}
                  >
                    <div
                      className={cn(
                        "size-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition-all",
                        settings.accentPreset === preset.name ? "ring-primary" : "ring-transparent"
                      )}
                      style={{
                        backgroundColor: preset.preview,
                      }}
                    />
                    <span className={cn(
                      "text-xs font-medium",
                      settings.accentPreset === preset.name ? "text-primary" : "text-muted-foreground"
                    )}>
                      {preset.name}
                    </span>
                    {settings.accentPreset === preset.name && (
                      <Check className="size-3 text-primary" />
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Sidebar Width */}
          <Card className="py-0">
            <CardHeader className="pt-5">
              <CardTitle className="text-base">Sidebar Width</CardTitle>
              <CardDescription>Adjust the width of the sidebar navigation panel.</CardDescription>
            </CardHeader>
            <CardContent className="pb-5">
              <div className="flex gap-3">
                {(["compact", "normal", "wide"] as const).map((width) => (
                  <button
                    key={width}
                    onClick={() => handleSidebarWidthChange(width)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all hover:bg-muted/50",
                      settings.sidebarWidth === width
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/30"
                    )}
                  >
                    <div className={cn(
                      "h-6 rounded border-2 border-current",
                      width === "compact" ? "w-5" : width === "normal" ? "w-7" : "w-9",
                      settings.sidebarWidth === width ? "text-primary" : "text-muted-foreground"
                    )} />
                    <span className={cn(
                      "text-xs font-medium capitalize",
                      settings.sidebarWidth === width ? "text-primary" : "text-muted-foreground"
                    )}>
                      {width}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Font Size */}
          <Card className="py-0">
            <CardHeader className="pt-5">
              <CardTitle className="text-base">Font Size</CardTitle>
              <CardDescription>Change the base font size for the entire application.</CardDescription>
            </CardHeader>
            <CardContent className="pb-5">
              <div className="flex gap-3">
                {(["small", "medium", "large"] as const).map((size) => (
                  <button
                    key={size}
                    onClick={() => handleFontSizeChange(size)}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all hover:bg-muted/50",
                      settings.fontSize === size
                        ? "border-primary bg-primary/5"
                        : "border-transparent bg-muted/30"
                    )}
                  >
                    <span className={cn(
                      "font-medium capitalize",
                      size === "small" ? "text-xs" : size === "medium" ? "text-sm" : "text-base",
                      settings.fontSize === size ? "text-primary" : "text-muted-foreground"
                    )}>
                      Aa
                    </span>
                    <span className={cn(
                      "text-xs font-medium capitalize",
                      settings.fontSize === size ? "text-primary" : "text-muted-foreground"
                    )}>
                      {size}
                    </span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ NOTIFICATIONS ═══ */}
        <TabsContent value="notifications" className="mt-6 space-y-6">
          <Card className="py-0">
            <CardHeader className="pt-5">
              <CardTitle className="text-base">Notification Preferences</CardTitle>
              <CardDescription>Choose which events trigger in-app notifications.</CardDescription>
            </CardHeader>
            <CardContent className="pb-5 space-y-1">
              {[
                { key: "notifTaskAssigned" as const, label: "Task assigned to me", desc: "Get notified when a task is assigned to you." },
                { key: "notifTaskDueTomorrow" as const, label: "Task due tomorrow", desc: "Receive a reminder the day before a task is due." },
                { key: "notifCommentOnTask" as const, label: "Comment on my task", desc: "Get notified when someone comments on a task you are assigned to." },
                { key: "notifProjectStatusChanged" as const, label: "Project status changed", desc: "Receive updates when a project status changes." },
              ].map((item, idx) => (
                <React.Fragment key={item.key}>
                  {idx > 0 && <Separator />}
                  <div className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">{item.label}</Label>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={settings[item.key] as boolean}
                      onCheckedChange={() => handleNotifToggle(item.key, item.label)}
                    />
                  </div>
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ DATA ═══ */}
        <TabsContent value="data" className="mt-6 space-y-6">
          <Card className="py-0">
            <CardHeader className="pt-5">
              <CardTitle className="text-base">Export & Import</CardTitle>
              <CardDescription>Manage your FlowBoard settings data.</CardDescription>
            </CardHeader>
            <CardContent className="pb-5 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" className="gap-2" onClick={handleExportJSON}>
                  <Download className="size-4" />
                  Export as JSON
                </Button>
                <Button variant="outline" className="gap-2" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4" />
                  Import from JSON
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportJSON}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Export saves your current settings to a JSON file. Import restores settings from a previously exported file.
              </p>
            </CardContent>
          </Card>

          <Card className="py-0 border-red-200 dark:border-red-900/40">
            <CardHeader className="pt-5">
              <CardTitle className="text-base text-red-600 dark:text-red-400">Danger Zone</CardTitle>
              <CardDescription>Irreversible actions that reset your FlowBoard data.</CardDescription>
            </CardHeader>
            <CardContent className="pb-5">
              <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="gap-2">
                    <Trash2 className="size-4" />
                    Clear All Data
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Are you sure?</DialogTitle>
                    <DialogDescription>
                      This will reset all settings to their default values, including theme,
                      accent color, notification preferences, and custom configurations. This
                      action cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setClearDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleClearData}>
                      Yes, clear everything
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <p className="text-xs text-muted-foreground mt-2">
                Resets all settings to defaults. Mock task and project data will remain unchanged.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
