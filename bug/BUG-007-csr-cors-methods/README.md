# BUG-007: CSR edit requests blocked by CORS

## Severity

Critical - CSR cannot update drafts or remove attachments from the browser.

## Reproduction

1. Open a saved draft in edit mode.
2. Change fields and select Save or Submit.
3. Browser sends a `PATCH` preflight request.

## Expected

The backend accepts CSR `PATCH` and `DELETE` requests from the configured frontend origin.

## Actual

The preflight response omitted `PATCH`, and the browser blocked the request with `ERR_FAILED`.

## Root Cause

The CORS plugin used its default allowed-method list, which did not include all CSR mutation methods.

## Fix

Explicitly allow `GET`, `HEAD`, `POST`, `PATCH`, `DELETE`, and `OPTIONS` for the configured frontend origin.

## Evidence

- `before.png`: populated draft remains in edit mode after the blocked request.
- `after.png`: complete draft submitted with its attachment after CORS correction.

## Regression Verification

- Fastify preflight injection test requires both `PATCH` and `DELETE` in `Access-Control-Allow-Methods`.
- Browser flow updates, uploads, and submits the draft successfully.