# PlanGlade frontend

This directory contains the production PlanGlade interface. The repository root contains the self-contained release bundle and public setup instructions.

## Development

Install both applications from the repository root, then start the frontend:

```bash
npm run install:all
cp backend/.env.example backend/.env
npm run dev --prefix frontend
```

The launcher starts this Vite app on `http://127.0.0.1:5173` and the sibling backend on port 3000. Port 3000 is API-only during product development. Set `PLANGLADE_BACKEND_DIR` to use a different backend checkout.

Use `npm run dev:reference` only for the explicit backend-free fixture comparison.

## Production

Run the root `compose.yml` to build the frontend, apply backend migrations, and serve the application behind one origin on port 8080. Direct SPA routes fall back to `index.html`; API, authentication, and setup routes are proxied to the backend.

Never commit `.env` files. Before giving access to users, verify sign-in, task creation and editing, refresh persistence, the calendar agenda/drawer flow, and attachment upload/download.
