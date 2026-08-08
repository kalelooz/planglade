import { z } from 'zod'
import { sendJson } from '@/lib/api/client'

const onboardingResponseSchema = z.object({
  workspace: z.object({
    id: z.string(),
    slug: z.string(),
    name: z.string(),
  }),
})

export function createWorkspace(name: string) {
  return sendJson('/api/workspace/onboarding', 'POST', { name }, onboardingResponseSchema)
}
