"use client";
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home, Inbox, ListTodo, FolderKanban, Calendar, FileText, BarChart3,
  Network, Activity, Users, Settings, Search, Plus, PanelLeft, Command, X,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { CommandPalette } from "./command-palette";
import { Avatar } from "./icons";

const STORAGE_KEY = "fb.sidebarOpen";

export function AppShell({ children, title, tabs, toolbar }: {
  children: ReactNode;
  title?: ReactNode;
  tabs?: { label: string; to: string; active?: boolean }[];
  toolbar?: ReactNode;
}) {
  const path = usePathname() ?? "/";
  const projects = useStore((s) => s.projects);
  const workspaceName = useStore((s) => s.settings.workspaceName);
  const inboxCount = useStore((s) => s.inboxItems.length);
  const myOpenCount = useStore((s) => s.workItems.filter((w) => w.assignee === "AM" && w.status !== "Done").length);
  const addInboxItem = useStore((s) => s.addInboxItem);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickValue, setQuickValue] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  });
  const [hydrated, setHydrated] = useState(false);
  const [logoHover, setLogoHover] = useState(false);

  const navMain = [
    { to: "/", label: "Home", icon: Home },
    { to: "/inbox", label: "Inbox", icon: Inbox, count: inboxCount },
    { to: "/my-tasks", label: "My Tasks", icon: ListTodo, count: myOpenCount },
    { to: "/projects", label: "Projects", icon: FolderKanban },
    { to: "/notes", label: "Notes", icon: FileText },
    { to: "/calendar", label: "Calendar", icon: Calendar },
  ];

  const navAdvanced = [
    { to: "/timeline", label: "Timeline", icon: BarChart3 },
    { to: "/graph", label: "Graph", icon: Network },
    { to: "/activity", label: "Activity", icon: Activity },
    { to: "/team", label: "Team", icon: Users },
    { to: "/report", label: "Project Report", icon: BarChart3 },
  ];

  const submitQuick = () => {
    const v = quickValue.trim();
    if (v) {
      addInboxItem(v);
      toast.success("Captured to Inbox", { description: v });
    }
    setQuickValue("");
    setQuickOpen(false);
  };

  useEffect(() => {
    // Enable width transitions only after the first client paint,
    // so the SSR-client width correction doesn't animate.
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, sidebarOpen ? "1" : "0");
    }
  }, [sidebarOpen]);

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
      <aside
        suppressHydrationWarning
        data-collapsed={!sidebarOpen}
        className={`hidden shrink-0 flex-col border-r bg-sidebar md:flex ${hydrated ? "transition-[width] duration-200 ease-out" : ""} ${sidebarOpen ? "w-60" : "w-12"}`}
      >
        <div className={`flex h-12 shrink-0 items-center border-b ${sidebarOpen ? "justify-between px-3" : "justify-center px-0"}`}>
          {sidebarOpen ? (
            <>
              <Link href="/" title="FlowBoard home" className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold tracking-tight text-background">FB</span>
                <span className="truncate">{workspaceName}</span>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                title="Collapse sidebar"
                className="rounded p-1 text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"
              >
                <PanelLeft className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <div
              onMouseEnter={() => setLogoHover(true)}
              onMouseLeave={() => setLogoHover(false)}
              className="flex h-7 w-7 items-center justify-center"
            >
              {logoHover ? (
                <button
                  onClick={() => { setSidebarOpen(true); setLogoHover(false); }}
                  title="Expand sidebar"
                  className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"
                >
                  <PanelLeft className="h-4 w-4 rotate-180" />
                </button>
              ) : (
                <Link
                  href="/"
                  title="FlowBoard home"
                  className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold tracking-tight text-background"
                >
                  FB
                </Link>
              )}
            </div>
          )}
        </div>

        <nav className={`flex-1 overflow-y-auto overflow-x-hidden py-3 ${sidebarOpen ? "px-2" : "px-1"}`}>
          <SidebarSection items={navMain} isActive={isActive} collapsed={!sidebarOpen} />

          {sidebarOpen && (
            <>
              <SidebarLabel>Projects</SidebarLabel>
              <div className="space-y-px">
                {projects.map((p) => (
                  <Link key={p.id} href={`/work-items?project=${p.id}`}
                    className={`group flex items-center gap-2 rounded px-2 py-1 text-[13px] ${path.startsWith("/work-items") ? "text-foreground" : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.accent }} />
                    <span className="truncate">{p.name}</span>
                  </Link>
                ))}
              </div>

              <SidebarLabel>Advanced</SidebarLabel>
            </>
          )}
          <SidebarSection items={navAdvanced} isActive={isActive} collapsed={!sidebarOpen} />
        </nav>

        <div className={`border-t ${sidebarOpen ? "p-3" : "flex justify-center py-2"}`}>
          {sidebarOpen ? (
            <Link href="/settings" className={`flex items-center gap-2 rounded px-2 py-1 text-[13px] ${isActive("/settings") ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"}`}>
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </Link>
          ) : (
            <Link href="/settings" title="Settings" className={`flex h-8 w-8 items-center justify-center rounded ${isActive("/settings") ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"}`}>
              <Settings className="h-4 w-4" />
            </Link>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
          <button onClick={() => setMobileNavOpen(true)} className="rounded p-1.5 text-muted-foreground hover:bg-[var(--color-hover)] md:hidden" aria-label="Open navigation">
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            {title ?? <span className="font-medium">FlowBoard</span>}
          </div>
          <div className="flex-1" />
          <button onClick={() => setCmdOpen(true)}
            className="hidden h-7 items-center gap-2 rounded border bg-sidebar px-2 text-xs text-muted-foreground hover:text-foreground sm:flex">
            <Search className="h-3 w-3" />
            <span>Search or jump...</span>
            <kbd className="ml-6 rounded border bg-background px-1 font-mono text-[10px]">Ctrl K</kbd>
          </button>
          <button onClick={() => setCmdOpen(true)} className="rounded p-1.5 text-muted-foreground hover:bg-[var(--color-hover)] sm:hidden">
            <Command className="h-4 w-4" />
          </button>
          <div className="relative">
            <button onClick={() => setQuickOpen((v) => !v)} className="hidden h-7 items-center gap-1 rounded bg-primary px-2 text-xs font-medium text-primary-foreground hover:opacity-90 sm:flex">
              <Plus className="h-3 w-3" /> Quick capture
            </button>
            {quickOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setQuickOpen(false)} />
                <div className="absolute right-0 top-9 z-20 w-72 rounded-md border bg-popover p-2 shadow-lg">
                  <input
                    autoFocus
                    value={quickValue}
                    onChange={(e) => setQuickValue(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") submitQuick(); if (e.key === "Escape") setQuickOpen(false); }}
                    placeholder="Capture a task, note, or idea..."
                    className="h-8 w-full rounded border bg-card px-2 text-[13px] outline-none focus:border-ring"
                  />
                  <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                    <span>Saves to <Link href="/inbox" className="underline decoration-dotted underline-offset-2 hover:text-foreground" onClick={() => setQuickOpen(false)}>Inbox</Link> for triage</span>
                    <kbd className="rounded border bg-muted px-1 font-mono">Enter</kbd>
                  </div>
                </div>
              </>
            )}
          </div>
          <Avatar id="AM" name="Alex Morgan" size={26} />
        </header>

        {tabs && (
          <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-background px-4">
            {tabs.map((t) => (
              <Link key={t.to} href={t.to}
                className={`relative flex h-full items-center px-2.5 text-[13px] ${t.active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                {t.label}
                {t.active && <span className="absolute inset-x-2.5 -bottom-px h-px bg-foreground" />}
              </Link>
            ))}
          </div>
        )}

        {toolbar}

        <main className="min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">{children}</main>
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[86vw] flex-col border-r bg-sidebar shadow-xl">
            <div className="flex h-12 items-center justify-between border-b px-3">
              <Link href="/" onClick={() => setMobileNavOpen(false)} className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold tracking-tight text-background">FB</span>
                <span className="truncate">{workspaceName}</span>
              </Link>
              <button onClick={() => setMobileNavOpen(false)} className="rounded p-1.5 text-muted-foreground hover:bg-[var(--color-hover)]" aria-label="Close navigation">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <SidebarSection items={navMain} isActive={isActive} collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
              <SidebarLabel>Projects</SidebarLabel>
              <div className="space-y-px">
                {projects.map((p) => (
                  <Link key={p.id} href={`/work-items?project=${p.id}`} onClick={() => setMobileNavOpen(false)}
                    className={`group flex items-center gap-2 rounded px-2 py-1 text-[13px] ${path.startsWith("/work-items") ? "text-foreground" : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: p.accent }} />
                    <span className="truncate">{p.name}</span>
                  </Link>
                ))}
              </div>
              <SidebarLabel>Advanced</SidebarLabel>
              <SidebarSection items={navAdvanced} isActive={isActive} collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
            </nav>
            <div className="border-t p-3">
              <Link href="/settings" onClick={() => setMobileNavOpen(false)} className={`flex items-center gap-2 rounded px-2 py-1 text-[13px] ${isActive("/settings") ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"}`}>
                <Settings className="h-3.5 w-3.5" />
                <span>Settings</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}

function SidebarLabel({ children }: { children: ReactNode }) {
  return <div className="mt-5 mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; count?: number };
function SidebarSection({ items, isActive, collapsed, onNavigate }: { items: NavItem[]; isActive: (to: string) => boolean; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <div className="space-y-px">
      {items.map((n) => {
        const Icon = n.icon;
        const active = isActive(n.to);
        if (collapsed) {
          return (
            <Link key={n.to} href={n.to} title={n.label} onClick={onNavigate}
              className={`flex h-8 w-full items-center justify-center rounded ${active ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"}`}>
              <Icon className="h-4 w-4" />
            </Link>
          );
        }
        return (
          <Link key={n.to} href={n.to} onClick={onNavigate}
            className={`flex items-center gap-2 rounded px-2 py-1 text-[13px] ${active ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-[var(--color-hover)] hover:text-foreground"}`}>
            <Icon className="h-3.5 w-3.5" />
            <span className="flex-1">{n.label}</span>
            {n.count != null && <span className="text-[11px] text-muted-foreground">{n.count}</span>}
          </Link>
        );
      })}
    </div>
  );
}
