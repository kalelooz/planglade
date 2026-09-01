export const ENGAGEMENT_PROMPT_DISMISS_MS = 30 * 24 * 60 * 60 * 1000

export function resolveEngagementPrompt(input: { eligible: boolean; nextAt: number | null; now: number }) {
  if (!input.eligible) return { show: false, nextAt: input.nextAt }
  if (input.nextAt === null) return { show: true, nextAt: input.now }
  return { show: input.nextAt <= input.now, nextAt: input.nextAt }
}
