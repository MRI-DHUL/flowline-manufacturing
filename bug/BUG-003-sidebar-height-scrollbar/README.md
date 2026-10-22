# BUG-003: Sidebar stops short and scrollbar remains visible

## Severity

Medium - persistent navigation does not cover the visible viewport and the requested clean scrolling treatment is missing.

## Environment

- Route: `/dashboard`
- Desktop/tablet browser viewport with vertically scrollable dashboard content

## Related Requirement

- NFR-003: responsive desktop and tablet interface

## Reproduction

1. Open the authenticated dashboard.
2. Scroll the main page below the header.
3. Inspect the bottom of the sticky sidebar and the browser scrollbar track.

## Expected

- The sticky sidebar covers the complete visible viewport height.
- Page and sidebar scrollbar tracks are hidden.
- Wheel, touch, keyboard, and programmatic scrolling continue to work.

## Actual

- The sidebar used `calc(100vh - 72px)`, leaving a gap after the header scrolled away.
- The browser scrollbar track remained visible.

## Evidence

- `before.png`: short sidebar and visible scrollbar track.
- `after.png`: full-height sidebar with hidden tracks after scrolling.

## Root Cause

The sidebar height always subtracted the header even when sticky positioning moved the sidebar to viewport top. Scrollbar styling was not applied to the page scrolling element.

## Fix

- Set the sticky sidebar to `height: 100vh` and `min-height: 100vh`.
- Keep `overflow-y: auto` so sidebar scrolling remains functional.
- Hide page and sidebar tracks with Firefox, legacy Edge, and WebKit scrollbar rules.
- Reset sidebar height and overflow for the mobile horizontal navigation rail.

## Regression Verification

- Page scroll moved from 0px to 285px in browser automation.
- Sidebar measured 608px high in a 608px viewport with top `0` and bottom `608`.
- Page and sidebar computed `scrollbar-width` values were `none`.
- Sidebar computed `overflow-y` remained `auto`.
- No horizontal overflow was present.