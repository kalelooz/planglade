"use client";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  Home, Inbox, FolderKanban, Calendar, FileText, CheckSquare,
  Settings, Search, Plus, PanelLeft, Command, X, ChevronRight, ChevronDown, Bell,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { getDatePart, localDateKey } from "@/lib/dates";
import { getServerSession } from "@/lib/server-session-client";
import { CommandPalette } from "./command-palette";
import { Avatar } from "./icons";
import { ProjectIcon } from "./project-icon";
import { useAuth } from "@/components/flowboard/auth-context";

const STORAGE_KEY = "fb.sidebarOpen";
const PROJECTS_STORAGE_KEY = "fb.sidebarProjectsOpen";

type AppShellProps = {
  children: ReactNode;
  title?: ReactNode;
  tabs?: { label: string; to: string; active?: boolean }[];
  toolbar?: ReactNode;
};

type HeaderNotification = {
  id: string;
  type: "MENTION" | "ASSIGNED" | "COMMENT" | "STATUS";
  title: string;
  body: string;
  createdAt: string;
  isUnread?: boolean;
  workItemId: string | null;
  actor: { id: string; name: string | null; email: string } | null;
};

type SessionIdentity = {
  name: string;
  email: string;
  authMode: string;
};

export function AppShell(props: AppShellProps) {
  return (
    <Suspense fallback={<AppShellLayout {...props} routeProjectId={null} />}>
      <AppShellWithSearchParams {...props} />
    </Suspense>
  );
}

function AppShellWithSearchParams(props: AppShellProps) {
  const searchParams = useSearchParams();
  const routeProjectId = searchParams?.get("project") ?? null;
  return <AppShellLayout {...props} routeProjectId={routeProjectId} />;
}

function AppShellLayout({ children, title, tabs, toolbar, routeProjectId }: AppShellProps & { routeProjectId: string | null }) {
  const { user: authUser, signOut, authMode: clientAuthMode } = useAuth();
  const path = usePathname() ?? "/";
  const projects = useStore((s) => s.projects);
  const activeProjectSetting = useStore((s) => s.settings.activeProjectId);
  const updateSettings = useStore((s) => s.updateSettings);
  const inboxCount = useStore((s) => s.inboxItems.length);
  const workItems = useStore((s) => s.workItems);
  const addInboxItem = useStore((s) => s.addInboxItem);
  const projectsListRoute = path.startsWith("/app/projects") && !routeProjectId;
  const activeProjectId = routeProjectId ?? (!projectsListRoute && activeProjectSetting && projects.some((p) => p.id === activeProjectSetting) ? activeProjectSetting : null);
  const activeProject = activeProjectId ? projects.find((p) => p.id === activeProjectId) ?? null : null;
  const [now, setNow] = useState(() => new Date());

  // Solo-first counts: all open items are mine; Today/Overdue compare to local today
  const todayKey = localDateKey(now);
  const openWorkItems = workItems.filter((w) => w.status !== "Done" && (!activeProjectId || w.project === activeProjectId));
  const todayCount = openWorkItems.filter((w) => !w.due || getDatePart(w.due) === todayKey).length;
  // My Tasks default scope is "mine" - count only the current user's open tasks
  const myTasksCount = openWorkItems.filter((w) => w.assignee === "AM").length;
  const [cmdOpen, setCmdOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickValue, setQuickValue] = useState("");
  const [projectScopeOpen, setProjectScopeOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notifications, setNotifications] = useState<HeaderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationScope, setNotificationScope] = useState<{ workspaceId: string; userId: string } | null>(null);
  const [sessionIdentity, setSessionIdentity] = useState<SessionIdentity | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const router = useRouter();

  const createProject = () => {
    router.push("/app/projects?new=1");
  };

  const applyProjectScope = (id: string | null) => {
    updateSettings({ activeProjectId: id });
    setProjectScopeOpen(false);

    const scopedRoutes = ["/app/projects", "/app/tasks", "/app/calendar", "/timeline"];
    if (scopedRoutes.some((route) => path.startsWith(route))) {
      router.push(id ? `${path}?project=${id}` : path);
    }
  };

  // Keep SSR and first client render stable to avoid hydration mismatches.
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [projectsOpen, setProjectsOpen] = useState<boolean>(true);
  const [hydrated, setHydrated] = useState(false);
  const [logoHover, setLogoHover] = useState(false);
  const projectScopeRef = useRef<HTMLDivElement>(null);
  const quickCaptureRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const navBeforeProjects: NavItem[] = [
    { to: "/app", label: "Home", icon: Home, count: todayCount },
    { to: "/app/inbox", label: "Inbox", icon: Inbox, count: inboxCount },
  ];

  const navAfterProjects: NavItem[] = [
    { to: "/app/tasks", label: "Tasks", icon: CheckSquare, count: myTasksCount },
    { to: "/app/notes", label: "Notes", icon: FileText },
    { to: "/app/calendar", label: "Calendar", icon: Calendar },
    { to: "/app/settings", label: "Settings", icon: Settings },
  ];

  // Flat list used for the collapsed icon rail
  const navMain: NavItem[] = [
    ...navBeforeProjects,
    { to: "/app/projects", label: "Projects", icon: FolderKanban },
    ...navAfterProjects,
  ];

  const submitQuick = () => {
    const v = quickValue.trim();
    if (v) {
      addInboxItem(v, { createWorkItem: true });
      toast.success("Captured to Inbox and Tasks", { description: v });
    }
    setQuickValue("");
    setQuickOpen(false);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedSidebar = window.localStorage.getItem(STORAGE_KEY);
    const savedProjects = window.localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (savedSidebar === "0" || savedSidebar === "1") {
      setSidebarOpen(savedSidebar === "1");
    }
    if (savedProjects === "0" || savedProjects === "1") {
      setProjectsOpen(savedProjects === "1");
    }
  }, []);

  useEffect(() => {
    // Enable width transitions only after the first client paint,
    // so the SSR-client width correction doesn't animate.
    const id = requestAnimationFrame(() => setHydrated(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, sidebarOpen ? "1" : "0");
  }, [sidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PROJECTS_STORAGE_KEY, projectsOpen ? "1" : "0");
  }, [projectsOpen]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const session = await getServerSession();
        if (!active) return;
        setNotificationScope({ workspaceId: session.workspace.id, userId: session.user.id });
        setSessionIdentity({
          name: session.user.name ?? session.user.email,
          email: session.user.email,
          authMode: session.authMode ?? "dev-session-scaffold",
        });
      } catch {
        if (active) {
          setNotificationScope(null);
          setSessionIdentity(null);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!notificationScope) return;
    let active = true;

    const load = async () => {
      setNotificationsLoading(true);
      try {
        const response = await fetch(
          `/api/notifications?workspaceId=${encodeURIComponent(notificationScope.workspaceId)}&userId=${encodeURIComponent(notificationScope.userId)}&limit=12`,
          {
            cache: "no-store",
            headers: { "x-flowboard-user-id": notificationScope.userId },
          }
        );
        if (!response.ok || !active) return;
        const payload = (await response.json()) as { notifications: HeaderNotification[]; unreadCount: number };
        if (active) {
          setNotifications(payload.notifications ?? []);
          setUnreadCount(payload.unreadCount ?? 0);
        }
      } finally {
        if (active) setNotificationsLoading(false);
      }
    };

    void load();
    const interval = window.setInterval(() => {
      void load();
    }, 60_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [notificationScope]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!projectScopeOpen && !quickOpen && !notificationsOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (projectScopeOpen && projectScopeRef.current && !projectScopeRef.current.contains(target)) {
        setProjectScopeOpen(false);
      }
      if (quickOpen && quickCaptureRef.current && !quickCaptureRef.current.contains(target)) {
        setQuickOpen(false);
      }
      if (notificationsOpen && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [projectScopeOpen, quickOpen, notificationsOpen]);

  const isActive = (to: string) => {
    if (to === "/app") return path === "/app";
    return path === to || path.startsWith(`${to}/`);
  };
  const markNotificationsRead = async (notificationIds?: string[]) => {
    if (!notificationScope) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": notificationScope.userId,
      },
      body: JSON.stringify({
        workspaceId: notificationScope.workspaceId,
        userId: notificationScope.userId,
        ...(notificationIds && notificationIds.length > 0 ? { notificationIds } : {}),
      }),
    });
  };
  const formatNotificationTime = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  const displayName = authUser?.displayName ?? sessionIdentity?.name ?? "User";
  const displayAvatarId = authUser?.uid ?? sessionIdentity?.email ?? "user";
  const shouldShowSignOut = (sessionIdentity?.authMode ?? clientAuthMode) !== "dev-session-scaffold" && clientAuthMode !== "dev";

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
              <Link href="/app" title="PlanGlade home" className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold tracking-tight text-background">PG</span>
                <span className="truncate">PlanGlade</span>
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
                  href="/app"
                  title="PlanGlade home"
                  className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold tracking-tight text-background"
                >
                  PG
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
                href="/app/projects"
                active={isActive("/app/projects")}
                open={projectsOpen}
                onToggle={() => setProjectsOpen((v) => !v)}
                onCreate={createProject}
              />
              {projectsOpen && (
                <div className="mt-0.5 mb-1 space-y-px pl-5">
                  {projects.map((p) => {
                    const active = (routeProjectId ?? activeProjectId) === p.id;
                    return (
                      <Link key={p.id} href={`/app/projects?project=${p.id}`} onClick={() => updateSettings({ activeProjectId: p.id })}
                        className={`lov-nav-item group gap-2 px-2 py-1 text-[12.5px] ${active ? "lov-nav-item-active font-medium" : ""}`}>
                        <ProjectIcon name={p.icon} accent={p.accent} size={13} />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
              <SidebarSection items={navAfterProjects} isActive={isActive} collapsed={false} />
            </>
          ) : (
            <>
              <SidebarSection items={navMain} isActive={isActive} collapsed={true} />
            </>
          )}
        </nav>

      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-40 flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
          <button onClick={() => setMobileNavOpen(true)} className="lov-icon-btn md:hidden" aria-label="Open navigation">
            <PanelLeft className="h-4 w-4" />
          </button>
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            {title ?? <span className="font-medium">PlanGlade</span>}
          </div>
          <div className="flex-1" />
          <div ref={projectScopeRef} className="relative hidden w-52 lg:block">
              <button
                onClick={() => {
                  setQuickOpen(false);
                  setProjectScopeOpen((open) => !open);
                }}
                className="lov-btn h-8 w-full min-w-0 justify-start border-foreground/15 bg-card px-2.5 text-[13px] shadow-xs"
                title={activeProject ? `Project scope: ${activeProject.name}` : "Project scope: All projects"}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {activeProject ? <ProjectIcon name={activeProject.icon} accent={activeProject.accent} size={14} /> : <FolderKanban className="h-3.5 w-3.5" />}
                </span>
                <span className="min-w-0 flex-1 truncate text-left font-semibold">{activeProject?.name ?? "All projects"}</span>
                <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
              </button>
              {projectScopeOpen && (
                <div className="absolute left-0 right-0 top-9 z-[80] rounded-md border bg-popover py-1 shadow-lg">
                    <button
                      onClick={() => applyProjectScope(null)}
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
                        onClick={() => applyProjectScope(project.id)}
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
            className="lov-btn hidden w-56 min-w-0 justify-start bg-sidebar text-muted-foreground hover:text-foreground md:inline-flex">
              <Search className="h-3 w-3" />
              <span className="min-w-0 truncate">Search or jump...</span>
              <kbd className="ml-auto hidden rounded border bg-background px-1 font-mono text-[10px] xl:inline-flex">Ctrl K</kbd>
          </button>
          {false && !path.startsWith("/app/projects") && (
            <button
              onClick={createProject}
              className="lov-btn lov-btn-primary hidden whitespace-nowrap sm:inline-flex"
            >
              <FolderKanban className="h-3.5 w-3.5" /> New project
            </button>
          )}
          <div ref={quickCaptureRef} className="relative hidden sm:block">
              <button
                onClick={() => {
                  setProjectScopeOpen(false);
                  setQuickOpen((v) => !v);
                }}
                className="lov-btn whitespace-nowrap"
              >
                <Plus className="h-3 w-3" />
                <span>Quick capture</span>
                {inboxCount > 0 && (
                  <span className="ml-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[10px] font-medium text-muted-foreground tabular-nums">
                    {inboxCount}
                  </span>
                )}
              </button>
              {quickOpen && (
                <div className="absolute right-0 top-9 z-[80] w-80 rounded-md border bg-popover p-2 shadow-lg">
                    <input
                      autoFocus
                      value={quickValue}
                      onChange={(e) => setQuickValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") submitQuick(); if (e.key === "Escape") setQuickOpen(false); }}
                      placeholder="Capture a task, note, or idea..."
                      className="h-8 w-full rounded border bg-card px-2 text-[13px] outline-none focus:border-ring"
                    />
                    <div className="mt-1.5 flex items-center justify-between px-1 text-[10px] text-muted-foreground">
                      <span>Saves to <Link href="/app/inbox" className="underline decoration-dotted underline-offset-2 hover:text-foreground" onClick={() => setQuickOpen(false)}>Inbox</Link> + Tasks</span>
                      <kbd className="rounded border bg-muted px-1 font-mono">Enter</kbd>
                    </div>
                </div>
              )}
          </div>
          <button onClick={() => setCmdOpen(true)} className="lov-icon-btn sm:hidden">
            <Command className="h-4 w-4" />
          </button>
          <div ref={notificationsRef} className="relative">
            <button
              onClick={() => {
                setProjectScopeOpen(false);
                setQuickOpen(false);
                setNotificationsOpen((open) => !open);
              }}
              className="lov-icon-btn relative"
              title="Notifications"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                  {Math.min(unreadCount, 9)}
                </span>
              )}
            </button>
            {notificationsOpen && (
              <div className="absolute right-0 top-9 z-[85] w-[22rem] rounded-md border bg-popover shadow-lg">
                <div className="flex items-center justify-between border-b px-3 py-2">
                  <span className="text-[12px] font-medium">Notifications</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{notifications.length}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setUnreadCount(0);
                        setNotifications((current) => current.map((notification) => ({ ...notification, isUnread: false })));
                        void markNotificationsRead();
                      }}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Mark all read
                    </button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notificationsLoading ? (
                    <p className="px-3 py-3 text-[12px] text-muted-foreground">Loading notifications...</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-3 py-3 text-[12px] text-muted-foreground">No notifications.</p>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => {
                          setNotificationsOpen(false);
                          if (notification.isUnread) {
                            setUnreadCount((current) => Math.max(0, current - 1));
                            setNotifications((current) =>
                              current.map((entry) =>
                                entry.id === notification.id ? { ...entry, isUnread: false } : entry
                              )
                            );
                            void markNotificationsRead([notification.id]);
                          }
                          if (!notification.workItemId) {
                            router.push("/activity");
                            return;
                          }
                          const focus = notification.type === "COMMENT" || notification.type === "MENTION" ? "comments" : "history";
                          router.push(`/app/tasks?taskId=${encodeURIComponent(notification.workItemId)}&focus=${focus}`);
                        }}
                        className={`block w-full border-b px-3 py-2 text-left last:border-b-0 hover:bg-[var(--color-hover)]/60 ${notification.isUnread ? "bg-primary/[0.045]" : ""}`}
                      >
                        <div className="mb-0.5 flex items-center justify-between gap-2">
                          <span className="truncate text-[12px] font-medium">{notification.title}</span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {formatNotificationTime(notification.createdAt)}
                          </span>
                        </div>
                        <p className="line-clamp-2 text-[12px] text-muted-foreground">{notification.body}</p>
                        {notification.actor && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {notification.actor.name ?? notification.actor.email}
                          </p>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Avatar id={displayAvatarId} name={displayName} size={26} />
            <span className="hidden max-w-28 truncate text-[12px] font-medium text-foreground">{displayName}</span>
            {shouldShowSignOut && (
              <button
                type="button"
                onClick={() => {
                  void signOut("/login");
                }}
                className="lov-icon-btn"
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            )}
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
              <Link href="/app" onClick={() => setMobileNavOpen(false)} className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold tracking-tight text-background">PG</span>
                <span className="truncate">PlanGlade</span>
              </Link>
              <button onClick={() => setMobileNavOpen(false)} className="lov-icon-btn" aria-label="Close navigation">
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-3">
              <SidebarSection items={navBeforeProjects} isActive={isActive} collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
              <ProjectsNavItem
                href="/app/projects"
                active={isActive("/app/projects")}
                open={projectsOpen}
                onToggle={() => setProjectsOpen((v) => !v)}
                onNavigate={() => setMobileNavOpen(false)}
                onCreate={createProject}
              />
              {projectsOpen && (
                <div className="mt-0.5 mb-1 space-y-px pl-5">
                  {projects.map((p) => {
                    const active = (routeProjectId ?? activeProjectId) === p.id;
                    return (
                      <Link key={p.id} href={`/app/projects?project=${p.id}`} onClick={() => { updateSettings({ activeProjectId: p.id }); setMobileNavOpen(false); }}
                        className={`lov-nav-item group gap-2 px-2 py-1 text-[12.5px] ${active ? "lov-nav-item-active font-medium" : ""}`}>
                        <ProjectIcon name={p.icon} accent={p.accent} size={13} />
                        <span className="truncate">{p.name}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
              <SidebarSection items={navAfterProjects} isActive={isActive} collapsed={false} onNavigate={() => setMobileNavOpen(false)} />
            </nav>
          </div>
        </div>
      )}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}

function ProjectsNavItem({ href, active, open, onToggle, onNavigate, onCreate }: { href: string; active: boolean; open: boolean; onToggle: () => void; onNavigate?: () => void; onCreate?: () => void }) {
  return (
    <div className={`group flex items-center gap-px rounded ${active ? "lov-nav-item-active" : "hover:bg-[var(--color-hover)]"}`}>
      <Link
        href={href}
        onClick={onNavigate}
        className={`lov-nav-item flex flex-1 items-center gap-2 rounded px-2 py-1 text-[13px] ${active ? "lov-nav-item-active text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}
      >
        <FolderKanban className="h-3.5 w-3.5" />
        <span className="flex-1">Projects</span>
      </Link>
      {onCreate && (
        <button
          onClick={(e) => { e.preventDefault(); onCreate(); }}
          title="Create new project"
          aria-label="Create new project"
          className="lov-icon-btn h-6 w-6 text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" />
        </button>
      )}
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
            {n.count != null && n.count > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold tabular-nums text-background">{n.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
