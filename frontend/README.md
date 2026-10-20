# Flowline Frontend

React and Tailwind CSS frontend for the Flowline manufacturing order system.

## Current Routes

- `/login` - production login UI.
- `/register` - account registration UI without role self-assignment.

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