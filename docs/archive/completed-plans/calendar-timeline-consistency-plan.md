# Calendar And Timeline Consistency Plan

## Goal
Make Calendar and Timeline agree with task due dates, local dates, and drawer edits.

## Tasks
- [x] Add shared date helpers for local date-time parsing and time extraction.
- [x] Make Calendar overdue/today checks use date parts and the shared live `now`.
- [x] Make Timeline parse due dates and compare overdue state through shared helpers.
- [x] Make TaskDrawer preserve due-time values through the shared helper.
- [x] Update page plan checkboxes for Calendar and Timeline.
- [x] Run targeted validation and browser smoke checks.

## Done When
- [x] Calendar data agrees with task due dates and ignores undated tasks.
- [x] Timeline today marker and overdue state use the current local date.
- [x] Editing a due date in drawers uses the same date format rules.
- [x] Targeted validation has been run.
