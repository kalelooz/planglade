"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home, Inbox, FolderKanban, Calendar, FileText, BarChart3, CheckSquare,
  Network, Activity, Users, Settings, Search, Plus, PanelLeft, Command, X, ChevronRight, ChevronDown, LayoutGrid, ListTodo,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { CommandPalette } from "./command-palette";
import { Avatar } from "./icons";
import { ProjectIcon } from "./project-icon";

const STORAGE_KEY = "fb.sidebarOpen";
const PROJECTS_STORAGE_KEY = "fb.sidebarProjectsOpen";

export function AppShell({ children, title, tabs, toolbar }: {
  children: ReactNode;
  title?: ReactNode;
  tabs?: { label: string; to: string; active?: boolean }[];
  toolbar?: ReactNode;
}) {
  const path = usePathname() ?? "/";
  const searchParams = useSearchParams();
  const routeProjectId = searchParams?.get("project") ?? null;
  const projects = useStore((s) => s.projects);
  const workspaceName = useStore((s) => s.settings.workspaceName);
  const activeProjectSetting = useStore((s) => s.settings.activeProjectId);
  const updateSettings = useStore((s) => s.updateSettings);
  const inboxCount = useStore((s) => s.inboxItems.length);
  const workItems = useStore((s) => s.workItems);
  const addInboxItem = useStore((s) => s.addInboxItem);
  const activeProjectId = activeProjectSetting && projects.some((p) => p.id === activeProjectSetting) ? activeProjectSetting : null;
  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) ?? null : null;

  // Solo-first counts: all open items are mine; Today/Overdue compare to local today
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  const openWorkItems = workItems.filter((w) => w.status !== "Done" && (!activeProjectId || w.project === activeProjectId));
  const todayCount = openWorkItems.filter((w) => !w.due || w.due === todayKey).length;
  // My Tasks default scope is "mine" - count only the current user's open tasks
  const myTasksCount = openWorkItems.filter((w) => w.assignee === "AM").length;
  const [cmdOpen, setCmdOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickValue, setQuickValue] = useState("");
  const [projectScopeOpen, setProjectScopeOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(STORAGE_KEY) !== "0";
  });
  const [projectsOpen, setProjectsOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(PROJECTS_STORAGE_KEY) !== "0";
  });
  const [moreOpen, setMoreOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("fb.sidebarMoreOpen") === "1";
  });
  const [hydrated, setHydrated] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const projectScopeRef = useRef<HTMLDivElement>(null);
  const quickCaptureRef = useRef<HTMLDivElement>(null);

  const navBeforeProjects: NavItem[] = [
    { to: "/", label: "Today", icon: Home, count: todayCount },
    { to: "/inbox", label: "Inbox", icon: Inbox, count: inboxCount },
    { to: "/my-tasks", label: "My Tasks", icon: CheckSquare, count: myTasksCount },
    { to: "/work-items", label: "Tasks", icon: ListTodo },
  ];
  const navAfterProjects: NavItem[] = [
    { to: "/board", label: "Board", icon: LayoutGrid },
    { to: "/notes", label: "Notes", icon: FileText },
    { to: "/calendar", label: "Calendar", icon: Calendar },
  ];

  const navMore = [
    { to: "/timeline", label: "Timeline", icon: BarChart3 },
    { to: "/connections", label: "Connections", icon: Network },
    { to: "/activity", label: "Activity", icon: Activity },
    { to: "/team", label: "Team", icon: Users },
    { to: "/report", label: "Project Report", icon: BarChart3 },
  ];

  // Flat list used for the collapsed icon rail
  const navMain: NavItem[] = [
    ...navBeforeProjects,
    { to: "/projects", label: "Projects", icon: FolderKanban },
    ...navAfterProjects,
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PROJECTS_STORAGE_KEY, projectsOpen ? "1" : "0");
    }
  }, [projectsOpen]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("fb.sidebarMoreOpen", moreOpen ? "1" : "0");
    }
  }, [moreOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!projectScopeOpen && !quickOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (projectScopeOpen && projectScopeRef.current && !projectScopeRef.current.contains(target)) {
        setProjectScopeOpen(false);
      }
      if (quickOpen && quickCaptureRef.current && !quickCaptureRef.current.contains(target)) {
        setQuickOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [projectScopeOpen, quickOpen]);

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
                className="lov-icon-btn h-6 w-6"
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
                  className="lov-icon-btn h-7 w-7"
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
          {sidebarOpen ? (
            <>
              <SidebarSection items={navBeforeProjects} isActive={isActive} collapsed={false} />
              <ProjectsNavItem
                href="/projects"
                active={isActive("/projects")}
                open={projectsOpen}
                onToggle={() => setProjectsOpen((v) => !v)}
              />
              {projectsOpen && (
                <div className="mt-0.5 mb-1 space-y-px pl-5">
                  {projects.map((p) => {
                    const active = path.startsWith("/projects") && (routeProjectId ?? activeProjectId) === p.id;
                    return (
                      <Link key={p.id} href={`/projects?project=${p.id}`} onClick={() => updateSettings({ activeProjectId: p.id })}
                        className={`lov-nav-item group gap-2 px-2 py-1 text-[12.5px] ${active ? "lov-nav-item-active font-medium" : ""}`}>
                        <ProjectIcon name={p.icon} accent={p.accent} size={13} />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
              <SidebarSection items={navAfterProjects} isActive={isActive} collapsed={false} />
              <SidebarCollapsible
                label="More"
                open={moreOpen}
                onToggle={() => setMoreOpen((v) => !v)}
              >
                <SidebarSection items={navMore} isActive={isActive} collapsed={false} />
              </SidebarCollapsible>
            </>
          ) : (
            <>
              <SidebarSection items={navMain} isActive={isActive} collapsed={true} />
              <SidebarSection items={navMore} isActive={isActive} collapsed={true} />
            </>
          )}
        </nav>

        <div className={`border-t ${sidebarOpen ? "p-3" : "flex justify-center py-2"}`}>
          {sidebarOpen ? (
            <Link href="/settings" className={`lov-nav-item gap-2 px-2 py-1 text-[13px] ${isActive("/settings") ? "lov-nav-item-active" : ""}`}>
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </Link>
          ) : (
            <Link href="/settings" title="Settings" className={`lov-nav-item h-8 w-8 justify-center ${isActive("/settings") ? "lov-nav-item-active" : ""}`}>
              <Settings className="h-4 w-4" />
            </Link>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-40 flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
          <button onClick={() => setMobileNavOpen(true)} className="lov-icon-btn md:hidden" aria-label="Open navigation">
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            {title ?? <span className="font-medium">FlowBoard</span>}
          </div>
          <div className="flex-1" />
          <div className="pointer-events-none absolute left-1/2 top-1/2 hidden w-[min(74vw,58rem)] -translate-x-1/2 -translate-y-1/2 grid-cols-[minmax(18rem,1fr)_minmax(15rem,0.62fr)_max-content] items-center gap-2 sm:grid">
            <div ref={projectScopeRef} className="pointer-events-auto relative">
              <button
                onClick={() => {
                  setQuickOpen(false);
                  setProjectScopeOpen((open) => !open);
                }}
                className="lov-btn h-8 w-full min-w-0 justify-start border-foreground/15 bg-card px-3 text-[13px] shadow-xs"
                title={activeProject ? `Project scope: ${activeProject.name}` : "Project scope: All projects"}
              >
                <span className="shrink-0 text-[11px] font-medium uppercase text-muted-foreground">Project</span>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {activeProject ? <ProjectIcon name={activeProject.icon} accent={activeProject.accent} size={14} /> : <FolderKanban className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-left font-semibold">{activeProject?.name ?? "All projects"}</span>
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
              {projectScopeOpen && (
                <div className="absolute left-0 right-0 top-9 z-[80] rounded-md border bg-popover py-1 shadow-lg">
                    <button
                      onClick={() => { updateSettings({ activeProjectId: null }); setProjectScopeOpen(false); }}
                      className={`lov-menu-item py-1.5 ${!activeProjectId ? "font-medium text-foreground" : ""}`}
                    >
                      <span className="shrink-0 text-[11px] font-medium uppercase text-muted-foreground">Project</span>
                      <FolderKanban className="h-3.5 w-3.5" />
                      <span className="flex-1">All projects</span>
                    </button>
                    <div className="my-1 h-px bg-border/70" />
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => { updateSettings({ activeProjectId: project.id }); setProjectScopeOpen(false); }}
                        className={`lov-menu-item py-1.5 ${activeProjectId === project.id ? "font-medium text-foreground" : ""}`}
                      >
                        <span className="shrink-0 text-[11px] font-medium uppercase text-muted-foreground">Project</span>
                        <ProjectIcon name={project.icon} accent={project.accent} size={13} />
                        <span className="min-w-0 flex-1 truncate">{project.name}</span>
                        {activeProjectId === project.id && <span className="text-[10px] text-muted-foreground">Active</span>}
                      </button>
                    ))}
                </div>
              )}
            </div>
            <button onClick={() => setCmdOpen(true)}
              className="lov-btn pointer-events-auto w-full min-w-0 justify-start bg-sidebar text-muted-foreground hover:text-foreground">
              <Search className="h-3 w-3" />
              <span className="min-w-0 truncate">Search or jump...</span>
              <kbd className="ml-auto rounded border bg-background px-1 font-mono text-[10px]">Ctrl K</kbd>
            </button>
            <div ref={quickCaptureRef} className="pointer-events-auto relative">
              <button
                onClick={() => {
                  setProjectScopeOpen(false);
                  setQuickOpen((v) => !v);
                }}
                className="lov-btn whitespace-nowrap"
              >
                <Plus className="h-3 w-3" /> Quick capture
              </button>
              {quickOpen && (
                <div className="absolute left-1/2 top-9 z-[80] w-80 -translate-x-1/2 rounded-md border bg-popover p-2 shadow-lg">
                    <input
                      autoFocus
                      value={quickValue}
                      onChange={(e) => setQuickValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") submitQuick(); if (e.key === "Escape") setQuickOpen(false); }}
                      placeholder="Capture a task, note, or idea..."
                      className="h-8 w-full rounded border bg-card px-2 text-[13px] outline-none focus:border-ring"
                    />
                    <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                      <span>Saves to <Link href="/inbox" className="underline decoration-dotted underline-offset-2 hover:text-foreground" onClick={() => setQuickOpen(false)}>Inbox</Link></span>
                      <kbd className="rounded border bg-muted px-1 font-mono">Enter</kbd>
                    </div>
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setCmdOpen(true)} className="lov-icon-btn sm:hidden">
            <Command className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <Avatar id="AM" name="Alex Morgan" size={26} />
            <span className="max-w-28 truncate text-[12px] font-medium text-foreground">Alex Morgan</span>
          </div>
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
        <div className="fixed inset-0 z-[90] md:hidden">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[86vw] flex-col border-r bg-sidebar shadow-xl">
            <div className="flex h-12 items-center justify-between border-b px-3">
              <Link href="/" onClick={() => setMobileNavOpen(false)} className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold tracking-tight text-background">FB</span>
                <span className="truncate">{workspaceName}</span>
              </Link>
              <button onClick={() => setMobileNavOpen(false)} className="lov-icon-btn" aria-label="Close navigation">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <SidebarSection items={navBeforeProjects} isActive={isActive} collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
              <ProjectsNavItem
                href="/projects"
                active={isActive("/projects")}
                open={projectsOpen}
                onToggle={() => setProjectsOpen((v) => !v)}
                onNavigate={() => setMobileNavOpen(false)}
              />
              {projectsOpen && (
                <div className="mt-0.5 mb-1 space-y-px pl-5">
                  {projects.map((p) => {
                    const active = path.startsWith("/projects") && (routeProjectId ?? activeProjectId) === p.id;
                    return (
                      <Link key={p.id} href={`/projects?project=${p.id}`} onClick={() => { updateSettings({ activeProjectId: p.id }); setMobileNavOpen(false); }}
                        className={`lov-nav-item group gap-2 px-2 py-1 text-[12.5px] ${active ? "lov-nav-item-active font-medium" : ""}`}>
                        <ProjectIcon name={p.icon} accent={p.accent} size={13} />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
              <SidebarSection items={navAfterProjects} isActive={isActive} collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
              <SidebarCollapsible
                label="More"
                open={moreOpen}
                onToggle={() => setMoreOpen((v) => !v)}
              >
                <SidebarSection items={navMore} isActive={isActive} collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
              </SidebarCollapsible>
            </nav>
            <div className="border-t p-3">
              <Link href="/settings" onClick={() => setMobileNavOpen(false)} className={`lov-nav-item gap-2 px-2 py-1 text-[13px] ${isActive("/settings") ? "lov-nav-item-active" : ""}`}>
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

function ProjectsNavItem({ href, active, open, onToggle, onNavigate }: { href: string; active: boolean; open: boolean; onToggle: () => void; onNavigate?: () => void }) {
  return (
    <div className={`group flex items-center gap-px rounded ${active ? "lov-nav-item-active" : "hover:bg-[var(--color-hover)]"}`}>
      <Link
        href={href}
        onClick={onNavigate}
        className={`flex flex-1 items-center gap-2 rounded px-2 py-1 text-[13px] ${active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
      >
        <FolderKanban className="h-3.5 w-3.5" />
        <span className="flex-1">Projects</span>
      </Link>
      <button
        onClick={onToggle}
        title={open ? "Collapse projects" : "Expand projects"}
        aria-label={open ? "Collapse projects" : "Expand projects"}
        aria-expanded={open}
        className="lov-icon-btn h-6 w-6"
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
    </div>
  );
}

function SidebarLabel({ children }: { children: ReactNode }) {
  return <div className="mt-5 mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</div>;
}

function SidebarCollapsible({ label, open, onToggle, children }: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mt-1">
      <div className={`group flex items-center gap-px rounded hover:bg-[var(--color-hover)]`}>
        <button
          onClick={onToggle}
          className="flex flex-1 items-center gap-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
          {label}
        </button>
      </div>
      {open && <div className="mt-0.5">{children}</div>}
    </div>
  );
}

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count?: number;
};
function SidebarSection({ items, isActive, collapsed, onNavigate }: { items: NavItem[]; isActive: (to: string) => boolean; collapsed: boolean; onNavigate?: () => void }) {
  return (
    <div className="space-y-px">
      {items.map((n) => {
        const Icon = n.icon;
        const active = isActive(n.to);
        if (collapsed) {
          return (
            <Link key={n.to} href={n.to} title={n.label} onClick={onNavigate}
              className={`lov-nav-item h-8 w-full justify-center ${active ? "lov-nav-item-active" : ""}`}>
              <Icon className="h-4 w-4" />
            </Link>
          );
        }
        return (
          <Link key={n.to} href={n.to} onClick={onNavigate}
            className={`lov-nav-item gap-2 px-2 py-1 text-[13px] ${active ? "lov-nav-item-active" : ""}`}>
            <Icon className="h-3.5 w-3.5" />
            <span className="flex-1">{n.label}</span>
            {n.count != null ? (
              <span className="text-[11px] text-muted-foreground">{n.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
