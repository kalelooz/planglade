import type { LucideIcon } from 'lucide-react'
import {
  BookOpen, Briefcase, CalendarDays, Code2, Folder, GraduationCap, HeartPulse,
  Home, Megaphone, Palette, Plane, Rocket, ShoppingBag, Target,
} from 'lucide-react'

export const PROJECT_ICONS = [
  { name: 'folder', label: 'Folder', icon: Folder },
  { name: 'rocket', label: 'Launch', icon: Rocket },
  { name: 'megaphone', label: 'Marketing', icon: Megaphone },
  { name: 'code', label: 'Software', icon: Code2 },
  { name: 'palette', label: 'Design', icon: Palette },
  { name: 'book-open', label: 'Writing', icon: BookOpen },
  { name: 'calendar', label: 'Event', icon: CalendarDays },
  { name: 'target', label: 'Goal', icon: Target },
  { name: 'briefcase', label: 'Work', icon: Briefcase },
  { name: 'shopping-bag', label: 'Shop', icon: ShoppingBag },
  { name: 'heart-pulse', label: 'Health', icon: HeartPulse },
  { name: 'graduation-cap', label: 'Learning', icon: GraduationCap },
  { name: 'home', label: 'Home', icon: Home },
  { name: 'plane', label: 'Travel', icon: Plane },
] as const satisfies ReadonlyArray<{ name: string; label: string; icon: LucideIcon }>

export type ProjectIconName = (typeof PROJECT_ICONS)[number]['name']
export const DEFAULT_PROJECT_ICON: ProjectIconName = 'folder'

const RULES: ReadonlyArray<[ProjectIconName, RegExp]> = [
  ['rocket', /\b(launch|release|startup|ship|mvp)\b/i],
  ['megaphone', /\b(marketing|campaign|brand|social|content)\b/i],
  ['code', /\b(app|software|code|website|web|api|platform|development)\b/i],
  ['palette', /\b(design|creative|art|visual|identity)\b/i],
  ['book-open', /\b(book|write|writing|docs|documentation|research)\b/i],
  ['calendar', /\b(event|conference|workshop|wedding|meetup)\b/i],
  ['target', /\b(goal|objective|okr|strategy|plan)\b/i],
  ['shopping-bag', /\b(shop|store|commerce|retail|product)\b/i],
  ['heart-pulse', /\b(health|fitness|wellness|medical)\b/i],
  ['graduation-cap', /\b(course|learn|school|education|study|training)\b/i],
  ['home', /\b(home|house|renovation|move)\b/i],
  ['plane', /\b(travel|trip|vacation|holiday)\b/i],
  ['briefcase', /\b(client|business|work|company|operations)\b/i],
]

export function inferProjectIcon(title: string): ProjectIconName {
  return RULES.find(([, pattern]) => pattern.test(title))?.[0] ?? DEFAULT_PROJECT_ICON
}

export function projectIcon(name: string | null | undefined) {
  return PROJECT_ICONS.find((item) => item.name === name) ?? PROJECT_ICONS[0]
}
