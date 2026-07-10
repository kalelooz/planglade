# Firebase Extraction Plan — `SAAS-FIREBASE-EXTRACT-001`

**Status:** Planned. Blocked on a private hosted SaaS destination existing.
**Originating decision:** `FIREBASE-SAAS-BOUNDARY-001` (2026-07-09) — Firebase is SaaS-only.

## Purpose

This is the precise manifest for moving the Firebase implementation out of the public repository into the private hosted SaaS codebase, once that destination exists. It exists so the work can be done safely in one scoped pass without rediscovery, and so the public repository can advertise an honest, Firebase-free self-host path in the meantime.

The current repository does **not** delete the Firebase implementation. As of `FIREBASE-SAAS-BOUNDARY-001`, the public self-host path no longer requires, defaults to, or advertises Firebase (production defaults were changed to `nextauth` + local storage), but the Firebase adapter code remains in-repo as **temporary extraction debt**, gated behind an explicit opt-in. This document is the follow-up.

## Non-goal

Do not attempt this extraction until:

1. A private hosted SaaS repository/package exists and can receive the code, tests, and configuration below.
2. The extraction can be validated end-to-end in the private destination before the public code is removed.

Destroying the implementation before a destination exists is explicitly forbidden — it would discard working, tested code with no way to recover it into the SaaS path.

## Inventory — files to move

### Firebase-specific implementation (move wholesale)

| File | Role |
|---|---|
| `src/lib/firebase-admin.ts` | Firebase Admin init, `verifyFirebaseIdToken`, `getFirebaseStorageBucket` |
| `src/lib/firebase-client.ts` | Firebase client app init, `firebaseAuth`, `googleAuthProvider`, token storage key |

### Code with Firebase branches (extract the `firebase` branches; keep the provider-neutral shell)

These files mix public-core logic with Firebase-specific branches. Extract only the `firebase`/`provider === "firebase"` branches; the remaining public-core logic stays.

| File | Firebase surface to extract |
|---|---|
| `src/lib/storage.ts` | `getDefaultStorageProvider` is already local-only; extract `buildFirebaseUploadSignedUrlConfig` and every `provider === "firebase"` branch in `createAttachmentUploadTarget`/`createAttachmentDownloadTarget`/`storageObjectExists`/`deleteStorageObject`/`readStorageObjectMetadata` |
| `src/lib/api-utils.ts` | `extractFirebaseToken` and the `authMode === "firebase"` resolution branch in `resolveRequestActorUserId`; the `verifyFirebaseIdToken` import |
| `src/lib/auth-config.ts` | the `mode === "firebase"` required-variable block (and `"firebase"` from `VALID_AUTH_MODES` once no public caller remains) |
| `src/app/api/auth/session/route.ts` | the `useFirebaseAuth` path and the `verifyFirebaseIdToken` dynamic import |
| `src/app/login/page.tsx` | `hasFirebaseGoogleConfig` and the Firebase Google-button rendering branch |
| `src/components/lovable/auth-context.tsx` | the entire Firebase client auth lifecycle (`firebase/auth`, `firebaseAuth`, `signInWithPopup`, token refresh, `firebaseSignOut`) |
| `src/components/lovable/login-page.tsx` | Firebase-specific Google sign-in error strings |
| `src/lib/server-session-client.ts` | Firebase ID-token persistence and refresh helper; remove once the Firebase client auth lifecycle moves |
| `scripts/validate-auth-config.mjs` | the `mode === "firebase"` and `storageProvider === "firebase"` credential checks (keep `firebase` in the valid-value sets only if a SaaS provider plugin model is retained) |

### Configuration / deployment

| File | Role |
|---|---|
| `apphosting.yaml` | Firebase App Hosting runtime settings - SaaS-only. Removed from the public repo by `FIREBASE-SAAS-BOUNDARY-001`; recreate in the private hosted SaaS destination if Firebase App Hosting remains the chosen platform. |

### Documentation (move or rewrite)

| File | Disposition |
|---|---|
| `.env.example` | Keep in public repo, but remove the `FIREBASE_*` / `NEXT_PUBLIC_FIREBASE_*` block (it is SaaS configuration, not self-host) |
| `docs/SELF_HOSTING.md` | Keep; remove the "Optional Firebase Storage" section (SaaS concern) |
| `docs/BACKUP_RESTORE.md` | Keep; remove the "Optional Firebase Attachment Backup" section |
| `README.md` | Keep; remove Firebase auth/storage mentions from the stack table and env docs |

## Dependencies to move

After extraction, if no public runtime code imports them, remove from `package.json` and regenerate the lockfile:

- `firebase`
- `firebase-admin`

**Do not remove security overrides prematurely.** The overrides added for Firebase (`gaxios`, `retry-request`, `teeny-request`, `uuid` in addition to `postcss`) must be re-checked against remaining dependency owners before removal — `firebase-admin` is their current owner, but `uuid` may be referenced elsewhere. Verify with `npm ls <override>` after extraction before deleting any override.

## Tests to move

| Test file | Disposition |
|---|---|
| `tests/auth-session-route.test.ts` | The Firebase-mode subtests move to the SaaS suite; the `nextauth`/`dev`/validation subtests stay public |
| `tests/attachment-security.test.ts` | The `buildFirebaseUploadSignedUrlConfig` / Firebase-upload test moves; local-storage tests stay |
| `tests/env-naming.test.ts` | Firebase fallback subtests move; PlanGlade/local subtests stay |
| `tests/firebase-self-host-boundary.test.ts` | **Stays public** — it is the regression guard for the boundary itself |

## Public contracts to retain (do not move)

These are provider-neutral and must remain in public core:

- The auth-mode resolution contract (`resolveRequestActorUserId`) minus the Firebase branch
- The local storage provider (all of the local signed-URL, path-traversal, and HMAC logic in `storage.ts`)
- `getConfiguredAuthMode` / `getConfiguredStorageProvider` / `getAuthConfigErrors` / `getStorageConfigErrors`
- The attachment route handlers (they are provider-neutral via `storage.ts`)

## Completion criteria for `SAAS-FIREBASE-EXTRACT-001`

1. Firebase implementation, config, SaaS-scoped tests, and SaaS-scoped docs live in the private destination.
2. `git grep -i "firebase" -- src` returns no hits in the public repo (excluding comments documenting the historical decision).
3. `npm ls firebase` and `npm ls firebase-admin` return empty in the public repo.
4. No security override is removed until its remaining owner is verified.
5. Public validation passes: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm audit` (both).
6. `tests/firebase-self-host-boundary.test.ts` still passes (the boundary holds after removal).
7. The Docker/self-host path still starts and passes `/api/health` with zero Firebase variables.

## Current state (as of `FIREBASE-SAAS-BOUNDARY-001`)

- Physical extraction: **not performed** (no private destination exists).
- Public self-host independence: **enforced** - production defaults are `nextauth` + `local`; no Firebase variable is required; guarded by `tests/firebase-self-host-boundary.test.ts`.
- The Firebase code remains in-repo behind explicit opt-in and must not be re-advertised as a public self-host feature.
- The root Firebase App Hosting config was removed from the public repo because it is SaaS-only deployment configuration, not implementation that should be kept public while awaiting extraction.
