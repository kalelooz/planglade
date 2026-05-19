# Core Loop Implementation Plan

## Goal
Make the audit's P0 frontend loop more trustworthy: capture, triage, personal task views, and calendar dates should use shared persisted state and current local dates.

## Tasks
- [x] Confirm Today, Inbox, and store already share persisted capture/task state. Verify: inspect `src/app/page.tsx`, `src/app/inbox/page.tsx`, and `src/lib/store.ts`.
- [x] Fix date staleness in My Tasks. Verify: `Today`, `Upcoming`, and `Overdue` derive from a live local date instead of a module-load constant.
- [x] Fix date staleness in Calendar. Verify: today highlighting and overdue chips derive from a live local date instead of a one-time memo.
- [x] Run targeted TypeScript/ESLint checks on touched files. Verify: commands exit 0 or failures are documented.

## Done When
- [x] Core personal views use current local dates.
- [x] The plan and implementation are in the repo.
- [x] Targeted validation has been run.
