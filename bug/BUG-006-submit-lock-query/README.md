# BUG-006: Order submission returns 500 while locking draft

## Severity

Critical - no CSR order can progress from Draft to R&D Review.

## Reproduction

1. Open a CSR draft.
2. Select **Submit**.

## Expected

Incomplete orders return controlled `422` field errors; complete orders transition to R&D Review.

## Actual

The API returned `500` with PostgreSQL error `FOR UPDATE is not allowed with GROUP BY clause`.

## Root Cause

The submission transaction combined an aggregate clarification count (`GROUP BY`) with `FOR UPDATE` in one query. PostgreSQL does not allow row locking on grouped results.

## Fix

Lock the owned order row in a simple `SELECT ... FOR UPDATE`, then count open clarifications in a separate query on the same transaction client.

## Evidence

- `before.png`: uncontrolled submission-failed toast.
- `after.png`: controlled incomplete-field toast followed by successful complete submission.

## Regression Verification

- Empty draft submission returns `422 SUBMISSION_INCOMPLETE` with required fields.
- Complete draft submission transitions to `R&D Review` and records a revision and audit event.