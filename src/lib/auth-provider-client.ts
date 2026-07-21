export const FIREBASE_ID_TOKEN_STORAGE_KEY = "flowboard-firebase-id-token"

export interface AuthProviderUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  providerData: Array<{ providerId: string }>
  getIdToken(): Promise<string>
}

export interface AuthProviderClient {
  onIdTokenChanged(callback: (user: AuthProviderUser | null) => void): () => void
  signInWithGoogle(): Promise<AuthProviderUser>
  signOut(): Promise<void>
  getCurrentIdToken(): Promise<string | null>
}

// ponytail: The public default is a null adapter; explicit Firebase builds replace this module.
export const authProviderClient: AuthProviderClient | null = null
