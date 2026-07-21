import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getAuth } from "firebase-admin/auth"
import { getStorage } from "firebase-admin/storage"

function getFirebasePrivateKey() {
  const base64Key = process.env.FIREBASE_PRIVATE_KEY_BASE64
  if (base64Key) {
    return Buffer.from(base64Key, "base64").toString("utf8")
  }
  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
}

function ensureFirebaseAdmin() {
  if (getApps().length > 0) return

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = getFirebasePrivateKey()
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET

  if (!projectId) {
    throw new Error("Firebase admin project is missing. Set FIREBASE_PROJECT_ID.")
  }

  // In managed runtimes, credentials may be provided
  // implicitly by the environment; in local/self-host mode, we require explicit
  // service-account credentials.
  if (clientEmail && privateKey) {
    initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      ...(storageBucket ? { storageBucket } : {}),
    })
    return
  }

  initializeApp({
    ...(storageBucket ? { storageBucket } : {}),
  })
}

export type FirebaseVerifiedIdentity = {
  uid: string
  email: string
  name: string | null
}

export async function verifyFirebaseIdToken(idToken: string): Promise<FirebaseVerifiedIdentity> {
  ensureFirebaseAdmin()
  const decoded = await getAuth().verifyIdToken(idToken)

  if (!decoded.email) {
    throw new Error("Firebase token does not include an email")
  }

  return {
    uid: decoded.uid,
    email: decoded.email,
    name: decoded.name ?? null,
  }
}

export function getFirebaseStorageBucket() {
  ensureFirebaseAdmin()

  const configuredBucket = process.env.FIREBASE_STORAGE_BUCKET
  if (configuredBucket) {
    return getStorage().bucket(configuredBucket)
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId) {
    throw new Error("FIREBASE_PROJECT_ID is required for Firebase Storage")
  }

  return getStorage().bucket(`${projectId}.firebasestorage.app`)
}
