# BUG-004: Empty draft rejected by delivery-date validation

## Severity

High - CSR cannot save an incomplete draft, violating FR-010 and FR-011.

## Reproduction

1. Open `/dashboard/orders/new`.
2. Leave the form empty.
3. Select **Save draft**.

## Expected

An incomplete draft is created and can be resumed later.

## Actual

The API returned `400 VALIDATION_ERROR` because the empty delivery-date input was sent as an empty string.

## Root Cause

The route required an ISO date or `null`, but browser date inputs emit `""` when empty. Validation occurred before the service normalized empty strings.

## Fix

Preprocess an empty delivery-date string to `null` at the API validation boundary.

## Evidence

- `before.png`: failed empty-draft save toast.
- `after.png`: successful saved draft detail.

## Regression Verification

- Fastify injection test submits an empty date and nullable quantity and expects `201`.
- Browser flow saves an entirely incomplete draft and resumes it successfully.