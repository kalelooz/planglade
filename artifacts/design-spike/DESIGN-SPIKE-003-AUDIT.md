# DESIGN-SPIKE-003 — Visual fidelity audit

Date: 2026-06-18

Reference inspected directly: `C:\Users\Mohamed\Downloads\planglade_workspace (3).tsx`

## Screenshot sets

Before:

- `artifacts/design-spike/before/desktop-home.png`
- `artifacts/design-spike/before/desktop-inbox.png`
- `artifacts/design-spike/before/desktop-tasks-list.png`
- `artifacts/design-spike/before/desktop-projects.png`
- `artifacts/design-spike/before/desktop-project-detail.png`
- `artifacts/design-spike/before/desktop-notes.png`
- `artifacts/design-spike/before/desktop-calendar.png`
- `artifacts/design-spike/before/desktop-settings.png`
- `artifacts/design-spike/before/mobile-home.png`
- `artifacts/design-spike/before/mobile-tasks.png`
- `artifacts/design-spike/before/mobile-calendar.png`
- `artifacts/design-spike/before/mobile-settings.png`

Before board note: no `desktop-tasks-board.png` was captured before the patch because board mode was not URL-addressable and the interactive screenshot attempt timed out after toggling state.

After:

- `artifacts/design-spike/after/desktop-home.png`
- `artifacts/design-spike/after/desktop-inbox.png`
- `artifacts/design-spike/after/desktop-tasks-list.png`
- `artifacts/design-spike/after/desktop-tasks-board.png`
- `artifacts/design-spike/after/desktop-projects.png`
- `artifacts/design-spike/after/desktop-project-detail.png`
- `artifacts/design-spike/after/desktop-notes.png`
- `artifacts/design-spike/after/desktop-calendar.png`
- `artifacts/design-spike/after/desktop-settings.png`
- `artifacts/design-spike/after/mobile-home.png`
- `artifacts/design-spike/after/mobile-tasks.png`
- `artifacts/design-spike/after/mobile-calendar.png`
- `artifacts/design-spike/after/mobile-settings.png`

## Reference rules extracted

- Root feel: `bg-[#fafafa]`, zinc text, dense neutral surfaces, antialiased, restrained borders.
- Sidebar: tiny uppercase section labels, compact row height, active left rail/border treatment.
- Topbar: compact workspace switcher and quick capture, `bg-zinc-50`, `border-zinc-200/80`, subtle focus ring.
- Pages: `space-y-8`/`space-y-10`, small uppercase eyebrows, `animate-fade-in`.
- Lists: white containers, `divide-y divide-zinc-200/60`, thin borders, dense rows.
- Tasks: segmented list/board control, board/list share one registry, sticky detail panel.
- Calendar: compact white day cells, selected day ring, side agenda/no-date stack.
- Toasts: bottom-right, white, small type, rounded, border, shadow, black dot marker, slide-up motion.

## Blunt audit table

| Area | Before score | After score | Finding | Action |
|---|---:|---:|---|---|
| Overall shell fidelity | 8 | 8 | Shell already close: neutral, compact, useful. | No extra shell churn. |
| Page background | 9 | 9 | `#fafafa`/zinc surfaces match reference. | Kept. |
| Typography | 8 | 8 | Eyebrows and dense type are close; some legacy pages still have heavier copy. | Left bigger copy edits for later. |
| Motion | 5 | 8 | Reference uses quiet fade-in; several core pages were static. | Added shared `animate-fade-in`. |
| Toasts | 4 | 8 | Default Sonner look did not match custom reference toast. | Restyled Sonner bottom-right with dot/slide-up. |
| Tasks list | 8 | 8 | Dense and usable, detail drawer is product-grade. | Kept. |
| Tasks board | 6 | 8 | Board could not be captured/share-linked directly. | Added `?view=board` URL state. |
| Mobile board | 6 | 7 | Still tight at 390px, but no horizontal overflow. | Verified overflow = 0. |
| Calendar month | 7 | 8 | Month grid close, but side panel only showed no-date items. | Added selected-day agenda. |
| Calendar date selection | 6 | 8 | Selected-day concept existed on mobile only. | Made month day numbers select desktop side agenda. |
| Inbox | 8 | 8 | Strong match: buffer, dense rows, triage controls. | Kept. |
| Projects list | 8 | 8 | Clean directory/list style; reference match is good. | Kept. |
| Project detail | 7 | 7 | Useful, but a little roomier than reference. | Left as non-blocking. |
| Notes | 7 | 7 | Functional split view; missing a stronger page header vs reference. | Deferred; not worth layout churn now. |
| Settings | 7 | 7 | Good narrow settings stack; still more app-specific than reference. | Kept. |
| Empty states | 7 | 7 | Mostly restrained, some blank vertical space remains. | Deferred. |
| Hover/transition consistency | 6 | 7 | Some controls already transition; not universal. | Added only where touched. |
| Console health | 8 | 9 | No smoke-console errors after patch. | Verified. |
| Desktop overflow | 9 | 9 | No normal horizontal-scroll pattern found in touched routes. | Verified. |
| Reviewability | 6 | 9 | Missing board artifact before; after set complete. | Added board URL and after screenshot. |

## Critic section

The app is now visually close enough to review against the uploaded PlanGlade reference without apology. The shell and page interiors read as the same product family: quiet zinc palette, compact rows, tiny uppercase labels, and white bordered work surfaces.

The weakest parts are still not bugs; they are fidelity gaps:

1. Notes lacks the reference's stronger page-level framing. It works, but it feels like an editor dropped into the shell rather than a fully composed reference page.
2. Mobile board is technically responsive but visually dense. At 390px it stacks correctly and does not overflow; it is just cramped because kanban boards are cramped on phones.
3. Settings is clean but more utilitarian than the reference. It is acceptable for review, not a showpiece.
4. Some older secondary surfaces still carry legacy density/spacing assumptions, but the canonical `/app/*` loop is coherent.

## Fixes applied

- Added task view URL state so `/app/tasks?view=board` opens board mode and can be screenshotted/reviewed directly.
- Added `animate-fade-in` to the canonical Home, Inbox, Tasks, Projects, Notes, Calendar, and Settings surfaces.
- Restyled Sonner toasts to bottom-right, white, compact, bordered, shadowed, slide-up, with a black dot marker.
- Added a desktop calendar selected-day agenda using existing calendar state.
- Added a small static guard for the DESIGN-SPIKE-003 visual commitments.

## Remaining gaps

- Sidebar footer/workspace-badge details from the uploaded reference are not fully replicated. Deferred because it is decorative and not blocking the app loop.
- Notes could use a future header/framing pass.
- Mobile board could eventually become a status-filtered list on phones, but current implementation has no horizontal overflow and works.
- Build still reports pre-existing Turbopack broad dynamic file-pattern warnings from `src/lib/storage.ts`.
- Lint still reports four pre-existing warnings: one Next font warning and three TanStack Table React Compiler warnings.

## Validation

- `npm.cmd run lint` — passed with 4 pre-existing warnings.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run test` — passed, 40 tests.
- `npx.cmd prisma validate` — passed.
- `npm.cmd run build` — passed. Re-run by itself after the test suite to avoid a transient SQLite journal copy warning from parallel validation.

## Manual smoke

Base URL used: `http://127.0.0.1:3001`

- Route loading: `/app`, `/app/inbox`, `/app/tasks`, `/app/tasks?view=board`, `/app/projects`, `/app/calendar`, `/app/settings` passed.
- Browser console/page errors: none captured during smoke.
- Quick Capture → Inbox → Triage → Tasks: passed with temporary smoke item.
- Task list/board toggle: passed; board URL became `?view=board`.
- Task drawer open/close: passed.
- Calendar real due/no-date data: passed; smoke task appeared on June 18, 2026, and No Date tasks rendered.
- Settings export/import controls: passed; controls rendered safely.
- 390×844 mobile board horizontal overflow: `0`.

Cleanup:

- Deleted temporary smoke item `cmqjou3d601jcinn00wg5rh7v`.
- Deleted temporary screenshot project `cmqjoevkx00vzinn0fia9d9mk`.

## Readiness

Review-ready for DESIGN-SPIKE-003.

Visual fidelity score: 8/10.

Reason: the core app loop is coherent and close to the reference. The remaining misses are mostly polish/decorative or mobile-kanban ergonomics, not blockers.
