# Flowline Frontend

React and Tailwind CSS frontend for the Flowline manufacturing order system.

## Current Routes

- `/login` - production login UI.
- `/register` - account registration UI without role self-assignment.
- `/dashboard` - authenticated role-aware analytics with total/completed/production/attention cards, stage bar chart, status pie chart, seven-day trend line, and quick actions.
- `/dashboard/orders` - role-filtered order search, queue, tabs, and detail workspace.
- `/dashboard/orders/new` - CSR incomplete draft creation, core-field submission gate, mandatory active R&D reviewer assignment, and 5 MB supporting-file upload.
- `/dashboard/orders/:id` - refresh-safe CSR order detail, attachments, clarifications, and audit activity.
- `/dashboard/orders/:id/edit` - resume or correct an owned CSR draft/order awaiting clarification.

Authentication is handled by the Flowline backend with PostgreSQL-backed accounts and HTTP-only sessions. The browser never receives the database connection string and cannot assign roles during registration.

## Commands

```powershell
npm install
npm run dev
npm test
npm run lint
npm run build
```

## UI Constraint

The BRD controls functionality and workflow. Do not recreate the wireframe or use it as a screen blueprint. Consult it only for the exact visual element requested by the user at implementation time.

## Responsive Contract

Every frontend route and shared component must be validated at requested viewport widths of 320px, 375px, 768px, 1024px, and 1440px before completion.

- No horizontal page overflow or clipped interactive controls.
- Stable control dimensions and readable text at every breakpoint.
- Desktop navigation may collapse to icons on tablet and must become touch-friendly on mobile.
- Hidden scrollbar tracks must not disable wheel, touch, keyboard, or programmatic scrolling.
- Fixed-format controls, analytics grids, tables, queues, and steppers must define explicit responsive constraints.
- Login, registration, and dashboard routes currently pass this viewport matrix.