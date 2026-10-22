# BUG-001: Pending account shown as workspace-ready

## Severity

Medium - misleading authorization state after successful authentication.

## Environment

- Frontend: local Vite development server
- Backend: local Flowline API connected to the Neon `dev` database
- Route: `/login`

## Related Requirements

- FR-001: role-appropriate workspace for authorized users
- FR-006: login and account registration
- BR-010: permission-based access

## Reproduction

1. Register a new account.
2. Leave the account in `PENDING` status without assigning a role.
3. Sign in with the new account.

## Expected

The UI states that administrator role assignment is still pending and does not promise workspace access.

## Actual

The UI displayed: `Signed in successfully. Your role workspace is ready to load.`

## Evidence

- `before.png`: pre-fix browser evidence.
- `after.png`: post-fix browser evidence.

## Root Cause

The login page ignored the authenticated user's returned status and used one hard-coded success message.

## Fix

Navigate every successfully authenticated account to the protected dashboard. The dashboard loads active role workspaces and shows the access-pending state for accounts awaiting activation or role assignment.

## Regression Verification

- Browser flow must navigate to `/dashboard` after successful authentication.
- Pending accounts must display the dashboard access-pending state.
- Active role-assigned accounts must display their role workspace.