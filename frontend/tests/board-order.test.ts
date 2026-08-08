import { describe, expect, it } from 'vitest'
import { getBoardDropPatch, placeBoardTask } from '@/lib/board-order'
import { STATUS_ORDER } from '@/types'

const tasks = [
  { id: 'a', status: 'planned', position: 1024 },
  { id: 'b', status: 'planned', position: 2048 },
  { id: 'c', status: 'planned', position: 3072 },
  { id: 'd', status: 'in_progress', position: 1024 },
  { id: 'e', status: 'in_review', position: 1024 },
]

describe('getBoardDropPatch', () => {
  it('uses the five persisted workflow columns', () => {
    expect(STATUS_ORDER).toEqual(['backlog', 'planned', 'in_progress', 'in_review', 'done'])
  })
  it('persists a same-column insertion between its new neighbours', () => {
    expect(getBoardDropPatch(tasks, 'a', 'planned', 1)).toEqual({ status: 'planned', beforeId: 'c' })
  })

  it('persists a cross-column insertion before the first task', () => {
    expect(getBoardDropPatch(tasks, 'b', 'in_progress', 0)).toEqual({ status: 'in_progress', beforeId: 'd' })
  })

  it('appends into an empty column with stable spacing', () => {
    expect(getBoardDropPatch(tasks, 'a', 'done', 0)).toEqual({ status: 'done', beforeId: null })
  })

  it('keeps In Review separate from In Progress', () => {
    expect(getBoardDropPatch(tasks, 'a', 'in_progress', 1)).toEqual({ status: 'in_progress', beforeId: null })
    expect(getBoardDropPatch(tasks, 'a', 'in_review', 0)).toEqual({ status: 'in_review', beforeId: 'e' })
  })

  it('matches the API oldest-first fallback when positions tie', () => {
    const tied = [
      { id: 'older', status: 'planned', position: 0, createdAt: 1 },
      { id: 'newer', status: 'planned', position: 0, createdAt: 2 },
      { id: 'moved', status: 'in_progress', position: 0, createdAt: 3 },
    ]
    expect(getBoardDropPatch(tied, 'moved', 'planned', 0)).toEqual({ status: 'planned', beforeId: 'older' })
  })

  it('places the task immediately while the server persists it', () => {
    expect(placeBoardTask(tasks, 'a', 'planned', 'c').filter((task) => task.status === 'planned').sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).map((task) => task.id)).toEqual(['b', 'a', 'c'])
  })
})
