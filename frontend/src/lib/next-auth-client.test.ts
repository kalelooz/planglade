import { describe, expect, it, vi } from 'vitest'
import { submitNextAuthSignIn, type AuthProvider } from './next-auth-client'

const credentials: AuthProvider = { id: 'credentials', name: 'Email and password', type: 'credentials' }

describe('NextAuth sign-in requests', () => {
  it('posts credentials with a fresh CSRF token and the requested destination', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'http://localhost/tasks' }), { status: 200 }))

    await expect(submitNextAuthSignIn(
      credentials,
      '/tasks',
      { email: 'owner@example.com', password: 'correct horse' },
      fetchImpl,
      'http://localhost',
    )).resolves.toBe('http://localhost/tasks')

    expect(fetchImpl).toHaveBeenNthCalledWith(1, '/api/auth/csrf', { credentials: 'include', cache: 'no-store' })
    expect(fetchImpl).toHaveBeenNthCalledWith(2, '/api/auth/callback/credentials', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: new URLSearchParams({
        email: 'owner@example.com',
        password: 'correct horse',
        csrfToken: 'csrf-token',
        callbackUrl: '/tasks',
        json: 'true',
      }),
    }))
  })

  it('does not navigate when NextAuth returns an error URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrfToken: 'csrf-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ url: 'http://localhost/auth/login?error=CredentialsSignin' }), { status: 200 }))

    await expect(submitNextAuthSignIn(credentials, '/', {}, fetchImpl, 'http://localhost')).resolves.toBeNull()
  })
})
