"use client"

import * as React from "react"

// ---------------------------------------------------------------------------
// Types — mirrors Firebase Auth's User interface for easy future swap
// ---------------------------------------------------------------------------

export interface AuthUser {
  /** Unique user ID — maps to Firebase Auth's `uid` */
  uid: string
  /** Display name from OAuth provider */
  displayName: string | null
  /** Email from OAuth provider */
  email: string | null
  /** Profile photo URL from OAuth provider */
  photoURL: string | null
  /** Which provider signed in (e.g. "google.com") */
  providerId: string
}

export interface AuthContextValue {
  /** Current authenticated user, or null if signed out */
  user: AuthUser | null
  /** True while checking initial auth state (e.g. session restore) */
  loading: boolean
  /** Sign in with Google OAuth (mock — simulates popup flow) */
  signInWithGoogle: () => Promise<void>
  /** Sign out and clear session */
  signOut: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Mock Google OAuth — simulates a popup sign-in flow
// ---------------------------------------------------------------------------

const MOCK_GOOGLE_USER: AuthUser = {
  uid: "mock-google-uid-001",
  displayName: "Alex Morgan",
  email: "alex.morgan@flowboard.dev",
  photoURL: null,
  providerId: "google.com",
}

const SESSION_KEY = "flowboard-auth-session"

function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

function storeUser(user: AuthUser | null) {
  if (typeof window === "undefined") return
  if (user) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(user))
  } else {
    sessionStorage.removeItem(SESSION_KEY)
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Restore session on mount
  React.useEffect(() => {
    const stored = getStoredUser()
    if (stored) {
      setUser(stored)
    }
    setLoading(false)
  }, [])

  const signInWithGoogle = React.useCallback(async () => {
    // Simulate a brief loading state like a real OAuth popup
    setLoading(true)

    // Mock delay to simulate network round-trip
    await new Promise((resolve) => setTimeout(resolve, 800))

    // In production, replace this block with:
    //   const provider = new GoogleAuthProvider()
    //   const result = await signInWithPopup(auth, provider)
    //   const user = result.user
    const mockUser = { ...MOCK_GOOGLE_USER }

    setUser(mockUser)
    storeUser(mockUser)
    setLoading(false)
  }, [])

  const signOut = React.useCallback(async () => {
    setLoading(true)
    // Brief delay to simulate async sign-out
    await new Promise((resolve) => setTimeout(resolve, 300))

    // In production, replace with:
    //   await firebaseSignOut(auth)
    setUser(null)
    storeUser(null)
    setLoading(false)
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, loading, signInWithGoogle, signOut }),
    [user, loading, signInWithGoogle, signOut]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return ctx
}
