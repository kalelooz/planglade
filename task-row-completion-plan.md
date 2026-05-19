# Task Row Completion Plan

## Goal
Make shared task rows directly completable from list views without opening the action menu.

## Tasks
- [x] Add a checkbox to `WorkItemRow` that toggles `Done` / `In Progress` through the existing `onMove` callback. Verify: all existing `WorkItemRow` consumers compile without prop changes.
- [x] Keep completed rows visually distinct. Verify: completed titles are muted and struck through.
- [x] Run targeted validation. Verify: ESLint on the touched component and TypeScript exit 0.

## Done When
- [x] My Tasks, Tasks, and Project task lists have direct complete/uncomplete controls.
- [x] The implementation uses existing store mutation paths.
- [x] Targeted validation has been run.
