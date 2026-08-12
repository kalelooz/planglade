# Website and core application boundary

PlanGlade uses one public repository with two independently owned frontend surfaces:

```text
planglade/
├── website/     Public pages and curated marketing assets
├── frontend/    Core React application
└── backend/     API, authentication, SQLite, and attachments
```

## Deployment contract

Netlify builds from the repository root and publishes only `website/dist`.

1. `frontend` compiles in reference mode with `/demo/` as its base URL.
2. `website` builds the public pages into `website/dist`.
3. The website build copies only the compiled frontend artifact into `website/dist/demo`.
4. Netlify rewrites `/demo/*` to `/demo/index.html` and never rewrites the site root to the core app.

The website does not import from `frontend/src` or `backend/src`. Core application changes can alter the next compiled demo, but they cannot replace the landing page or public information pages.

## Source ownership

- Update public copy, navigation, page structure, and marketing assets in `website/`.
- Update application behavior in `frontend/`.
- Update API, authentication, persistence, or attachments in `backend/`.
- Keep real product captures in `website/public/product/`; refresh them deliberately after visually approved application changes.

## Verification

Run:

```bash
npm run check:hosting
npm run check:site
npm run build:site
npm run check:site-output
```

These checks fail if Netlify points at the core app, the root SPA redirect returns, the website imports core source, the demo loses its `/demo/` base, or required public pages are missing.
