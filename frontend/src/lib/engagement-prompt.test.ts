import { describe, expect, it } from 'vitest'
import { ENGAGEMENT_PROMPT_DISMISS_MS, resolveEngagementPrompt } from './engagement-prompt'

describe('engagement prompt', () => {
  it('waits for meaningful use and respects a 30-day dismissal', () => {
    expect(resolveEngagementPrompt({ eligible: false, nextAt: null, now: 100 }).show).toBe(false)
    expect(resolveEngagementPrompt({ eligible: true, nextAt: null, now: 100 })).toEqual({ show: true, nextAt: 100 })
    expect(resolveEngagementPrompt({ eligible: true, nextAt: 101, now: 100 }).show).toBe(false)
    expect(resolveEngagementPrompt({ eligible: true, nextAt: 99, now: 100 }).show).toBe(true)
    expect(ENGAGEMENT_PROMPT_DISMISS_MS).toBe(30 * 24 * 60 * 60 * 1000)
  })
})
