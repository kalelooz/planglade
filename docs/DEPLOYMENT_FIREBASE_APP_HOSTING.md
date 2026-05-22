# Firebase App Hosting Deployment (Simple Guide)

Last updated: 2026-05-22

This project is configured to deploy on Firebase App Hosting (no Vercel required).

## 1. Security first: rotate exposed service-account key

If a private key was ever shared in chat/email/issues, rotate it immediately:

1. Open Firebase Console -> Project Settings -> Service accounts.
2. Open Google Cloud IAM service accounts for this project.
3. Find `firebase-adminsdk-...`.
4. Delete the exposed key.
5. Create a new key.

After rotation, use only the new key.

## 2. Repo setup

Required files already exist in repo:

- `.github/workflows/ci.yml` (GitHub CI checks)
- `apphosting.yaml` (App Hosting config)
- `.env.example` (local env template)

## 3. Create App Hosting backend

Backend is already created:

- Backend ID: `flowboard`
- Region: `us-central1`
- URL: `https://flowboard--projectmanagement-e613c.us-central1.hosted.app`

Now in Firebase Console:

1. Go to **App Hosting**.
2. Open backend **flowboard**.
3. Connect your GitHub repository.
4. Set auto-deploy branch (usually `main`).

## 4. Environment expectations

Production auth mode is Firebase:

- `FLOWBOARD_AUTH_MODE=firebase`
- `NEXT_PUBLIC_FLOWBOARD_AUTH_MODE=firebase`
- `FLOWBOARD_STORAGE_PROVIDER=firebase`

Configured in `apphosting.yaml`.

App Hosting uses Google-managed default credentials, so no private key secret is required for runtime in App Hosting.

## 5. Deployment flow

1. Push branch to GitHub.
2. GitHub Actions runs CI (`lint` + `typecheck`).
3. App Hosting builds and deploys selected branch.

If GitHub connection is not set, rollout creation by branch/commit will fail.

## 6. Local development

Use `.env.example` as reference and keep real secrets only in local `.env` (never commit).

If you do not want Firebase Storage locally, set:

- `FLOWBOARD_STORAGE_PROVIDER=local`
- optional: `FLOWBOARD_LOCAL_STORAGE_DIR=storage/local-attachments`
- optional: `FLOWBOARD_STORAGE_SIGNING_SECRET=...`

Local attachment binary endpoints are:

- `PUT /api/attachments/upload-binary`
- `GET /api/attachments/download-binary`
