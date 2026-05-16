// ---------------------------------------------------------------------------
// Shared Mock Data for Universal Detail Drawer
// ---------------------------------------------------------------------------
// This file consolidates entity data used across FlowBoard views so the
// drawer panels can look up any entity by type + id without prop drilling.
// ---------------------------------------------------------------------------

// ── Types ──────────────────────────────────────────────────────────────────

export type Priority = "High" | "Medium" | "Low"
export type TaskStatus = "Backlog" | "In Progress" | "In Review" | "Done"
export type ProjectStatus = "Active" | "On Hold" | "Completed"

export interface Tag {
  label: string
  color: string
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface DrawerTask {
  id: string
  title: string
  priority: Priority
  status: TaskStatus
  assignee: string   // initials
  assigneeName: string
  dueDate: string
  tags: Tag[]
  projectId: string
  projectName: string
  projectColor: string
  description: string
  linkedNoteIds: string[]
  subtasks: Subtask[]
  blockedBy: string[]  // task IDs this task is blocked by
}

export interface DrawerProject {
  id: string
  name: string
  color: string
  status: ProjectStatus
  progress: number
  owner: string
  ownerName: string
  startDate: string
  endDate: string
  taskIds: string[]
}

export interface NoteTag {
  label: string
  color: string
  accent: string
}

export interface DrawerNote {
  id: string
  title: string
  date: string
  tag: NoteTag
  excerpt: string
  body: string
  tags: NoteTag[]
  linkedNoteIds: string[]
  linkedTaskIds: string[]
}

export interface DrawerMember {
  initials: string
  name: string
  role: string
  color: string
  taskIds: string[]
}

// ── Tags ───────────────────────────────────────────────────────────────────

export const tagDesign: Tag = { label: "Design", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400" }
export const tagFrontend: Tag = { label: "Frontend", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" }
export const tagBackend: Tag = { label: "Backend", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" }
export const tagContent: Tag = { label: "Content", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" }
export const tagResearch: Tag = { label: "Research", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400" }
export const tagQA: Tag = { label: "QA", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" }

// ── Team Members ───────────────────────────────────────────────────────────

export const members: DrawerMember[] = [
  { initials: "AM", name: "Alex Morgan", role: "Product Manager", color: "#01696f", taskIds: ["T2", "T8", "T12", "M5", "A5", "A6", "R8"] },
  { initials: "SK", name: "Sara Kim", role: "Frontend Engineer", color: "#8b5cf6", taskIds: ["T4", "T7", "M1", "M2", "M8", "R3", "R6", "D3", "D6"] },
  { initials: "JD", name: "Jake Davis", role: "Backend Engineer", color: "#f59e0b", taskIds: ["T6", "T10", "A1", "A2", "A3", "A5", "A8", "M3", "M4", "M7", "R2", "R5", "R9"] },
  { initials: "LP", name: "Lisa Park", role: "Designer", color: "#ec4899", taskIds: ["T1", "T5", "T11", "D1", "D2", "D4", "D5", "M8", "M9"] },
  { initials: "RC", name: "Raj Chen", role: "Data Engineer", color: "#10b981", taskIds: ["T3", "T9", "T13", "R1", "R4", "R7", "A4", "A7", "M6"] },
]

// ── Tasks ──────────────────────────────────────────────────────────────────

export const tasks: DrawerTask[] = [
  // Website Redesign — T1–T13
  { id: "T1", title: "Define color palette & tokens", priority: "Medium", status: "Backlog", assignee: "LP", assigneeName: "Lisa Park", dueDate: "Jun 5", tags: [tagDesign], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Define the complete color palette and design tokens for the website redesign project. This includes primary, secondary, and accent colors, as well as semantic tokens for success, warning, and error states.", linkedNoteIds: ["N3"], subtasks: [ { id: "T1-s1", title: "Research competitor palettes", completed: true }, { id: "T1-s2", title: "Define primary & secondary colors", completed: false }, { id: "T1-s3", title: "Create semantic token map", completed: false } ], blockedBy: [] },
  { id: "T2", title: "Write SEO metadata for all pages", priority: "Low", status: "Backlog", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "Jun 10", tags: [tagContent], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Create comprehensive SEO metadata for every page of the website, including title tags, meta descriptions, Open Graph tags, and structured data markup.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "T3", title: "Research analytics integration", priority: "Low", status: "Backlog", assignee: "RC", assigneeName: "Raj Chen", dueDate: "Jun 12", tags: [tagResearch], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Evaluate analytics solutions (GA4, Mixpanel, Amplitude) and recommend the best fit for our tracking requirements and budget.", linkedNoteIds: ["N4"], subtasks: [], blockedBy: [] },
  { id: "T4", title: "Build responsive navigation", priority: "High", status: "In Progress", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 20", tags: [tagFrontend], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Implement a fully responsive navigation component that works seamlessly across desktop, tablet, and mobile viewports. Includes hamburger menu, dropdown menus, and keyboard accessibility.", linkedNoteIds: ["N3"], subtasks: [ { id: "T4-s1", title: "Desktop navigation layout", completed: true }, { id: "T4-s2", title: "Mobile hamburger menu", completed: true }, { id: "T4-s3", title: "Dropdown menus", completed: false }, { id: "T4-s4", title: "Keyboard navigation", completed: false } ], blockedBy: ["T1"] },
  { id: "T5", title: "Design contact page layout", priority: "Medium", status: "In Progress", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 22", tags: [tagDesign, tagFrontend], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Design and implement the contact page layout with a form, map embed, and office information section.", linkedNoteIds: [], subtasks: [], blockedBy: ["T4"] },
  { id: "T6", title: "Implement auth API endpoints", priority: "High", status: "In Progress", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 19", tags: [tagBackend], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Build the authentication API endpoints including login, logout, token refresh, and password reset. Follow JWT-based authentication with secure cookie storage.", linkedNoteIds: ["N5"], subtasks: [ { id: "T6-s1", title: "Login endpoint", completed: true }, { id: "T6-s2", title: "Token refresh endpoint", completed: true }, { id: "T6-s3", title: "Password reset flow", completed: false } ], blockedBy: ["T10"] },
  { id: "T7", title: "Hero section with animations", priority: "High", status: "In Review", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 18", tags: [tagFrontend, tagDesign], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Create the hero section with smooth scroll-triggered animations, parallax effects, and responsive image loading. Must meet Core Web Vitals performance targets.", linkedNoteIds: ["N1"], subtasks: [ { id: "T7-s1", title: "Static hero layout", completed: true }, { id: "T7-s2", title: "Scroll-triggered animations", completed: true }, { id: "T7-s3", title: "Responsive image loading", completed: true } ], blockedBy: [] },
  { id: "T8", title: "Footer component & links", priority: "Low", status: "In Review", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 21", tags: [tagFrontend], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Build the footer component with navigation links, social media icons, and newsletter signup form.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "T9", title: "Accessibility audit pass 1", priority: "Medium", status: "In Review", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 23", tags: [tagQA], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Conduct an accessibility audit covering WCAG 2.1 AA compliance. Check color contrast, keyboard navigation, screen reader compatibility, and ARIA attributes.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "T10", title: "Project scaffolding & CI/CD", priority: "High", status: "Done", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 10", tags: [tagFrontend, tagBackend], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Set up the project repository structure, configure CI/CD pipelines, and establish deployment workflows for staging and production environments.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "T11", title: "Wireframes for all key pages", priority: "Medium", status: "Done", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 8", tags: [tagDesign], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Create wireframes for all key pages including home, about, services, contact, and blog. Focus on layout hierarchy and content placement.", linkedNoteIds: ["N3"], subtasks: [], blockedBy: [] },
  { id: "T12", title: "Brand guidelines document", priority: "Low", status: "Done", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 5", tags: [tagDesign, tagContent], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Document the brand guidelines including logo usage, typography, color palette, iconography, and tone of voice.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "T13", title: "User interview synthesis", priority: "Medium", status: "Done", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 3", tags: [tagResearch], projectId: "P1", projectName: "Website Redesign", projectColor: "#01696f", description: "Synthesize findings from 8 moderated user interviews into actionable insights and recommendations for the redesign.", linkedNoteIds: ["N4"], subtasks: [], blockedBy: [] },

  // Mobile App v2 — M1–M9
  { id: "M1", title: "User auth flow design", priority: "High", status: "Done", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 5", tags: [tagDesign], projectId: "P2", projectName: "Mobile App v2", projectColor: "#8b5cf6", description: "Design the complete user authentication flow including sign-in, sign-up, password recovery, and two-factor authentication screens.", linkedNoteIds: ["N3"], subtasks: [], blockedBy: [] },
  { id: "M2", title: "Onboarding screen redesign", priority: "High", status: "In Progress", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 25", tags: [tagDesign, tagFrontend], projectId: "P2", projectName: "Mobile App v2", projectColor: "#8b5cf6", description: "Redesign the onboarding screens with a card-based carousel, progressive disclosure, and personalized welcome experience.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "M3", title: "Push notification integration", priority: "Medium", status: "Backlog", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 1", tags: [tagBackend], projectId: "P2", projectName: "Mobile App v2", projectColor: "#8b5cf6", description: "Integrate push notification service (Firebase Cloud Messaging) with the mobile app, including opt-in flow and notification preferences.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "M4", title: "Offline mode support", priority: "High", status: "In Progress", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 28", tags: [tagBackend, tagFrontend], projectId: "P2", projectName: "Mobile App v2", projectColor: "#8b5cf6", description: "Implement offline mode with local data caching, conflict resolution, and background sync when connectivity is restored.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "M5", title: "App store listing copy", priority: "Low", status: "Backlog", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "Jun 10", tags: [tagContent], projectId: "P2", projectName: "Mobile App v2", projectColor: "#8b5cf6", description: "Write compelling app store listing copy including title, subtitle, description, keywords, and promotional text.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "M6", title: "Beta testing plan", priority: "Medium", status: "In Review", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 22", tags: [tagQA], projectId: "P2", projectName: "Mobile App v2", projectColor: "#8b5cf6", description: "Create a comprehensive beta testing plan including test scenarios, user recruitment, feedback collection, and triage process.", linkedNoteIds: ["N4"], subtasks: [], blockedBy: [] },
  { id: "M7", title: "Performance profiling", priority: "High", status: "Backlog", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 5", tags: [tagBackend], projectId: "P2", projectName: "Mobile App v2", projectColor: "#8b5cf6", description: "Profile app performance on various devices, identify bottlenecks, and optimize startup time, memory usage, and network requests.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "M8", title: "Dark mode polish", priority: "Low", status: "Done", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 12", tags: [tagDesign], projectId: "P2", projectName: "Mobile App v2", projectColor: "#8b5cf6", description: "Polish the dark mode implementation ensuring consistent contrast ratios, proper elevation hierarchy, and smooth theme transitions.", linkedNoteIds: ["N3"], subtasks: [], blockedBy: [] },
  { id: "M9", title: "Accessibility labels", priority: "Medium", status: "In Progress", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 30", tags: [tagQA, tagFrontend], projectId: "P2", projectName: "Mobile App v2", projectColor: "#8b5cf6", description: "Add accessibility labels and hints to all interactive elements, ensure VoiceOver/TalkBack compatibility, and test with assistive technologies.", linkedNoteIds: [], subtasks: [], blockedBy: [] },

  // API Migration — A1–A8
  { id: "A1", title: "JWT auth implementation", priority: "High", status: "Done", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Apr 15", tags: [tagBackend], projectId: "P3", projectName: "API Migration", projectColor: "#f59e0b", description: "Implement JWT-based authentication replacing the legacy session-based approach. Include token generation, validation, refresh, and revocation.", linkedNoteIds: ["N5"], subtasks: [], blockedBy: [] },
  { id: "A2", title: "Cursor-based pagination", priority: "High", status: "Done", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Apr 20", tags: [tagBackend], projectId: "P3", projectName: "API Migration", projectColor: "#f59e0b", description: "Replace offset-based pagination with cursor-based pagination for all list endpoints. Improves performance on large datasets.", linkedNoteIds: ["N5"], subtasks: [], blockedBy: [] },
  { id: "A3", title: "Rate limiting middleware", priority: "Medium", status: "In Review", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 18", tags: [tagBackend], projectId: "P3", projectName: "API Migration", projectColor: "#f59e0b", description: "Implement rate limiting middleware with configurable limits per endpoint, IP-based throttling, and proper 429 responses with retry-after headers.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "A4", title: "Deprecation headers", priority: "Low", status: "Backlog", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 25", tags: [tagBackend], projectId: "P3", projectName: "API Migration", projectColor: "#f59e0b", description: "Add deprecation headers to v2 endpoints indicating sunset date and migration guide URL.", linkedNoteIds: ["N5"], subtasks: [], blockedBy: [] },
  { id: "A5", title: "Migration guide documentation", priority: "High", status: "In Progress", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 22", tags: [tagContent], projectId: "P3", projectName: "API Migration", projectColor: "#f59e0b", description: "Write comprehensive migration guide covering all breaking changes, code examples, and step-by-step upgrade instructions for API consumers.", linkedNoteIds: ["N5"], subtasks: [], blockedBy: [] },
  { id: "A6", title: "Consumer notification emails", priority: "Medium", status: "Done", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 1", tags: [tagContent], projectId: "P3", projectName: "API Migration", projectColor: "#f59e0b", description: "Draft and send notification emails to all API consumers about the upcoming v3 migration timeline and required changes.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "A7", title: "Load testing v3 endpoints", priority: "Medium", status: "Done", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 10", tags: [tagQA, tagBackend], projectId: "P3", projectName: "API Migration", projectColor: "#f59e0b", description: "Run comprehensive load tests on all v3 endpoints, establish baseline performance metrics, and identify capacity limits.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "A8", title: "Rollback procedure", priority: "High", status: "Done", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Apr 25", tags: [tagBackend], projectId: "P3", projectName: "API Migration", projectColor: "#f59e0b", description: "Document and test the rollback procedure in case v3 deployment encounters critical issues. Include database migration rollback steps.", linkedNoteIds: [], subtasks: [], blockedBy: [] },

  // Design System — D1–D6
  { id: "D1", title: "Design tokens specification", priority: "High", status: "In Progress", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 20", tags: [tagDesign], projectId: "P4", projectName: "Design System", projectColor: "#ec4899", description: "Define the complete design tokens specification including colors, typography, spacing, shadows, and animation timing functions.", linkedNoteIds: ["N3"], subtasks: [], blockedBy: [] },
  { id: "D2", title: "Figma component library", priority: "High", status: "Backlog", assignee: "LP", assigneeName: "Lisa Park", dueDate: "Jun 1", tags: [tagDesign], projectId: "P4", projectName: "Design System", projectColor: "#ec4899", description: "Build a comprehensive Figma component library with auto-layout, variants, and documentation for each component.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "D3", title: "Code generation pipeline", priority: "Medium", status: "Backlog", assignee: "SK", assigneeName: "Sara Kim", dueDate: "Jun 15", tags: [tagFrontend], projectId: "P4", projectName: "Design System", projectColor: "#ec4899", description: "Set up a code generation pipeline that converts Figma components to React code with proper TypeScript types and Tailwind classes.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "D4", title: "Color system documentation", priority: "Medium", status: "In Review", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 18", tags: [tagDesign, tagContent], projectId: "P4", projectName: "Design System", projectColor: "#ec4899", description: "Document the color system with usage guidelines, accessibility requirements, and examples for light and dark modes.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "D5", title: "Typography scale", priority: "Low", status: "Done", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 8", tags: [tagDesign], projectId: "P4", projectName: "Design System", projectColor: "#ec4899", description: "Define the typography scale with font sizes, line heights, letter spacing, and font weights for headings and body text.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "D6", title: "Spacing & grid system", priority: "Low", status: "Backlog", assignee: "SK", assigneeName: "Sara Kim", dueDate: "Jun 10", tags: [tagDesign, tagFrontend], projectId: "P4", projectName: "Design System", projectColor: "#ec4899", description: "Define the spacing scale and grid system with consistent spacing values, breakpoints, and layout patterns.", linkedNoteIds: [], subtasks: [], blockedBy: [] },

  // Analytics Dashboard — R1–R9
  { id: "R1", title: "Chart widget library", priority: "High", status: "In Progress", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 25", tags: [tagFrontend], projectId: "P5", projectName: "Analytics Dashboard", projectColor: "#10b981", description: "Build a reusable chart widget library supporting bar, line, pie, and area charts with theming, animations, and responsive sizing.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "R2", title: "Data aggregation API", priority: "High", status: "In Progress", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 22", tags: [tagBackend], projectId: "P5", projectName: "Analytics Dashboard", projectColor: "#10b981", description: "Build the data aggregation API endpoints that power the dashboard charts, with support for time ranges, filters, and grouping.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "R3", title: "Dashboard layout system", priority: "Medium", status: "In Review", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 20", tags: [tagFrontend], projectId: "P5", projectName: "Analytics Dashboard", projectColor: "#10b981", description: "Implement the dashboard layout system with drag-and-drop widget placement, resizable panels, and configurable grid.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "R4", title: "Export to PDF feature", priority: "Medium", status: "Backlog", assignee: "RC", assigneeName: "Raj Chen", dueDate: "Jun 5", tags: [tagFrontend], projectId: "P5", projectName: "Analytics Dashboard", projectColor: "#10b981", description: "Add PDF export functionality to the dashboard, allowing users to generate shareable reports from their current view.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "R5", title: "Real-time data streaming", priority: "High", status: "Backlog", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 10", tags: [tagBackend], projectId: "P5", projectName: "Analytics Dashboard", projectColor: "#10b981", description: "Implement real-time data streaming using WebSockets for live dashboard updates without page refresh.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "R6", title: "Filter & drill-down UI", priority: "Medium", status: "Backlog", assignee: "SK", assigneeName: "Sara Kim", dueDate: "Jun 8", tags: [tagFrontend], projectId: "P5", projectName: "Analytics Dashboard", projectColor: "#10b981", description: "Build the filter and drill-down UI components allowing users to slice data by date range, category, and custom dimensions.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "R7", title: "KPI card components", priority: "Low", status: "Done", assignee: "RC", assigneeName: "Raj Chen", dueDate: "May 10", tags: [tagFrontend], projectId: "P5", projectName: "Analytics Dashboard", projectColor: "#10b981", description: "Create reusable KPI card components with trend indicators, sparklines, and color-coded status.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "R8", title: "User preference storage", priority: "Low", status: "Done", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "May 5", tags: [tagFrontend], projectId: "P5", projectName: "Analytics Dashboard", projectColor: "#10b981", description: "Implement user preference storage for dashboard layout, default filters, and widget configurations.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
  { id: "R9", title: "Embeddable widget SDK", priority: "Low", status: "Backlog", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Jun 20", tags: [tagBackend, tagFrontend], projectId: "P5", projectName: "Analytics Dashboard", projectColor: "#10b981", description: "Build an embeddable widget SDK allowing external applications to embed FlowBoard analytics charts.", linkedNoteIds: [], subtasks: [], blockedBy: [] },
]

// ── Projects ───────────────────────────────────────────────────────────────

export const projects: DrawerProject[] = [
  { id: "P1", name: "Website Redesign", color: "#01696f", status: "Active", progress: 72, owner: "AM", ownerName: "Alex Morgan", startDate: "Apr 1, 2026", endDate: "May 28, 2026", taskIds: ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12", "T13"] },
  { id: "P2", name: "Mobile App v2", color: "#8b5cf6", status: "Active", progress: 45, owner: "SK", ownerName: "Sara Kim", startDate: "Apr 15, 2026", endDate: "Jun 15, 2026", taskIds: ["M1", "M2", "M3", "M4", "M5", "M6", "M7", "M8", "M9"] },
  { id: "P3", name: "API Migration", color: "#f59e0b", status: "Completed", progress: 90, owner: "JD", ownerName: "Jake Davis", startDate: "Mar 10, 2026", endDate: "May 20, 2026", taskIds: ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A8"] },
  { id: "P4", name: "Design System", color: "#ec4899", status: "On Hold", progress: 30, owner: "LP", ownerName: "Lisa Park", startDate: "May 1, 2026", endDate: "Jul 1, 2026", taskIds: ["D1", "D2", "D3", "D4", "D5", "D6"] },
  { id: "P5", name: "Analytics Dashboard", color: "#10b981", status: "Active", progress: 58, owner: "RC", ownerName: "Raj Chen", startDate: "Apr 20, 2026", endDate: "Jun 22, 2026", taskIds: ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9"] },
]

// ── Notes ──────────────────────────────────────────────────────────────────

export const noteTagProduct: NoteTag = { label: "Product", color: "bg-primary/10 text-primary", accent: "border-l-primary border-t-primary" }
export const noteTagDesign: NoteTag = { label: "Design", color: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400", accent: "border-l-pink-500 dark:border-l-pink-400 border-t-pink-500 dark:border-t-pink-400" }
export const noteTagEngineering: NoteTag = { label: "Engineering", color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400", accent: "border-l-sky-500 dark:border-l-sky-400 border-t-sky-500 dark:border-t-sky-400" }
export const noteTagMeeting: NoteTag = { label: "Meeting", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", accent: "border-l-amber-500 dark:border-l-amber-400 border-t-amber-500 dark:border-t-amber-400" }
export const noteTagResearch: NoteTag = { label: "Research", color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400", accent: "border-l-violet-500 dark:border-l-violet-400 border-t-violet-500 dark:border-t-violet-400" }

export const notes: DrawerNote[] = [
  {
    id: "N1", title: "Q3 Product Roadmap", date: "May 14, 2026", tag: noteTagProduct,
    excerpt: "Key priorities and milestones for the upcoming quarter...",
    body: `## Q3 Product Roadmap\n\n### Overview\n\nThe Q3 roadmap focuses on **three strategic pillars**: user growth, platform stability, and new revenue streams.\n\n### Key Priorities\n\n- **Launch mobile app v2** — Target release by end of July\n- **API v3 migration** — Deprecate legacy endpoints by August\n- **Design system 2.0** — Publish token-based system\n- **Analytics dashboard** — Self-serve insights for team leads\n\n### Milestones\n\n| Milestone | Target Date | Owner |\n|-----------|-------------|-------|\n| Mobile beta | Jul 15 | Sara Kim |\n| API cutover | Aug 1 | Jake Davis |\n| DS 2.0 alpha | Aug 20 | Lisa Park |\n| Analytics GA | Sep 10 | Raj Chen |`,
    tags: [noteTagProduct, noteTagEngineering], linkedNoteIds: ["N2", "N3", "N5"], linkedTaskIds: ["T11", "A5"],
  },
  {
    id: "N2", title: "Team Meeting Notes \u2014 May 12", date: "May 12, 2026", tag: noteTagMeeting,
    excerpt: "Sprint review and Q3 planning discussion...",
    body: `## Team Meeting \u2014 May 12\n\n### Attendees\nAlex, Sara, Jake, Lisa, Raj\n\n### Sprint Review\n- **Completed**: Auth flow, footer component, CI pipeline setup\n- **In progress**: Responsive nav, contact page, API rate limiting\n- **Blocked**: Design tokens \u2014 waiting on brand team approval\n\n### Q3 Planning\n- Discussed roadmap priorities\n- Agreed on pod structure: Mobile pod + Platform pod\n- Next sync: May 19`,
    tags: [noteTagMeeting, noteTagProduct], linkedNoteIds: ["N1"], linkedTaskIds: ["T4"],
  },
  {
    id: "N3", title: "Design Brief \u2014 Mobile v2", date: "May 10, 2026", tag: noteTagDesign,
    excerpt: "Visual direction and component inventory...",
    body: `## Design Brief \u2014 Mobile App v2\n\n### Visual Direction\nThe new design language emphasizes **clarity** and **speed**.\n\n- Simplified navigation with bottom tab bar\n- Card-based content layout for scanability\n- Dark mode as a first-class citizen\n\n### Component Inventory\nWe identified **24 components** that need redesign.\n\n### Color Palette\n- Primary: Teal (#01696f)\n- Neutral: Warm grays with teal undertone\n- Accent: Amber for warnings, emerald for success`,
    tags: [noteTagDesign, noteTagProduct], linkedNoteIds: ["N1", "N4"], linkedTaskIds: ["M1", "D1"],
  },
  {
    id: "N4", title: "User Research Findings", date: "May 7, 2026", tag: noteTagResearch,
    excerpt: "Key insights from usability testing sessions...",
    body: `## User Research Findings\n\n### Methodology\nConducted **8 moderated usability sessions** with existing customers.\n\n### Key Insights\n1. **Navigation confusion**: 6/8 participants struggled to find projects\n2. **Task overload**: Users want priority-based filtering\n3. **Mobile gap**: 75% of users check tasks on mobile daily\n4. **Reporting friction**: Manual exports are the #1 pain point\n\n### Recommendations\n- Simplify IA with fewer sidebar categories\n- Add smart filters and saved views\n- Prioritize mobile responsive features\n- Build self-serve analytics dashboard`,
    tags: [noteTagResearch, noteTagProduct], linkedNoteIds: ["N3"], linkedTaskIds: ["T3"],
  },
  {
    id: "N5", title: "API Deprecation Plan", date: "May 5, 2026", tag: noteTagEngineering,
    excerpt: "Timeline and consumer communication strategy...",
    body: `## API Deprecation Plan\n\n### Timeline\n- **Jun 1**: Announce v3 availability and v2 deprecation schedule\n- **Jul 1**: v3 reaches feature parity with v2\n- **Aug 1**: v2 endpoints return deprecation headers\n- **Sep 15**: v2 endpoints removed\n\n### Breaking Changes\n- Auth flow moves from session-based to JWT\n- Pagination changes from offset to cursor-based\n- Response envelope structure updated\n\n### Migration Guide\nDraft in progress \u2014 target delivery by **Jun 1**.`,
    tags: [noteTagEngineering], linkedNoteIds: ["N1", "N2"], linkedTaskIds: ["A1", "A4"],
  },
]

// ── Mock Activity for drawer panels ────────────────────────────────────────

export interface DrawerActivity {
  id: string
  user: string
  userName: string
  action: string
  target: string
  timestamp: string
}

export const mockDrawerActivities: DrawerActivity[] = [
  { id: "da1", user: "SK", userName: "Sara Kim", action: "completed", target: "Hero section with animations", timestamp: "2h ago" },
  { id: "da2", user: "JD", userName: "Jake Davis", action: "commented", target: "Auth API implementation", timestamp: "3h ago" },
  { id: "da3", user: "LP", userName: "Lisa Park", action: "created", target: "Design tokens spec", timestamp: "5h ago" },
  { id: "da4", user: "AM", userName: "Alex Morgan", action: "moved", target: "Sprint planning to Done", timestamp: "6h ago" },
  { id: "da5", user: "RC", userName: "Raj Chen", action: "assigned", target: "Chart widget to self", timestamp: "8h ago" },
  { id: "da6", user: "SK", userName: "Sara Kim", action: "updated", target: "Navigation component", timestamp: "1d ago" },
  { id: "da7", user: "JD", userName: "Jake Davis", action: "completed", target: "JWT auth implementation", timestamp: "1d ago" },
  { id: "da8", user: "AM", userName: "Alex Morgan", action: "commented", target: "Footer component", timestamp: "1d ago" },
]

// ── Mock Comments for task activity timeline ───────────────────────────────

export interface DrawerComment {
  id: string
  user: string
  userName: string
  avatar: string
  text: string
  timestamp: string
}

export const getTaskComments = (taskId: string): DrawerComment[] => {
  // Return a few mock comments based on the task
  const task = tasks.find(t => t.id === taskId)
  if (!task) return []
  return [
    { id: `c1-${taskId}`, user: "AM", userName: "Alex Morgan", avatar: "AM", text: `Updated the scope for "${task.title}" — added edge case handling.`, timestamp: "2h ago" },
    { id: `c2-${taskId}`, user: task.assignee, userName: task.assigneeName, avatar: task.assignee, text: "Working on this now, should have a PR up by EOD.", timestamp: "4h ago" },
    { id: `c3-${taskId}`, user: "RC", userName: "Raj Chen", avatar: "RC", text: "Looks good so far. Can we add more test coverage?", timestamp: "1d ago" },
  ]
}

// ── Lookup helpers ─────────────────────────────────────────────────────────

export function getTask(id: string): DrawerTask | undefined {
  return tasks.find(t => t.id === id)
}

export function getProject(id: string): DrawerProject | undefined {
  return projects.find(p => p.id === id)
}

export function getNote(id: string): DrawerNote | undefined {
  return notes.find(n => n.id === id)
}

export function getMember(initials: string): DrawerMember | undefined {
  return members.find(m => m.initials === initials)
}

/** Get the initials for a name like "Alex Morgan" → "AM" */
export function getInitials(name: string): string {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
}

/** Find a member by full name */
export function getMemberByName(name: string): DrawerMember | undefined {
  return members.find(m => m.name === name)
}

// ── Priority / Status helpers ──────────────────────────────────────────────

export function priorityBadgeStyle(priority: Priority) {
  switch (priority) {
    case "High": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    case "Medium": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    case "Low": return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
  }
}

export function statusBadgeStyle(status: ProjectStatus) {
  switch (status) {
    case "Active": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
    case "On Hold": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800"
    case "Completed": return "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 border-teal-200 dark:border-teal-800"
  }
}

export function taskStatusColor(status: TaskStatus) {
  switch (status) {
    case "Backlog": return "#9ca3af"
    case "In Progress": return "#01696f"
    case "In Review": return "#f59e0b"
    case "Done": return "#10b981"
  }
}

export function taskStatusBadgeStyle(status: TaskStatus) {
  switch (status) {
    case "Backlog": return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    case "In Progress": return "bg-primary/10 text-primary"
    case "In Review": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    case "Done": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
  }
}
