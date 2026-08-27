import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function source(path: string) {
  return readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
}

describe('workspace invitation consent', () => {
  it('never accepts an invitation from the login page', () => {
    const login = source('../src/pages/AuthLogin.tsx')
    expect(login).not.toContain('/api/workspace/invitations/accept')
    expect(login).not.toContain('autoAccept')
    expect(login).toContain('/invite/review?inviteToken=')
  })

  it('keeps acceptance and member removal behind explicit controls', () => {
    const review = source('../src/pages/InvitationReview.tsx')
    const team = source('../src/components/TeamSettings.tsx')
    expect(review).toContain('Opening an invitation never grants access')
    expect(review).toContain('Accept invitation')
    expect(team).toContain('Keep member')
    expect(team).toContain('Remove member')
  })
})
