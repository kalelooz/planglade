import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home, Inbox, ListTodo, FolderKanban, Calendar, FileText, BarChart3,
  Network, Activity, Users, Settings, Search, Bell, Plus, PanelLeft, Command,
} from "lucide-react";
import { projects } from "@/lib/mock-data";
import { CommandPalette } from "./command-palette";
import { Avatar } from "./icons";

const railTop = [
  { to: "/", label: "Home", icon: Home },
  { to: "/inbox", label: "Inbox", icon: Inbox },
  { to: "/my-tasks", label: "My Tasks", icon: ListTodo },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/notes", label: "Notes", icon: FileText },
];

const navMain = [
  { to: "/", label: "Home", icon: Home },
  { to: "/inbox", label: "Inbox", icon: Inbox, count: 5 },
  { to: "/my-tasks", label: "My Tasks", icon: ListTodo, count: 8 },
];

const navWorkspace = [
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/timeline", label: "Timeline", icon: BarChart3 },
  { to: "/graph", label: "Graph", icon: Network },
  { to: "/activity", label: "Activity", icon: Activity },
  { to: "/team", label: "Team", icon: Users },
];

export function AppShell({ children, title, tabs, toolbar }: {
  children: ReactNode;
  title?: ReactNode;
  tabs?: { label: string; to: string; active?: boolean }[];
  toolbar?: ReactNode;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [cmdOpen, setCmdOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isActive = (to: string) => to === "/" ? path === "/" : path.startsWith(to);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Icon rail */}
      <aside className="hidden w-12 shrink-0 flex-col items-center border-r bg-sidebar py-3 md:flex">
        <Link to="/" className="mb-4 flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold tracking-tight text-background">FB</Link>
        <div className="flex flex-col gap-1">
          {railTop.map((r) => {
            const Icon = r.icon;
            const active = isActive(r.to);
            return (
              <Link key={r.to} to={r.to} title={r.label}
                className={`flex h-8 w-8 items-center justify-center rounded ${active ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-hover hover:text-foreground"}`}>
                <Icon className="h-4 w-4" />
              </Link>
            );
          })}
        </div>
        <div className="mt-auto flex flex-col gap-1">
          <Link to="/settings" title="Settings" className={`flex h-8 w-8 items-center justify-center rounded ${isActive("/settings") ? "bg-foreground/5" : "text-muted-foreground hover:bg-hover hover:text-foreground"}`}>
            <Settings className="h-4 w-4" />
          </Link>
          <Avatar id="AM" name="Alex Morgan" size={28} />
        </div>
      </aside>

      {/* Sidebar */}
      {sidebarOpen && (
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
          <div className="flex h-12 items-center justify-between border-b px-3">
            <button className="flex items-center gap-2 text-sm font-medium">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-foreground text-[10px] font-bold text-background">A</span>
              Acme Inc.
            </button>
            <button onClick={() => setSidebarOpen(false)} className="rounded p-1 text-muted-foreground hover:bg-hover">
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3">
            <SidebarSection items={navMain} isActive={isActive} />

            <SidebarLabel>Projects</SidebarLabel>
            <div className="space-y-px">
              {projects.map((p) => (
                <Link key={p.id} to="/projects" search={{ id: p.id }}
                  className={`group flex items-center gap-2 rounded px-2 py-1 text-[13px] ${path === "/projects" ? "text-foreground" : "text-muted-foreground hover:bg-hover hover:text-foreground"}`}>
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.accent }} />
                  <span className="truncate">{p.name}</span>
                </Link>
              ))}
            </div>

            <SidebarLabel>Workspace</SidebarLabel>
            <SidebarSection items={navWorkspace} isActive={isActive} />

            <SidebarLabel>Reports</SidebarLabel>
            <SidebarSection items={[{ to: "/report", label: "Project Report", icon: BarChart3 }]} isActive={isActive} />
          </nav>
          <div className="border-t p-3">
            <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Sprint 24 capacity</span><span>62%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: "62%" }} />
            </div>
          </div>
        </aside>
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="rounded p-1 text-muted-foreground hover:bg-hover">
              <PanelLeft className="h-4 w-4" />
            </button>
          )}
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            {title ?? <span className="font-medium">FlowBoard</span>}
          </div>
          <div className="flex-1" />
          <button onClick={() => setCmdOpen(true)}
            className="hidden h-7 items-center gap-2 rounded border bg-sidebar px-2 text-xs text-muted-foreground hover:text-foreground sm:flex">
            <Search className="h-3 w-3" />
            <span>Search or jump…</span>
            <kbd className="ml-6 rounded border bg-background px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
          <button onClick={() => setCmdOpen(true)} className="rounded p-1.5 text-muted-foreground hover:bg-hover sm:hidden">
            <Command className="h-4 w-4" />
          </button>
          <button className="rounded p-1.5 text-muted-foreground hover:bg-hover"><Bell className="h-4 w-4" /></button>
          <button className="hidden h-7 items-center gap-1 rounded bg-primary px-2 text-xs font-medium text-primary-foreground hover:opacity-90 sm:flex">
            <Plus className="h-3 w-3" /> New
          </button>
          <Avatar id="AM" name="Alex Morgan" size={26} />
        </header>

        {tabs && (
          <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-background px-4">
            {tabs.map((t) => (
              <Link key={t.to} to={t.to}
                className={`relative flex h-full items-center px-2.5 text-[13px] ${t.active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t.label}
                {t.active && <span className="absolute inset-x-2.5 -bottom-px h-px bg-foreground" />}
              </Link>
            ))}
          </div>
        )}

        {toolbar}

        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}

function SidebarLabel({ children }: { children: ReactNode }) {
  return <div className="mt-5 mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

function SidebarSection({ items, isActive }: { items: { to: string; label: string; icon: any; count?: number }[]; isActive: (to: string) => boolean }) {
  return (
    <div className="space-y-px">
      {items.map((n) => {
        const Icon = n.icon;
        const active = isActive(n.to);
        return (
          <Link key={n.to} to={n.to}
            className={`flex items-center gap-2 rounded px-2 py-1 text-[13px] ${active ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-hover hover:text-foreground"}`}>
            <Icon className="h-3.5 w-3.5" />
            <span className="flex-1">{n.label}</span>
            {n.count != null && <span className="text-[11px] text-muted-foreground">{n.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
