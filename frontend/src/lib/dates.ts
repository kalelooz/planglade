import {
  addDays,
  differenceInCalendarDays,
  format,
  isToday as dfIsToday,
  isTomorrow,
  isYesterday,
  parseISO,
  startOfDay,
} from 'date-fns'

export const toISODate = (d: Date): string => format(d, 'yyyy-MM-dd')

export const daysFromToday = (n: number): string => toISODate(addDays(startOfDay(new Date()), n))

export const parseDate = (iso: string): Date => parseISO(iso)

export function relativeLabel(iso: string, weekStartsOn: 0 | 1 = 1): string {
  const d = parseDate(iso)
  if (dfIsToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  if (isYesterday(d)) return 'Yesterday'
  const diff = differenceInCalendarDays(d, startOfDay(new Date()))
  if (diff > 1 && diff < 7) return format(d, 'EEEE')
  if (diff < -1 && diff > -7) return `${-diff} days ago`
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return format(d, sameYear ? 'EEE, MMM d' : 'EEE, MMM d, yyyy')
  void weekStartsOn
}

export function dueTone(iso: string | null, done: boolean): 'overdue' | 'today' | 'soon' | 'future' | 'none' {
  if (!iso) return 'none'
  if (done) return 'none'
  const diff = differenceInCalendarDays(parseDate(iso), startOfDay(new Date()))
  if (diff < 0) return 'overdue'
  if (diff === 0) return 'today'
  if (diff <= 2) return 'soon'
  return 'future'
}

export function isOverdue(iso: string | null, done: boolean): boolean {
  return dueTone(iso, done) === 'overdue'
}

export function isDueToday(iso: string | null): boolean {
  if (!iso) return false
  return differenceInCalendarDays(parseDate(iso), startOfDay(new Date())) === 0
}

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return format(new Date(ts), 'MMM d')
}

export function greeting(): string {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 21) return 'Good evening'
  return 'Winding down'
}

export function friendlyToday(): string {
  return format(new Date(), 'EEEE, MMMM d')
}

/** Very small natural-input parser for quick capture. Frontend-only convenience. */
export interface ParsedCapture {
  text: string
  dueDate: string | null
  priority: 'none' | 'low' | 'medium' | 'high'
  projectName: string | null
  inferred: boolean
}

export function parseCaptureInput(raw: string, projectNames: string[]): ParsedCapture {
  let text = raw.trim()
  let dueDate: string | null = null
  let priority: ParsedCapture['priority'] = 'none'
  let projectName: string | null = null

  const today = startOfDay(new Date())

  const lower = text.toLowerCase()

  // priority
  const priMatch = lower.match(/\b(urgent|high priority|medium priority|low priority|p1|p2|p3)\b/)
  if (priMatch) {
    const m = priMatch[1]
    if (m === 'urgent' || m === 'high priority' || m === 'p1') priority = 'high'
    else if (m === 'medium priority' || m === 'p2') priority = 'medium'
    else priority = 'low'
    text = text.replace(new RegExp(priMatch[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '').trim()
  }

  // project via #tag
  const tagMatch = text.match(/#([\w-]+)/)
  if (tagMatch) {
    const slug = tagMatch[1].toLowerCase()
    const found = projectNames.find((n) => {
      const s = n.toLowerCase().replace(/[^a-z0-9]+/g, '')
      return s === slug.replace(/[^a-z0-9]+/g, '') || s.startsWith(slug.replace(/[^a-z0-9]+/g, ''))
    })
    if (found) {
      projectName = found
      text = text.replace(tagMatch[0], '').trim()
    }
  }

  // dates
  const datePatterns: Array<[RegExp, () => Date | null]> = [
    [/\bday after tomorrow\b/, () => addDays(today, 2)],
    [/\btomorrow\b/, () => addDays(today, 1)],
    [/\btonight\b/, () => today],
    [/\btoday\b/, () => today],
    [/\bnext week\b/, () => addDays(today, 7)],
    [/\bin (\d+) days?\b/, () => null], // handled below
  ]
  for (const [re, fn] of datePatterns) {
    const m = text.match(re)
    if (m) {
      if (re.source.includes('(\\d+)')) {
        const n = parseInt(m[1], 10)
        dueDate = toISODate(addDays(today, n))
      } else {
        const d = fn()
        if (d) dueDate = toISODate(d)
      }
      text = text.replace(re, '').trim()
      break
    }
  }
  if (!dueDate) {
    const nextDay = text.match(/\bnext (monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)
    const plainDay = text.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const m = nextDay || plainDay
    if (m) {
      const target = dayNames.indexOf(m[1].toLowerCase())
      const cur = today.getDay()
      let delta = (target - cur + 7) % 7
      if (nextDay) delta = delta === 0 ? 7 : delta + 7
      else if (delta === 0) delta = 7
      dueDate = toISODate(addDays(today, delta))
      text = text.replace(m[0], '').trim()
    }
  }

  text = text.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?])/g, '$1').trim()
  const inferred = !!(dueDate || priority !== 'none' || projectName)
  return { text: text || raw.trim(), dueDate, priority, projectName, inferred }
}
