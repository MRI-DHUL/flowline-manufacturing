# Prioritized Backlog and Tooling Gate

## Delivery Backlog

Priority follows the BRD. Stories with unresolved decisions cannot enter implementation.

| Order | Epic/story | BRD references | Acceptance summary | Status |
|---|---|---|---|---|
| 1 | Production identity and authorization | FR-001-006, BR-010/011, NFR-005/006 | Login/registration validate input, registration cannot self-assign roles, and authenticated users receive only permitted records/actions | Authentication complete; role authorization blocked by D-01/D-03 |
| 2 | Order draft and submission | FR-010-017, BR-001-003 | CSR creates/resumes a validated draft, attaches approved files, submits to R&D | Blocked by D-02/D-11 |
| 3 | Unified order detail and audit timeline | FR-060-065, BR-003/007/009 | Permitted users see current state, owner, next action, documents, immutable history | Partial; D-11/access policy |
| 4 | R&D queue and feasibility | FR-020-024 | R&D reviews context and records an auditable allowed decision; Planning gate enforced | Partial; D-03/D-04 |
| 5 | Planning and Press release | FR-030-036, BR-005 | Planning records readiness/shortage, schedules, and cannot release blocked work | Blocked by D-03/D-05 |
| 6 | Press execution | FR-040-045, BR-006 | Press starts, updates, reports issues, and completes only with approved evidence | Blocked by D-03/D-06/D-07 |
| 7 | Shipping and delivery | FR-050-055, BR-007/008 | Shipping dispatches and confirms delivery only with approved evidence | Partial; D-02/D-11 |
| 8 | Hold/rework and notifications | FR-070-076, BR-004/009/012 | Exceptions route to owner/Manager, remain visible, resolve with retained history | Blocked by D-03/D-06/D-08/D-13 |
| 9 | Manager overview | FR-080-084 | Counts/workload reconcile; approved age/risk definitions drill into orders | Blocked by D-08 |
| 10 | Accessibility and responsive quality | NFR-003/004/009 | Agreed desktop/tablet UI supports keyboard, focus, labels, contrast, errors, no data loss | Partial; D-12 |
| 11 | Operational readiness | NFR-001/002/007/008/010/012 | Approved performance, security, audit, logging, backup/recovery targets pass | Blocked by D-11/D-14/D-15 |

## Step 2 Entry Backlog

These read-only checks can start before business decisions are resolved:

1. Check the planned behavior of all 14 logical screens against their BRD descriptions.
2. Exercise the BRD happy path as implementation becomes available and record covered/partial/missing behavior.
3. Check role action visibility against the provisional permission matrix.
4. Check stage gates, timeline, hold alerts, notification read state, search, filters, keyboard behavior, and tablet layout.
5. Record gaps without implementing or assuming a solution.

Do not inspect or compare the wireframe during general gap analysis. Visual gap checks are limited to the exact wireframe element the user explicitly requests, such as its color theme, card, dropdown, or stepper design.

## Toolchain Approval Gate

The BRD approves React, Tailwind CSS, Node.js, PostgreSQL, and Neon but does not approve versions, package manager, Node.js web framework, test libraries, database client/ORM, authentication provider, object storage, hosting, or CI platform.

Before scaffolding, the technical lead must record:

| Decision | Status |
|---|---|
| Runtime and frontend framework versions | Selected for frontend: Node 24, React 19, TypeScript 6, Vite 8, Tailwind CSS 4 |
| Package manager and frontend structure | Selected for frontend: npm and feature-based `src/` modules |
| Node.js API framework | Selected: Fastify 5 with Zod validation |
| PostgreSQL migration/data-access approach | Selected: ordered SQL migrations and parameterized `pg` access |
| Unit and browser test tools | Selected: Vitest, Testing Library, Fastify injection, and Playwright validation |
| Lint, format, and type-check tools | ESLint and TypeScript selected for frontend; formatting tool pending |
| Authentication provider | Selected: Flowline backend with PostgreSQL, Argon2id, and HTTP-only sessions |
| Attachment storage | Pending D-11 |
| Frontend/backend hosting and CI | Pending |

## Required Command Contract

Once the toolchain is approved and scaffolded, each code folder must expose equivalent documented commands for:

- Install dependencies.
- Start local development.
- Lint.
- Format check.
- Type check where supported.
- Run focused and full tests.
- Build production artifacts.
- Apply, verify, and recover database migrations.

Exact commands are intentionally not claimed before package/tool selection. The root README must list the final commands after scaffolding.

## Step 1 Review Checklist

- [x] Must requirements and business rules mapped or blocked.
- [x] Applicable NFRs mapped or blocked.
- [x] Six role workspaces and 14 logical screens mapped.
- [x] Provisional role-permission matrix created.
- [x] Happy-path transitions and blocked exception transitions documented.
- [x] Candidate fields and known validation rules documented.
- [x] API boundaries and server authorization ownership drafted.
- [x] PostgreSQL entities and migration order drafted.
- [x] Prioritized backlog created.
- [x] Open decisions have accountable owners and Pending status.
- [ ] Business stakeholders approve fields, permissions, transitions, and exception rules.
- [ ] Technical lead approves toolchain versions/libraries and operational targets.
- [ ] Approved local commands are added after scaffolding.

**Step 1 gate remains open.** Planning documentation is complete enough for stakeholder review and Step 2 gap inspection, but affected implementation remains blocked until the unchecked approvals are recorded.
