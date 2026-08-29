import { describe, expect, it } from 'vitest'
import { selectCommandPaletteResults, selectRecentCommandItems } from '@/lib/command-palette-results'

const tasks = Array.from({ length: 50 }, (_, index) => ({
  id: `task-${index}`,
  title: index === 49 ? 'Exact launch plan' : `Task ${index}`,
  status: 'planned',
  parentId: null,
}))

const projects = Array.from({ length: 20 }, (_, index) => ({ id: `project-${index}`, name: `Project ${index}` }))
const notes = Array.from({ length: 20 }, (_, index) => ({ id: `note-${index}`, title: `Note ${index}` }))

describe('command palette result selection', () => {
  it('keeps the rendered result set bounded when no query is entered', () => {
    const result = selectCommandPaletteResults({ query: '', tasks, projects, notes })

    expect(result.tasks).toHaveLength(16)
    expect(result.projects).toHaveLength(10)
    expect(result.notes).toHaveLength(10)
  })

  it('searches the complete collections and prioritizes exact titles', () => {
    const result = selectCommandPaletteResults({ query: 'Exact launch plan', tasks, projects, notes })

    expect(result.tasks.map((task) => task.id)).toEqual(['task-49'])
  })

  it('searches tasks by the type-prefixed value rendered by the command item', () => {
    const result = selectCommandPaletteResults({ query: 'task Exact launch plan', tasks, projects, notes })

    expect(result.tasks.map((task) => task.id)).toEqual(['task-49'])
  })

  it('searches projects by the type-prefixed value rendered by the command item', () => {
    const result = selectCommandPaletteResults({ query: 'project Project 19', tasks, projects, notes })

    expect(result.projects.map((project) => project.id)).toEqual(['project-19'])
  })

  it('searches notes by the type-prefixed value rendered by the command item', () => {
    const result = selectCommandPaletteResults({ query: 'note Note 19', tasks, projects, notes })

    expect(result.notes.map((note) => note.id)).toEqual(['note-19'])
  })

  it('deduplicates and caps recent entries', () => {
    const recent = selectRecentCommandItems([
      { kind: 'task', id: 'one' },
      { kind: 'task', id: 'one' },
      { kind: 'project', id: 'one' },
      { kind: 'note', id: 'two' },
    ], 2)

    expect(recent).toEqual([
      { kind: 'task', id: 'one' },
      { kind: 'project', id: 'one' },
    ])
  })
})
