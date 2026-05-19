export type Priority = "High" | "Medium" | "Low";
export type Status = "Backlog" | "To Do" | "In Progress" | "In Review" | "Done";

export type BoringAvatarVariant = "marble" | "beam" | "pixel" | "sunset" | "ring" | "bauhaus";

export type Member = {
  id: string;
  name: string;
  role: string;
  color: string;
  avatar?: { variant: BoringAvatarVariant; colors: string[]; seed?: string };
};

export const members: Member[] = [
  { id: "AM", name: "Alex Morgan", role: "Product Lead", color: "oklch(0.62 0.13 195)" },
  { id: "SK", name: "Sara Kim", role: "Designer", color: "oklch(0.65 0.16 330)" },
  { id: "JD", name: "Jake Davis", role: "Engineer", color: "oklch(0.55 0.15 250)" },
  { id: "LP", name: "Lisa Park", role: "Frontend", color: "oklch(0.62 0.15 30)" },
  { id: "RC", name: "Raj Chen", role: "Data", color: "oklch(0.6 0.14 145)" },
];
export const byInitials = (id: string) => members.find((m) => m.id === id) ?? members[0];

export type ProjectStatus = "Active" | "In Review" | "On Hold" | "Archived";

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  due: string;
  owner: string;
  progress: number;
  accent: string;
  icon?: string;
};

export const projects: Project[] = [
  { id: "core", name: "Core Product", status: "Active", due: "2026-06-22", owner: "AM", progress: 62, accent: "oklch(0.52 0.09 195)", icon: "Box" },
  { id: "web", name: "Website Redesign", status: "Active", due: "2026-05-28", owner: "SK", progress: 78, accent: "oklch(0.55 0.15 250)", icon: "Globe" },
  { id: "mobile", name: "Mobile App v2", status: "Active", due: "2026-06-15", owner: "LP", progress: 41, accent: "oklch(0.62 0.15 30)", icon: "Smartphone" },
  { id: "api", name: "API Migration", status: "In Review", due: "2026-05-20", owner: "JD", progress: 88, accent: "oklch(0.6 0.14 145)", icon: "Database" },
  { id: "ds", name: "Design System", status: "On Hold", due: "2026-07-01", owner: "SK", progress: 30, accent: "oklch(0.65 0.16 330)", icon: "Palette" },
];

export type ChecklistItem = { id: string; text: string; done: boolean };

export type WorkItem = {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  assignee: string;
  label: string;
  start?: string;
  due: string;
  project: string;
  checklist?: ChecklistItem[];
  noteIds?: string[];
  blockerIds?: string[];
  description?: string;
};

export const workItems: WorkItem[] = [
  { id: "FB-23", title: "Design empty state illustrations", status: "Backlog", priority: "Medium", assignee: "LP", label: "Enhancement", due: "2026-12-22", project: "core" },
  { id: "FB-45", title: "Embed pages in nested wiki views", status: "Backlog", priority: "Medium", assignee: "SK", label: "Editor", due: "2026-03-03", project: "core" },
  { id: "FB-67", title: "Improve drag-and-drop behavior", status: "Backlog", priority: "High", assignee: "JD", label: "Product", due: "2026-08-18", project: "core" },
  { id: "FB-89", title: "Redesign mobile list view", status: "Backlog", priority: "High", assignee: "SK", label: "Mobile", due: "2026-11-29", project: "mobile" },
  { id: "FB-12", title: "Add voice input to quick capture", status: "Backlog", priority: "Low", assignee: "AM", label: "AI", due: "2026-02-11", project: "core" },
  { id: "FB-98", title: "Redesign context selector layout", status: "Backlog", priority: "Medium", assignee: "LP", label: "AI", due: "2026-03-03", project: "core" },
  { id: "FB-76", title: "Redesign create work item modal", status: "Backlog", priority: "High", assignee: "JD", label: "Product", due: "2026-03-03", project: "core" },
  { id: "FB-34", title: "Add password protection for pages and wiki", status: "Backlog", priority: "Medium", assignee: "RC", label: "Security", due: "2026-01-01", project: "core" },
  { id: "FB-56", title: "Product Tour", status: "To Do", priority: "Low", assignee: "AM", label: "Product", due: "2026-04-27", project: "core" },
  { id: "FB-78", title: "Workflow approvals UX", status: "To Do", priority: "Medium", assignee: "LP", label: "Engineering", due: "2026-10-14", project: "core" },
  { id: "FB-90", title: "Redesign create work item modal", status: "To Do", priority: "High", assignee: "SK", label: "Bug", due: "2026-09-30", project: "core" },
  { id: "FB-21", title: "Improve epic detail view", status: "To Do", priority: "Medium", assignee: "JD", label: "Enhancement", due: "2026-05-08", project: "core" },
  { id: "FB-43", title: "Nested page node redesign for mobile", status: "To Do", priority: "Medium", assignee: "SK", label: "Wiki", due: "2026-07-21", project: "mobile" },
  { id: "FB-65", title: "UX/UI for Figma integration", status: "In Progress", priority: "High", assignee: "LP", label: "Authentication", due: "2026-12-19", project: "core" },
  { id: "FB-87", title: "Dynamic icons based on context type", status: "In Progress", priority: "Medium", assignee: "RC", label: "Billing", due: "2026-08-25", project: "core" },
  { id: "FB-102", title: "Local persistence cleanup", status: "In Review", priority: "High", assignee: "JD", label: "Infrastructure", due: "2026-05-24", project: "api" },
  { id: "FB-111", title: "Quick capture keyboard polish", status: "Done", priority: "Low", assignee: "AM", label: "UX", due: "2026-05-12", project: "core" },
];

export const inboxItems = [
  { id: "i1", title: "Customer asked about SAML SSO timing", captured: "2h ago" },
  { id: "i2", title: "Look into flaky timeline drag test", captured: "5h ago" },
  { id: "i3", title: "Idea: keyboard shortcut for Inbox triage", captured: "yesterday" },
  { id: "i4", title: "Reply to Sara about mobile nav spec", captured: "yesterday" },
  { id: "i5", title: "Audit colors used in priority chips", captured: "2d ago" },
];

export const notes = [
  { id: "n1", title: "Q3 Product Roadmap", tag: "Planning", updated: "May 15", excerpt: "Three themes: triage, planning, focus. Cut anything not aligned…" },
  { id: "n2", title: "Team Meeting Notes — May 12", tag: "Meeting", updated: "May 12", excerpt: "Discussed FB-65 blockers. Lisa to spike Figma OAuth this week…" },
  { id: "n3", title: "Design Brief — Mobile v2", tag: "Design", updated: "May 10", excerpt: "Goals: faster capture on phone, single-column lists, larger tap…" },
  { id: "n4", title: "User Research Findings", tag: "Research", updated: "May 8", excerpt: "Users want fewer surfaces, not more. List > board in 8/10 sessions…" },
  { id: "n5", title: "API Deprecation Plan", tag: "Engineering", updated: "May 6", excerpt: "Sunset v1 endpoints by July. Migration guide draft attached…" },
];

export type ActivityItem = { who: string; action: string; target: string; to?: string; time: string };
export const activity: { date: string; items: ActivityItem[] }[] = [
  { date: "Today", items: [
    { who: "LP", action: "moved", target: "FB-65 UX/UI for Figma integration", to: "In Progress", time: "10:24" },
    { who: "JD", action: "commented on", target: "FB-102 Local persistence cleanup", time: "09:58" },
    { who: "AM", action: "completed", target: "FB-111 Quick capture keyboard polish", time: "09:12" },
  ]},
  { date: "Yesterday", items: [
    { who: "SK", action: "created", target: "FB-90 Redesign create work item modal", time: "16:40" },
    { who: "RC", action: "changed priority on", target: "FB-87 Dynamic icons", to: "Medium", time: "14:02" },
    { who: "LP", action: "added label", target: "FB-65", to: "Authentication", time: "11:18" },
  ]},
  { date: "May 14", items: [
    { who: "JD", action: "merged", target: "FB-102 → main", time: "18:30" },
    { who: "AM", action: "captured", target: "Idea: keyboard shortcut to triage inbox", time: "08:50" },
  ]},
];
