# Step 1 Planning Package

## Source Constraint

This package derives functionality only from `../Flowline_Manufacturing_BRD.md`. Do not recreate `../wireframe/`; consult it only for the exact visual element the user requests at implementation time. A planning statement marked `Pending decision` is not approved for implementation.

The wireframe is consulted only for a specifically user-requested visual element. The final UI is not required to match the full wireframe screens.

## Artifacts

| Artifact | File | Status |
|---|---|---|
| Requirement traceability and open decisions | `01-requirements-and-decisions.md` | Ready for stakeholder review |
| Role permissions and status transitions | `02-permissions-and-transitions.md` | Provisional; blocked decisions identified |
| Screen, component, field, and validation plan | `03-screens-and-fields.md` | Provisional; candidate fields identified |
| API contract draft and database model | `04-api-and-data-design.md` | Draft; no implementation approval implied |
| Prioritized backlog and tool commands | `05-backlog-and-tooling.md` | Ready for stakeholder/technical review |

## Architecture Boundary

```text
React + Tailwind CSS frontend -> authenticated Node.js API -> PostgreSQL on Neon
```

- The frontend does not connect directly to PostgreSQL.
- The backend owns authorization, validation, workflow transitions, and audit recording.
- PostgreSQL stores workflow and audit data; Neon is the database host only.
- Authentication, attachment storage, frontend/backend hosting, package versions, and supporting libraries remain pending decisions.

## Step 1 Gate Status

**Status: Open.** The planning artifacts are complete for review. Stakeholders must resolve or formally defer blocked decisions before affected implementation can proceed. Step 2 may inspect and record gaps without assuming answers to those decisions.