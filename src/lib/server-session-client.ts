import { firebaseAuth, FIREBASE_ID_TOKEN_STORAGE_KEY } from "@/lib/firebase-client"
import { getPublicConfiguredAuthMode } from "@/lib/auth-config"
import type { PriorityDisplayStyle } from "@/lib/appearance-defaults"

export type ServerSessionPayload = {
  user: { id: string; email: string; name: string | null }
  workspace: { id: string; slug: string; name: string; taskPriorityDisplayStyle?: PriorityDisplayStyle }
  members?: Array<{ id: string; name: string; email: string; role: string }>
  authMode?: string
}

async function resolveAuthToken() {
  if (typeof window === "undefined") return null

  if (firebaseAuth?.currentUser) {
    try {
      const token = await firebaseAuth.currentUser.getIdToken()
      localStorage.setItem(FIREBASE_ID_TOKEN_STORAGE_KEY, token)
      return token
    } catch {
      localStorage.removeItem(FIREBASE_ID_TOKEN_STORAGE_KEY)
      return null
    }
  }

  return localStorage.getItem(FIREBASE_ID_TOKEN_STORAGE_KEY)
}

export async function buildSessionAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}
  const token = await resolveAuthToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

let lastResolvedUserId: string | null = null

export async function buildApiAuthHeaders(initHeaders?: HeadersInit): Promise<Headers> {
  const headers = new Headers(initHeaders)
  const authHeaders = await buildSessionAuthHeaders()
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value)
  }
  if (
    getPublicConfiguredAuthMode() === "dev" &&
    lastResolvedUserId &&
    !headers.has("x-flowboard-user-id")
  ) {
    headers.set("x-flowboard-user-id", lastResolvedUserId)
  }
  return headers
}

export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: await buildApiAuthHeaders(init.headers),
  })
}

export async function getServerSession(): Promise<ServerSessionPayload> {
  const headers = await buildSessionAuthHeaders()

  const response = await fetch("/api/auth/session", {
    cache: "no-store",
    headers,
  })

  if (response.status === 401 && typeof window !== "undefined") {
    const next = `${window.location.pathname}${window.location.search}`
    window.location.assign(`/login?next=${encodeURIComponent(next)}`)
    throw new Error("Authentication required")
  }
  if (response.status === 409 && typeof window !== "undefined") {
    const next = `${window.location.pathname}${window.location.search}`
    window.location.assign(`/onboarding?next=${encodeURIComponent(next)}`)
    throw new Error("Onboarding required")
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
  const session = (await response.json()) as ServerSessionPayload
  lastResolvedUserId = session.user.id
  return session
}
