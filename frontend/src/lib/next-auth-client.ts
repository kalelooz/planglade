export type AuthProvider = { id: string; name: string; type: string }

type FetchLike = typeof fetch

async function getCsrfToken(fetchImpl: FetchLike) {
  const response = await fetchImpl('/api/auth/csrf', { credentials: 'include', cache: 'no-store' })
  const payload = await response.json().catch(() => null) as { csrfToken?: unknown } | null
  if (!response.ok || typeof payload?.csrfToken !== 'string') throw new Error('csrf')
  return payload.csrfToken
}

export async function submitNextAuthSignIn(
  provider: AuthProvider,
  callbackUrl: string,
  fields: Record<string, string> = {},
  fetchImpl: FetchLike = fetch,
  origin = window.location.origin,
) {
  const endpoint = provider.type === 'credentials' ? 'callback' : 'signin'
  const response = await fetchImpl(`/api/auth/${endpoint}/${encodeURIComponent(provider.id)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...fields, csrfToken: await getCsrfToken(fetchImpl), callbackUrl, json: 'true' }),
  })
  const payload = await response.json().catch(() => null) as { url?: unknown } | null
  const url = typeof payload?.url === 'string' ? payload.url : null
  const error = url ? new URL(url, origin).searchParams.get('error') : null
  if (!response.ok || error || !url) return null
  return url
}
