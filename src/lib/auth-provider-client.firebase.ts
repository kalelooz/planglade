import {
  onIdTokenChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth"

import {
  firebaseAuth,
  googleAuthProvider,
} from "@/lib/firebase-client"
import {
  FIREBASE_ID_TOKEN_STORAGE_KEY,
  type AuthProviderClient,
} from "./auth-provider-client"

export { FIREBASE_ID_TOKEN_STORAGE_KEY }

const configuredFirebaseAuth = firebaseAuth

export const authProviderClient: AuthProviderClient | null = configuredFirebaseAuth
  ? {
      onIdTokenChanged(callback) {
        return onIdTokenChanged(configuredFirebaseAuth, callback)
      },
      async signInWithGoogle() {
        return (await signInWithPopup(configuredFirebaseAuth, googleAuthProvider)).user
      },
      signOut() {
        return firebaseSignOut(configuredFirebaseAuth)
      },
      async getCurrentIdToken() {
        return (await configuredFirebaseAuth.currentUser?.getIdToken()) ?? null
      },
    }
  : null
