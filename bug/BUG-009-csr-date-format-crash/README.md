# BUG-009: Submitted order detail crashes on date formatting

## Severity

Critical - successful submission navigates to a blank/error page.

## Root Cause

The API returned a PostgreSQL date as an ISO timestamp while the frontend formatter assumed `YYYY-MM-DD` and appended another time segment.

## Fix

Normalize database dates to `YYYY-MM-DD` in the backend and defensively validate dates in the frontend formatter.

## Evidence

- `before.png`: page failure after successful submission.
- `after.png`: submitted R&D Review detail with the correct requested date.

## Regression Verification

- API returns a date-only string.
- Detail, queue, and form routes render without `RangeError`.