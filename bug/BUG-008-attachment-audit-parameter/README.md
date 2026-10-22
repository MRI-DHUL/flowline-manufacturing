# BUG-008: Attachment upload fails while writing audit event

## Severity

Critical - CSR cannot persist supporting files or complete submission with an attachment.

## Reproduction

1. Edit a CSR draft.
2. Add a supporting file.
3. Save or submit the order.

## Expected

The file content and attachment metadata persist, followed by an `ATTACHMENT_ADDED` audit event.

## Actual

The order update succeeded, but attachment upload returned `500` with PostgreSQL code `42P18`.

## Root Cause

`jsonb_build_object` is polymorphic and PostgreSQL could not infer the type of the parameter containing the file name. The same risk existed for clarification IDs.

## Fix

Cast audit-event JSON parameters explicitly to text.

## Evidence

- `before.png`: populated draft remains in edit mode after upload failure.
- `after.png`: submitted order detail includes the persisted attachment.

## Regression Verification

- Upload returns `200` and attachment metadata appears in the order detail.
- Download returns the original content.
- Audit history includes `ATTACHMENT ADDED`.