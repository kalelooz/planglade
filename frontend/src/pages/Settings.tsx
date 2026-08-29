import { useEffect, useId, useState } from 'react'
import { Download, RotateCcw, LogOut, CircleUserRound, Upload } from 'lucide-react'
import { useWorkspace } from '@/store/workspace'
import { PageContainer, SectionHeader } from '@/components/bits'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import type { ThemeMode, PriorityDisplay } from '@/types'
import { seedWorkspace } from '@/data/seed'
import { getWorkspaceExport } from '@/lib/api/workspace'
import { importWorkspace, parseWorkspaceImport, previewWorkspaceImport, type WorkspaceImportSnapshot } from '@/lib/api/imports'
import { TeamSettings } from '@/components/TeamSettings'

function ChoiceRow<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string
  hint?: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  const groupName = useId()

  return (
    <div className="flex items-center justify-between gap-4 py-3 flex-wrap">
      <div>
        <p className="pg-item-title">{label}</p>
        {hint && <p className="pg-meta mt-0.5 text-pretty">{hint}</p>}
      </div>
      <fieldset className="inline-flex rounded-md border border-border bg-card p-0.5">
        <legend className="sr-only">{label}</legend>
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer rounded">
            <input
              type="radio"
              name={groupName}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              className={
                value === o.value
                  ? 'inline-flex h-11 items-center lg:h-7 rounded bg-accent px-2.5 text-[12.5px] font-medium text-foreground transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2'
                  : 'inline-flex h-11 items-center lg:h-7 rounded px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:text-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2'
              }
            >
              {o.label}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  )
}

export default function Settings() {
  const ws = useWorkspace()
  const [name, setName] = useState(ws.state.workspaceName)
  const [exportOpen, setExportOpen] = useState(false)
  const [exportPreview, setExportPreview] = useState('')
  const [exportPending, setExportPending] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPending, setResetPending] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importPending, setImportPending] = useState(false)
  const [importSnapshot, setImportSnapshot] = useState<WorkspaceImportSnapshot | null>(null)
  const [importPreview, setImportPreview] = useState<Awaited<ReturnType<typeof previewWorkspaceImport>> | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const settings = ws.state.settings
  const serverBacked = ws.mode.kind === 'server'

  useEffect(() => {
    setName(ws.state.workspaceName)
  }, [ws.state.workspaceName])

  const loadExport = async () => {
    if (!serverBacked) return ws.exportJson()
    if (!ws.workspaceId) throw new Error('Missing workspace scope')
    return JSON.stringify(await getWorkspaceExport(ws.workspaceId), null, 2)
  }

  const download = async () => {
    setExportPending(true)
    try {
      const blob = new Blob([await loadExport()], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'planglade-workspace.json'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch {
      toast.error('Export could not be downloaded. Please try again.')
    } finally {
      setExportPending(false)
    }
  }

  const previewExport = async () => {
    setExportPending(true)
    try {
      setExportPreview(await loadExport())
      setExportOpen(true)
    } catch {
      toast.error('Export preview could not be loaded. Please try again.')
    } finally {
      setExportPending(false)
    }
  }

  const selectImport = async (file: File | undefined) => {
    if (!file || !ws.workspaceId || !ws.canManageWorkspace) return
    setImportPending(true)
    setImportError(null)
    try {
      const snapshot = parseWorkspaceImport(JSON.parse(await file.text()))
      const preview = await previewWorkspaceImport(ws.workspaceId, snapshot)
      setImportSnapshot(snapshot)
      setImportPreview(preview)
      setImportOpen(true)
    } catch {
      const message = 'That file is not a valid PlanGlade workspace export.'
      setImportError(message)
      toast.error(message)
    } finally {
      setImportPending(false)
    }
  }

  const confirmImport = async () => {
    if (!ws.workspaceId || !importSnapshot) return
    setImportPending(true)
    setImportError(null)
    try {
      const result = await importWorkspace(ws.workspaceId, importSnapshot)
      const total = result.imported.projects + result.imported.workItems + result.imported.notes + result.imported.projectDocs + result.imported.savedViews
      toast.success(`Import complete: ${total} records added`)
      setImportOpen(false)
      window.location.reload()
    } catch {
      const message = 'The workspace was not imported. No partial import was kept.'
      setImportError(message)
      toast.error(message)
    } finally {
      setImportPending(false)
    }
  }

  return (
    <PageContainer width="reading" className="py-6 sm:py-8">
      <header className="mb-6">
        <h1 className="pg-page-title">Settings</h1>
        <p className="pg-page-kicker">
          {serverBacked ? 'Authenticated workspace preferences and your permitted export.' : 'Everything stays in this browser. No account, no cloud.'}
        </p>
      </header>

      {/* Workspace */}
      <section aria-labelledby="s-workspace" className="mb-8">
        <SectionHeader id="s-workspace" title="Workspace" />
        <div className="border-y border-border/60 divide-y divide-border/60">
          <div className="flex items-center justify-between gap-4 py-3 flex-wrap">
            <div>
              <p className="pg-item-title">Workspace name</p>
              <p className="pg-meta mt-0.5 text-pretty">Shown in the sidebar and on Home.</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label="Workspace name"
                disabled={serverBacked && !ws.canManageWorkspace}
                className="h-11 w-[180px] rounded-md lg:h-8 border border-input bg-card px-2.5 text-[13px] outline-none focus:ring-1 focus:ring-ring disabled:opacity-60"
              />
              <button
                onClick={() => name.trim() && void ws.setWorkspaceName(name.trim())}
                disabled={!name.trim() || name.trim() === ws.state.workspaceName || (serverBacked && !ws.canManageWorkspace)}
                className="h-11 px-3 rounded-md lg:h-8 text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </section>

      {serverBacked && ws.workspaceId && (
        <section aria-labelledby="s-team" className="mb-8">
          <SectionHeader id="s-team" title="Team" />
          <TeamSettings workspaceId={ws.workspaceId} canManage={ws.canManageWorkspace} />
        </section>
      )}

      {/* Appearance */}
      <section aria-labelledby="s-appearance" className="mb-8">
        <SectionHeader id="s-appearance" title="Appearance" />
        <div className="border-y border-border/60 divide-y divide-border/60">
          <ChoiceRow<ThemeMode>
            label="Theme"
            hint="System follows your device setting."
            value={settings.theme}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
            onChange={(v) => ws.updateSettings({ theme: v })}
          />
          <ChoiceRow<PriorityDisplay>
            label="Priority display"
            hint="Flags are compact; text is explicit."
            value={settings.priorityDisplay}
            options={[
              { value: 'icon', label: 'Flags' },
              { value: 'text', label: 'Text' },
            ]}
            onChange={(v) => ws.updateSettings({ priorityDisplay: v })}
          />
        </div>
      </section>

      {/* Dates */}
      <section aria-labelledby="s-dates" className="mb-8">
        <SectionHeader id="s-dates" title="Dates" />
        <div className="border-y border-border/60 divide-y divide-border/60">
          <ChoiceRow<'1' | '0'>
            label="Week starts on"
            value={String(settings.weekStartsOn) as '1' | '0'}
            options={[
              { value: '1', label: 'Monday' },
              { value: '0', label: 'Sunday' },
            ]}
            onChange={(v) => ws.updateSettings({ weekStartsOn: Number(v) as 0 | 1 })}
          />
        </div>
      </section>

      {/* Data */}
      <section aria-labelledby="s-data" className="mb-8">
        <SectionHeader id="s-data" title="Your data" />
        <div className="border-y border-border/60 divide-y divide-border/60">
          <div className="flex items-center justify-between gap-4 py-3 flex-wrap">
            <div>
              <p className="pg-item-title">Export workspace</p>
              <p className="pg-meta mt-0.5 text-pretty">
                {serverBacked ? 'A JSON export of the workspace data your account is permitted to export.' : 'A plain JSON file of the workspace data currently loaded here.'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void previewExport()} disabled={exportPending} className="h-11 px-3 rounded-md lg:h-8 border border-input text-[13px] hover:bg-accent transition-colors disabled:opacity-40">
                {exportPending ? 'Loading...' : 'Preview'}
              </button>
              <button onClick={() => void download()} disabled={exportPending} className="h-11 px-3 rounded-md lg:h-8 text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40">
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </div>
          </div>
          {serverBacked && <div className="flex items-center justify-between gap-4 py-3 flex-wrap">
            <div>
              <p className="pg-item-title">Import workspace</p>
              <p className="pg-meta mt-0.5 text-pretty">
                {ws.canManageWorkspace ? 'Preview a PlanGlade JSON export before adding its records to this workspace.' : 'Only workspace admins can import records.'}
              </p>
              {importError && <p role="alert" className="mt-1 max-w-md text-pretty text-[12px] text-destructive">{importError}</p>}
            </div>
            <label className="h-11 px-3 rounded-md lg:h-8 border border-input text-[13px] hover:bg-accent transition-colors inline-flex items-center gap-1.5 cursor-pointer has-[:disabled]:opacity-40 has-[:disabled]:cursor-not-allowed">
              <Upload className="h-3.5 w-3.5" /> {importPending ? 'Checking…' : 'Choose file'}
              <input
                type="file"
                accept="application/json,.json"
                className="sr-only"
                disabled={importPending || !ws.canManageWorkspace}
                onChange={(event) => { void selectImport(event.target.files?.[0]); event.currentTarget.value = '' }}
              />
            </label>
          </div>}
          {!serverBacked && <div className="flex items-center justify-between gap-4 py-3 flex-wrap">
            <div>
              <p className="pg-item-title">Reset to sample data</p>
              <p className="pg-meta mt-0.5 text-pretty">Clears your changes and restores the original sample workspace.</p>
            </div>
            <button
              onClick={() => setResetOpen(true)}
              className="h-11 px-3 rounded-md lg:h-8 text-[13px] text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          </div>}
        </div>
      </section>

      {/* Account */}
      <section aria-labelledby="s-account" className="mb-8">
        <SectionHeader id="s-account" title="Account" />
        <div className="border-y border-border/60 divide-y divide-border/60">
          <div className="flex items-center justify-between gap-4 py-3 flex-wrap">
            <div className="flex items-center gap-3">
              <CircleUserRound className="h-8 w-8 text-muted-foreground" aria-hidden />
              <div>
                <p className="pg-item-title">{ws.state.userName}</p>
                <p className="pg-meta mt-0.5 text-pretty">
                  {serverBacked ? 'Authenticated PlanGlade session.' : 'Local prototype identity - no sign-in required.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => ws.signOut()}
              className="h-11 px-3 rounded-md lg:h-8 border border-input text-[13px] hover:bg-accent transition-colors inline-flex items-center gap-1.5"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
        {!serverBacked && <p className="pg-meta mt-6 text-pretty leading-relaxed">
          PlanGlade · A calm clearing for your projects. This prototype stores data only in your browser&apos;s local storage.
        </p>}
      </section>

      {/* Export preview dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="sm:max-w-[560px] max-h-[80dvh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">Export preview</DialogTitle>
            <DialogDescription>{serverBacked ? 'The server-generated workspace export for your permitted data.' : 'Your whole workspace as JSON. Nothing leaves this browser unless you download it.'}</DialogDescription>
          </DialogHeader>
          <pre className="min-h-[200px] flex-1 overflow-y-auto overflow-x-hidden whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-[12.5px] leading-relaxed">
            {exportPreview.slice(0, 4000)}
            {exportPreview.length > 4000 && '\n…'}
          </pre>
          <div className="flex justify-end gap-2">
            <button onClick={() => setExportOpen(false)} className="h-11 px-3 rounded-md lg:h-8 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
              Close
            </button>
            <button onClick={() => void download()} disabled={exportPending} className="h-11 px-3 rounded-md lg:h-8 text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5 disabled:opacity-40">
              <Download className="h-3.5 w-3.5" /> Download
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={importOpen} onOpenChange={setImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import these records?</AlertDialogTitle>
            <AlertDialogDescription>
              The preview made no changes. Confirming will append {importPreview ? importPreview.counts.projects + importPreview.counts.tasks + importPreview.counts.notes + importPreview.counts.projectDocs + importPreview.counts.savedViews : 0} records to this workspace; possible duplicates will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {importPreview && <div className="max-h-48 overflow-y-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
            <p>{importPreview.counts.projects} projects · {importPreview.counts.tasks} tasks · {importPreview.counts.notes} notes · {importPreview.counts.projectDocs} Project Docs · {importPreview.counts.savedViews} saved views</p>
            {importPreview.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-4">
              {importPreview.warnings.map((warning) => <li key={warning.code}>{warning.message}{warning.count ? ` (${warning.count})` : ''}</li>)}
            </ul>}
          </div>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmImport()} disabled={importPending}>
              {importPending ? 'Importing…' : 'Import records'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset confirm */}
      <AlertDialog open={resetOpen} onOpenChange={(open) => {
        if (!resetPending) setResetOpen(open)
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset the workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              All your changes will be replaced by the original sample data. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetPending}>Keep my data</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={resetPending}
              onClick={async (event) => {
                event.preventDefault()
                if (resetPending) return
                setResetPending(true)
                const saved = await ws.resetWorkspace()
                setResetPending(false)
                if (saved) {
                  setName(seedWorkspace().workspaceName)
                  setResetOpen(false)
                }
              }}
            >
              {resetPending ? 'Resetting…' : 'Reset everything'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
