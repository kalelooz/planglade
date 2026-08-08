# Vite integration harness

Run the authenticated API smoke with `npm run test:e2e:integration`. It starts the detached backend validation worktree located next to the frontend checkout, a strict Vite server on `127.0.0.1:5173`, and the backend on `127.0.0.1:3000`. Set `PLANGLADE_E2E_BACKEND_DIR` only when the backend worktree lives elsewhere.

Each run creates a unique SQLite database and local attachment directory under the operating-system temporary directory, applies the backend migrations, then creates a one-run owner through the backend's existing local-credentials setup flow. The test signs in through the Vite proxy, seeds two projects and three tasks through protected API routes, and writes only temporary cookie state. It stops only the processes it started and removes the database, state, and ports after success or failure.

Run `npm run test:e2e:reference` for the backend-free reference smoke. It starts only Vite in reference mode and verifies fixture data plus a normal local Quick Capture edit.

If a smoke fails, Playwright traces, screenshots, and `server.log` remain under `test-results/vite-integration` or `test-results/vite-reference`; these paths are ignored by Git. A run fails before startup when ports 3000 or 5173 are occupied and reports the listening PID. Confirm cleanup with `netstat -ano -p tcp | findstr ":3000 :5173"`.
