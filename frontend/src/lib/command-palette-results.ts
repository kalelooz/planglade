type SearchTask = {
  id: string
  title: string
  status: string
  parentId: string | null
}

type SearchProject = {
  id: string
  name: string
}

type SearchNote = {
  id: string
  title: string
}

type SearchInput = {
  query: string
  tasks: SearchTask[]
  projects: SearchProject[]
  notes: SearchNote[]
}

const TASK_LIMIT = 16
const PROJECT_LIMIT = 10
const NOTE_LIMIT = 10

function normalized(value: string) {
  return value.trim().toLowerCase()
}

export function commandPaletteItemValue(kind: 'task' | 'project' | 'note', label: string) {
  return `${kind} ${label}`
}

function ranked<T>(items: T[], query: string, label: (item: T) => string, limit: number) {
  const needle = normalized(query)
  if (!needle) return items.slice(0, limit)

  return items
    .map((item, index) => {
      const value = normalized(label(item))
      const score = value === needle ? 0 : value.startsWith(needle) ? 1 : value.includes(needle) ? 2 : 3
      return { item, index, score }
    })
    .filter((candidate) => candidate.score < 3)
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .slice(0, limit)
    .map((candidate) => candidate.item)
}

export function selectCommandPaletteResults({ query, tasks, projects, notes }: SearchInput) {
  return {
    tasks: ranked(
      tasks.filter((task) => task.status !== 'done' && !task.parentId),
      query,
      (task) => commandPaletteItemValue('task', task.title),
      TASK_LIMIT,
    ),
    projects: ranked(projects, query, (project) => commandPaletteItemValue('project', project.name), PROJECT_LIMIT),
    notes: ranked(notes, query, (note) => commandPaletteItemValue('note', note.title), NOTE_LIMIT),
  }
}

export function selectRecentCommandItems<T extends { kind: string; id: string }>(items: T[], limit = 10) {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = `${item.kind}:${item.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, limit)
}
