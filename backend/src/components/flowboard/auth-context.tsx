"use client"

import * as React from "react"
import {
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from "firebase/auth"
import { signIn as nextAuthSignIn, signOut as nextAuthSignOut } from "next-auth/react"

import {
  firebaseAuth,
  FIREBASE_ID_TOKEN_STORAGE_KEY,
  googleAuthProvider,
} from "@/lib/firebase-client"

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
  /** Active auth mode configured for the client */
  authMode: "dev" | "firebase" | "nextauth"
  /** Sign in with Google OAuth */
  signInWithGoogle: (nextPath?: string) => Promise<void>
  /** Sign out and clear session */
  signOut: (nextPath?: string) => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | null>(null)
const configuredAuthMode = (
  process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE?.toLowerCase() === "firebase"
    ? "firebase"
    : process.env.NEXT_PUBLIC_FLOWBOARD_AUTH_MODE?.toLowerCase() === "nextauth"
      ? "nextauth"
      : "dev"
) as AuthContextValue["authMode"]

function storeUser(user: AuthUser | null) {
  if (typeof window === "undefined") return
  if (user) {
    sessionStorage.setItem("flowboard-auth-session", JSON.stringify(user))
  } else {
    sessionStorage.removeItem("flowboard-auth-session")
  }
}

function storeIdToken(token: string | null) {
  if (typeof window === "undefined") return
  if (token) {
    localStorage.setItem(FIREBASE_ID_TOKEN_STORAGE_KEY, token)
  } else {
    localStorage.removeItem(FIREBASE_ID_TOKEN_STORAGE_KEY)
  }
}

function toAuthUser(user: FirebaseUser): AuthUser {
  const provider =
    user.providerData.find((entry) => entry.providerId === "google.com")?.providerId ??
    user.providerData[0]?.providerId ??
    "google.com"

  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
    providerId: provider,
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
    if (configuredAuthMode !== "firebase") {
      setUser(null)
      storeUser(null)
      storeIdToken(null)
      setLoading(false)
      return undefined
    }

    if (!firebaseAuth) {
      setUser(null)
      storeUser(null)
      storeIdToken(null)
      setLoading(false)
      return undefined
    }

    const unsubscribe = onIdTokenChanged(firebaseAuth, async (nextUser) => {
      if (!nextUser) {
        setUser(null)
        storeUser(null)
        storeIdToken(null)
        setLoading(false)
        return
      }

      const mappedUser = toAuthUser(nextUser)
      setUser(mappedUser)
      storeUser(mappedUser)

      try {
        // Keep local token storage aligned with Firebase token refresh/rotation.
        const token = await nextUser.getIdToken()
        storeIdToken(token)
      } catch {
        storeIdToken(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const signInWithGoogle = React.useCallback(async (nextPath?: string) => {
    if (configuredAuthMode === "nextauth") {
      await nextAuthSignIn("google", {
        callbackUrl: nextPath ?? "/",
      })
      return
    }

    if (!firebaseAuth) {
      throw new Error("Firebase Auth is not configured in this environment.")
    }

    setLoading(true)
    try {
      const result = await signInWithPopup(firebaseAuth, googleAuthProvider)
      const mappedUser = toAuthUser(result.user)
      setUser(mappedUser)
      storeUser(mappedUser)
      storeIdToken(await result.user.getIdToken())
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = React.useCallback(async (nextPath?: string) => {
    if (configuredAuthMode === "nextauth") {
      await nextAuthSignOut({
        callbackUrl: nextPath ?? "/login",
      })
      return
    }

    setLoading(true)
    try {
      if (firebaseAuth) await firebaseSignOut(firebaseAuth)
    } finally {
      setUser(null)
      storeUser(null)
      storeIdToken(null)
      setLoading(false)
    }
  }, [])

  const value = React.useMemo<AuthContextValue>(
    () => ({ user, loading, authMode: configuredAuthMode, signInWithGoogle, signOut }),
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
