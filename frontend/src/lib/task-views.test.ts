import { describe, expect, it } from 'vitest'
import { taskPresentationFromQuery, taskPresentationToQuery, taskViewFromQuery } from '@/lib/task-views'

describe('taskViewFromQuery', () => {
  it('accepts supported views and sends removed or invalid views to List', () => {
    expect(['list', 'board', 'timeline'].map((view) => taskViewFromQuery(view))).toEqual(['list', 'board', 'timeline'])
    expect(['calendar', 'map', 'overview', 'canvas'].map((view) => taskViewFromQuery(view))).toEqual(['list', 'list', 'list', 'list'])
  })

  it('round-trips the shared presentation state through the URL', () => {
    const input = new URLSearchParams('view=timeline&q=launch&when=blocked,overdue&projects=p1,p2&priorities=high&completed=0&sort=priority&group=project&density=compact&fields=project,dueDate&saved=view-1')
    const presentation = taskPresentationFromQuery(input)
    expect(taskPresentationToQuery(presentation, 'view-1').toString()).toBe(input.toString())
  })

  it('drops invalid enum values and uses safe defaults', () => {
    const presentation = taskPresentationFromQuery(new URLSearchParams('view=grid&when=unknown,today&sort=random&density=tiny'))
    expect(presentation.view).toBe('list')
    expect(presentation.quick).toEqual(['today'])
    expect(presentation.sort).toBe('due')
    expect(presentation.density).toBe('comfortable')
  })
})
