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
  mode?: "STANDARD" | "SERVICE_DESK";
  description?: string;
  featureFlags?: Record<string, boolean>;
  due: string;
  owner: string;
  progress: number;
  accent: string;
  icon?: string;
};

export const projects: Project[] = [
  {
    id: "general",
    name: "Personal planning",
    status: "Active",
    due: "",
    owner: "AM",
    progress: 0,
    accent: "oklch(0.52 0.09 195)",
    icon: "Box",
    description: "Keep weekly goals and useful ideas in one place.",
  },
  {
    id: "launch-readiness",
    name: "PlanGlade Public Launch",
    status: "Active",
    due: "2026-07-15",
    owner: "AM",
    progress: 33,
    accent: "oklch(0.52 0.09 195)",
    icon: "ListChecks",
    description: "Prepare the public README, release notes, and self-hosting checklist.",
  },
];

export type ChecklistItem = { id: string; text: string; done: boolean };
export type DependencyLink = { relationId: string; taskId: string; direction: "blockedBy" | "blocking" };

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
  parentId?: string;
  checklist?: ChecklistItem[];
  noteIds?: string[];
  blockerIds?: string[];
  blockingIds?: string[];
  dependencyLinks?: DependencyLink[];
  description?: string;
};

export const workItems: WorkItem[] = [
  {
    id: "launch-readiness-review-alignment",
    title: "Review README setup flow and project context",
    status: "In Progress",
    priority: "Medium",
    assignee: "AM",
    label: "Task",
    start: "2026-06-29",
    due: "2026-06-29",
    project: "launch-readiness",
    description: "Review the setup path and make sure the public project context is clear.",
  },
  {
    id: "launch-readiness-calendar-check",
    title: "Validate Docker quickstart and calendar dates",
    status: "To Do",
    priority: "Medium",
    assignee: "SK",
    label: "Review",
    start: "2026-07-01",
    due: "2026-07-03",
    project: "launch-readiness",
    description: "Check the documented quickstart and keep the dated demo work believable.",
  },
  {
    id: "launch-readiness-archive-completed",
    title: "Update backup and restore notes clearly",
    status: "Done",
    priority: "Low",
    assignee: "JD",
    label: "Done",
    start: "2026-06-24",
    due: "2026-06-26",
    project: "launch-readiness",
    description: "Completed documentation cleanup for the self-hosting guide.",
  },
  {
    id: "personal-plan-week",
    title: "Plan the week ahead",
    status: "Backlog",
    priority: "Medium",
    assignee: "AM",
    label: "Planning",
    start: "2026-06-29",
    due: "2026-07-01",
    project: "general",
    description: "Choose the three outcomes that matter most this week.",
  },
  {
    id: "personal-collect-references",
    title: "Collect reference images",
    status: "To Do",
    priority: "Low",
    assignee: "SK",
    label: "Research",
    start: "2026-06-30",
    due: "2026-07-02",
    project: "general",
    description: "Gather a small set of visual references for the next project review.",
  },
];

export const inboxItems: Array<{ id: string; title: string; captured: string }> = [];

export const notes: Array<{ id: string; title: string; tag: string; updated: string; excerpt: string }> = [];

export type ActivityItem = { who: string; action: string; target: string; to?: string; time: string };

export const activity: { date: string; items: ActivityItem[] }[] = [];
