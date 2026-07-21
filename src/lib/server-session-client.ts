import {
  authProviderClient,
  FIREBASE_ID_TOKEN_STORAGE_KEY,
} from "@/lib/auth-provider-client"

export type ServerSessionPayload = {
  user: { id: string; email: string; name: string | null }
  workspace: { id: string; slug: string; name: string }
  members?: Array<{ id: string; name: string; email: string; role: string }>
  authMode?: string
}

async function resolveAuthToken() {
  if (typeof window === "undefined") return null
  if (!authProviderClient) return null

  try {
    const token = await authProviderClient.getCurrentIdToken()
    if (token) {
      localStorage.setItem(FIREBASE_ID_TOKEN_STORAGE_KEY, token)
      return token
    }
  } catch {
    localStorage.removeItem(FIREBASE_ID_TOKEN_STORAGE_KEY)
    return null
  }

  return localStorage.getItem(FIREBASE_ID_TOKEN_STORAGE_KEY)
}

export async function getServerSession(): Promise<ServerSessionPayload> {
  const headers: Record<string, string> = {}
  const token = await resolveAuthToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    headers,
  })

  if (response.status === 401 && typeof window !== "undefined") {
    const next = `${window.location.pathname}${window.location.search}`
    window.location.assign(`/login?next=${encodeURIComponent(next)}`)
    throw new Error("Authentication required")
  }

  if (!response.ok) {
    let details = ""
    try {
      const payload = (await response.json()) as { error?: string }
      details = payload.error ? `: ${payload.error}` : ""
    } catch {
      details = ""
    }
    throw new Error(`Failed to bootstrap session${details}`)
  }
  return (await response.json()) as ServerSessionPayload
}
