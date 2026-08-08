export const PROJECT_COLORS = [
  { name: 'Slate', value: '#64748b' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Cyan', value: '#0891b2' },
  { name: 'Green', value: '#16a34a' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Rose', value: '#e11d48' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Graphite', value: '#52525b' },
] as const

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0].value

export function editableProjectColor(value: string | null | undefined) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_PROJECT_COLOR
}
