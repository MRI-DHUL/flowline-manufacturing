# BUG-005: Created draft route shows no selected order

## Severity

High - after saving a draft, the URL changes to the order detail route but the detail panel remains empty.

## Reproduction

1. Open `/dashboard/orders/new`.
2. Save a draft.
3. Observe navigation to `/dashboard/orders/:id`.

## Expected

The newly created draft is selected and its detail panel loads.

## Actual

The queue contains the draft, but the detail panel continues to show **No order selected**.

## Root Cause

React reused the CSR workspace instance mounted for `/new`. Its `selectedId` state was initialized to `null` and did not reinitialize after the route changed to an order ID.

## Fix

Key the CSR workspace by route mode and order ID so create, detail, and edit route transitions initialize state from the active URL.

## Evidence

- `before.png`: draft appears in queue while detail remains empty.
- `after.png`: created draft selected with detail and activity tabs loaded.

## Regression Verification

- Save an incomplete draft.
- Confirm navigation to `/dashboard/orders/:id`.
- Confirm the queue selection and order detail both load.