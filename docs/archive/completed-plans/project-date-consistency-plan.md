# Project Date Consistency Plan

## Goal
Keep project task tabs and project overdue metrics aligned with Home and My Tasks by using a live local day.

## Tasks
- [x] Replace Projects' one-time `new Date()` with a live `now` state that refreshes every minute.
- [x] Use shared local date keys for Today/Upcoming/Overdue task tab checks.
- [x] Exclude undated tasks from project overdue metrics.
- [x] Run targeted validation.

## Done When
- [x] Project task tabs agree with My Tasks for date buckets.
- [x] Undated project tasks are not marked overdue.
- [x] Targeted validation has been run.
