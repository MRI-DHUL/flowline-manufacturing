# BUG-002: Collapsed sidebar labels are clipped

## Severity

Medium - visible layout defect at tablet-width desktop viewports.

## Environment

- Route: `/dashboard`
- Reproduced viewport: 973 x 540 CSS pixels
- Breakpoint: dashboard sidebar collapse at 1000px

## Related Requirement

- NFR-003: responsive desktop and tablet interface

## Reproduction

1. Sign in with an active role-assigned account.
2. Open `/dashboard` at a viewport between 681px and 1000px wide.
3. Inspect the Flowline brand and user identity in the collapsed sidebar.

## Expected

The collapsed sidebar shows stable icons without clipped labels. The mobile header continues to show the user identity.

## Actual

The brand label remained in a 5px-wide grid and the user label remained visible in the narrow sidebar, producing clipped text.

## Evidence

- `before.png`: clipped brand and user labels.
- `after.png`: icon-only collapsed sidebar after the fix.

## Root Cause

The tablet media query set `font-size: 0` on parent labels, but nested `strong` and `small` selectors restored non-zero font sizes. The label containers remained visible.

## Fix

Hide brand and user label containers with `display: none` at the tablet breakpoint, constrain sidebar overflow, and explicitly restore the user label in the mobile header layout.

## Regression Verification

- Confirm label containers are hidden at the tablet breakpoint.
- Confirm no horizontal overflow.
- Confirm the mobile header still shows the signed-in user identity.