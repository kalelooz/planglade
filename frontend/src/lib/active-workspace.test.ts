import { describe, expect, it, vi } from 'vitest'

import { ACTIVE_WORKSPACE_KEY, rememberActiveWorkspace } from '@/lib/active-workspace'

describe('rememberActiveWorkspace', () => {
  it('persists the server-returned invitation workspace as the next active workspace', () => {
    const setItem = vi.fn()

    rememberActiveWorkspace({ setItem }, 'accepted-workspace')

    expect(setItem).toHaveBeenCalledWith(ACTIVE_WORKSPACE_KEY, 'accepted-workspace')
  })
})
