"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, FolderKanban, GitBranch, Link2, Network } from "lucide-react"

import { AppShell } from "@/components/lovable/shell"
import { apiFetch, getServerSession } from "@/lib/server-session-client"
import {
  buildConnectionsModel,
  type ConnectionProject,
  type ConnectionRelation,
  type ConnectionWorkItem,
} from "@/lib/connections"

type LoadState = "loading" | "ready" | "error" | "unauthorized"

export function ConnectionsPageContent({ basePath = "/app" }: { basePath?: "/app" | "/demo" }) {
  const [state, setState] = useState<LoadState>("loading")
  const [projects, setProjects] = useState<ConnectionProject[]>([])
  const [workItems, setWorkItems] = useState<ConnectionWorkItem[]>([])
  const [relations, setRelations] = useState<ConnectionRelation[]>([])

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const session = await getServerSession()
        const query = `workspaceId=${encodeURIComponent(session.workspace.id)}`
        const responses = await Promise.all([
          apiFetch(`/api/projects?${query}`, { cache: "no-store" }),
          apiFetch(`/api/work-items?${query}`, { cache: "no-store" }),
          apiFetch(`/api/work-item-relations?${query}`, { cache: "no-store" }),
        ])
        if (!active) return
        if (responses.some((response) => response.status === 401 || response.status === 403)) {
          setState("unauthorized")
          return
        }
        if (responses.some((response) => !response.ok)) throw new Error("Connections request failed")
        const [projectPayload, workItemPayload, relationPayload] = await Promise.all(responses.map((response) => response.json()))
        setProjects(projectPayload.projects)
        setWorkItems(workItemPayload.workItems)
        setRelations(relationPayload.relations)
        setState("ready")
      } catch {
        if (active) setState("error")
      }
    })()
    return () => { active = false }
  }, [])

  const model = buildConnectionsModel({ projects, workItems, relations })

  return (
    <AppShell title={<span className="font-medium">Connections</span>}>
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 overflow-x-hidden px-4 py-6 sm:px-6" aria-live="polite">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Workspace relationships</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Connections</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">See dependencies and parent work without duplicating the tasks that define them.</p>
        </header>

        {state === "loading" && <StateMessage icon={Network} title="Loading connections" body="Gathering workspace relationships." />}
        {state === "error" && <StateMessage icon={AlertTriangle} title="Unable to load connections" body="Try refreshing the page. Your workspace data was not changed." />}
        {state === "unauthorized" && <StateMessage icon={AlertTriangle} title="You do not have access to these connections" body="Ask a workspace administrator to confirm your membership." />}

        {state === "ready" && model.connections.length === 0 && (
          <StateMessage icon={GitBranch} title="No connections yet" body="Add a dependency or a child task from a task's details. Connections will appear here automatically." />
        )}

        {state === "ready" && model.connections.length > 0 && (
          <>
            <section className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card md:grid-cols-5" aria-label="Relationship summary">
              <Summary label="Connections" value={model.summary.total} />
              <Summary label="Blocking" value={model.summary.blocking} />
              <Summary label="Related" value={model.summary.related} />
              <Summary label="Parent / child" value={model.summary.hierarchy} />
              <Summary label="Projects" value={model.summary.projects} />
            </section>

            <section className="overflow-hidden rounded-lg border bg-card" aria-labelledby="connection-list-title">
              <div className="border-b px-4 py-3">
                <h2 id="connection-list-title" className="text-sm font-semibold">Relationship list</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Text labels are the authoritative description of each relationship.</p>
              </div>
              <div className="divide-y">
                {model.connections.map((connection) => (
                  <article key={connection.id} className="grid min-w-0 gap-2 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                    <ConnectionSide basePath={basePath} item={connection.source} project={connection.sourceProject} />
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground md:justify-center">
                      {connection.kind === "blocking" ? <AlertTriangle className="h-3.5 w-3.5" /> : connection.kind === "hierarchy" ? <GitBranch className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
                      {connection.label}
                      <ArrowRight className="h-3 w-3" aria-hidden="true" />
                    </span>
                    <ConnectionSide basePath={basePath} item={connection.target} project={connection.targetProject} />
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </AppShell>
  )
}

function ConnectionSide({ basePath, item, project }: { basePath: "/app" | "/demo"; item: ConnectionWorkItem; project: ConnectionProject | null }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <Link
        href={`${basePath}/tasks?task=${encodeURIComponent(item.id)}`}
        className="min-w-0 truncate rounded-sm text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {item.title}
      </Link>
      {project ? (
        <Link
          href={`${basePath}/projects/${encodeURIComponent(project.id)}`}
          className="inline-flex min-w-0 items-center gap-1 self-start rounded-sm text-[11px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FolderKanban className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{project.name}</span>
        </Link>
      ) : (
        <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground/70">
          <FolderKanban className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="truncate">No project</span>
        </span>
      )}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="border-b border-r p-3 last:border-r-0 md:border-b-0"><div className="text-lg font-semibold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>
}

function StateMessage({ icon: Icon, title, body }: { icon: typeof Network; title: string; body: string }) {
  return <section className="rounded-lg border border-dashed bg-card px-6 py-12 text-center"><Icon className="mx-auto h-6 w-6 text-muted-foreground" /><h2 className="mt-3 text-sm font-semibold">{title}</h2><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{body}</p></section>
}

export default function ConnectionsPage() {
  return <ConnectionsPageContent />
}
