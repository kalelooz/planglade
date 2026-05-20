# FlowBoard Quality Gates

## Goal

Define the minimum evidence required before a FlowBoard slice is called complete.

## Default Slice Checklist

Every meaningful change should pass this checklist:

- [ ] The change matches `AGENTS.md` and `docs/ACTIVE_PLAN.md`.
- [ ] Fake controls are removed, disabled, or made real.
- [ ] The changed UI uses existing component patterns before custom widgets.
- [ ] Desktop or mobile layout is checked only when the changed surface is visible there and the change can affect layout.
- [ ] The relevant command output has been read before claiming it passes.
- [ ] Documentation is updated when behavior, setup, or product direction changes.

## Fast Lane Policy

Use the smallest validation that proves the requested slice. Prefer targeted checks over broad checks, and skip checks that do not exercise the changed behavior.

- Documentation-only changes: read the edited Markdown and run a targeted `rg` only if wording can create contradictions.
- Single TS/TSX component/page changes: run ESLint on the touched file(s). Run `tsc --noEmit` only when type contracts, props, imports, or shared state changed.
- CSS-only changes: inspect the changed CSS and use one browser viewport when the visual result matters. Do not run TypeScript for CSS-only edits.
- UI layout changes: use one representative browser viewport by default. Add mobile only when mobile-specific classes, navigation, or narrow layout can be affected.
- State/workflow changes: manually verify only the workflow that changed and the directly affected views.
- Do not run `npm run build`, full `npm run lint`, full test suites, or broad browser sweeps unless the slice touches shared infrastructure, build config, persistence, routing, or cross-page behavior.
- If a broad command is known to fail for unrelated reasons, do not rerun it repeatedly. Name the known failure only when it matters to the final status.

## Command Gates

Use the smallest command set that proves the slice.

### Documentation-only changes

- Read changed Markdown files.
- Run a targeted search for stale contradictions when wording changes product status.

Suggested checks:

```bash
rg --line-number "full-featured|production-ready|Build passes|/home/z|fake|mock|Quick Capture|Inbox|local persistence|full-stack" README.md AGENTS.md docs/ACTIVE_PLAN.md docs/FULLSTACK_ROADMAP.md docs/QUALITY-GATES.md
```

### TypeScript or React component changes

- Run the most relevant lint command for the touched file(s).
- Run TypeScript checking only when the change can affect type contracts, imports, props, or shared state.
- If lint/build is known to fail for unrelated reasons, record the exact known failure instead of claiming it passes.

Suggested targeted checks:

```bash
npx eslint src/app/page.tsx
npx tsc --noEmit
```

### UI page changes

- Start or reuse the dev server.
- Check the page in a browser.
- Capture or inspect one representative viewport by default.
- Add a second viewport only when the change affects responsive behavior.
- Verify no text overlap, clipped primary controls, duplicate page titles, or fake primary actions.

Suggested browser checks:

- Desktop: 1440 x 900.
- Mobile: 390 x 844.
- Changed page plus any page affected by shared shell/navigation.

### State or workflow changes

- Verify the original user workflow manually.
- Verify directly affected views update from the same state.
- If local persistence is touched, refresh and confirm data remains.

Minimum workflow proof only when those actions are part of the changed behavior:

- Create.
- Edit.
- Move or complete.
- Delete.
- Refresh if persistence is in scope.

## Known Red Gates

These are known project-level issues from the audit. Do not report them as fixed unless fresh verification proves it.

- Build/start scripts still need production hardening and cross-platform verification.
- `npm run lint` has existing failures.
- `next.config.ts` currently has `typescript.ignoreBuildErrors: true`.
- The app still uses client-side local persistence instead of server-backed product data.
- Auth, Prisma schema, and product API routes are placeholders for the actual product.

## Definition of Done

A slice is done only when:

- [ ] The requested behavior is implemented or the blocker is documented.
- [ ] Relevant verification was run after the final edit.
- [ ] Any failing check is named with the exact failure category.
- [ ] The final response names changed files and verification evidence.
- [ ] No future work is described as already complete.
