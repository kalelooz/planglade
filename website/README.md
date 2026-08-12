# PlanGlade website

This package owns the public pages deployed at `planglade.com`. It is deliberately separate from the core application in `frontend/`.

## Boundary

- `website/src/` contains only public-site copy, layout, styles, and behavior.
- `website/public/` contains curated site assets and real product screenshots.
- The website never imports code from `frontend/src` or `backend/src`.
- `npm run build:site` compiles the browser-local core app separately and copies only its output into `website/dist/demo`.
- Netlify publishes only `website/dist`.

## Commands

From the repository root:

```bash
npm run build:site
npm run check:site
npm run check:site-output
npm run dev:website
```

The local website server uses `http://127.0.0.1:5173/` by default. Build the site before starting it.
