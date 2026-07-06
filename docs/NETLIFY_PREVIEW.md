# Netlify Preview

Use Netlify builds from the repo. Do not deploy a locally built `.next` folder from Windows.

`netlify.toml` pins the repeatable build path:

```bash
npx prisma generate && npm run build
```

Required Netlify environment variables:

```env
DATABASE_URL="file:/tmp/planglade.db"
PLANGLADE_AUTH_MODE="nextauth"
NEXT_PUBLIC_PLANGLADE_AUTH_MODE="nextauth"
NEXTAUTH_SECRET="replace-in-netlify-only"
NEXTAUTH_URL="https://<site-name>.netlify.app"
GITHUB_ID="replace-in-netlify-only"
GITHUB_SECRET="replace-in-netlify-only"
PLANGLADE_STORAGE_PROVIDER="local"
PLANGLADE_STORAGE_SIGNING_SECRET="replace-in-netlify-only"
```

For a real hosted app, replace SQLite/local storage before accepting users. This preview is for public landing and read-only demo checks only.
