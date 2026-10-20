# Flowline Five-Step Implementation Plan

## Non-Negotiable Constraints

1. BRD source-only constraint: `Flowline_Manufacturing_BRD.md` is the only approved source for business scope, requirements, rules, and acceptance criteria.
2. Selective wireframe constraint: do not recreate the wireframe or use it as a full-screen blueprint. Refer to `wireframe/` only when the user requests a specific visual element, such as its color theme, card, dropdown, or stepper design, and copy only that requested design pattern.
3. The BRD controls functionality and workflow. A user request controls which wireframe visual pattern, if any, may be reused.
4. Do not add a role, screen, field, workflow state, integration, report, or business rule unless it is present in the BRD and approved through a BRD update.
5. When a requested wireframe design conflicts with the BRD or accessibility requirements, stop the affected work and record the mismatch for approval. Do not invent a resolution.
6. Keep production code separated into `frontend/`, `backend/`, and `database/`. Keep `wireframe/` unchanged as a selective visual reference.
7. Prefer small, reusable components and modules with descriptive names, single responsibilities, validation, consistent error handling, and focused tests.
8. A step is complete only when its exit gate is satisfied and its evidence is recorded.

The wireframe is consulted only for a specifically user-requested visual element. The final UI is not required to match the full wireframe screens.

## Step 1 - Plan and Set Up

### Objective

Convert the approved BRD into a traceable, implementation-ready backlog and prepare the project structure. Record wireframe styling only when the user requests a specific visual pattern.

### Work

- Create a traceability matrix from each Must requirement (`FR-*`, `BR-*`, and applicable `NFR-*`) to a screen, API, database entity, test, and owner.
- Confirm the six workspaces: Requestor/CSR, R&D, Planning, Press, Shipping, and Manager/Supervisor.
- Map the 14 logical screens to reusable frontend routes, layouts, queue components, forms, dialogs, timeline components, alerts, and dashboard components.
- Define the approved order states and stage transitions from the BRD.
- Define the initial PostgreSQL entities for users/roles, orders, reviews, planning, production, shipping, attachments, holds/rework, notifications, and audit events.
- Define the Node.js API boundaries and server-side authorization rules.
- Set up React with Tailwind CSS in `frontend/`, Node.js in `backend/`, and PostgreSQL/Neon migrations in `database/` only after versions and supporting libraries are approved.
- Record unresolved BRD Section 19 decisions. Mark affected stories blocked instead of making assumptions.

### Required Outputs

- Requirement traceability matrix.
- Role-permission matrix.
- Status-transition matrix.
- Approved field and validation dictionary.
- API contract draft.
- Database model and migration plan.
- Prioritized backlog with acceptance criteria.
- Local setup, lint, format, test, and build commands.

### Exit Gate

- Every Must requirement is mapped or explicitly blocked.
- Open business decisions have an owner and status.
- Architecture follows React + Tailwind CSS -> Node.js API -> PostgreSQL on Neon.
- No database credential or authorization decision is delegated to the frontend.

## Step 2 - Check Existing Coverage and Gaps

### Objective

Compare existing demonstrated behavior with the BRD before writing production features, without treating the wireframe layout as the target UI.

### Work

- Walk through all 14 BRD logical screens and the complete CSR-to-delivery flow.
- Compare each available role action, field, status, stage gate, notification, exception path, and timeline event with its BRD requirement.
- For visuals, inspect only the wireframe element explicitly requested by the user and do not inherit surrounding layout or styling.
- Classify each item as `Covered`, `Partial`, `Missing`, `Conflicting`, or `Blocked by decision`.
- Check known high-risk areas: authentication versus demo role switching, attachments, rejection and clarification, material shortage, rework routing, delivery evidence, permissions, audit history, SLA definitions, accessibility, and responsive tablet behavior.
- Separate prototype-only behavior and sample data from production requirements.
- Prioritize gaps by Must/Should/Could and workflow risk.

### Required Outputs

- Gap register with BRD requirement ID, observed behavior, classification, risk, and proposed test; include a wireframe reference only for an explicitly requested visual element.
- Approved implementation scope for the next step.
- List of conflicts or missing business decisions requiring stakeholder input.

### Exit Gate

- Every in-scope BRD requirement has a coverage classification.
- No conflicting or blocked requirement enters implementation.
- Stakeholders approve the gap register and implementation priority.

## Step 3 - Prove the Design Before Final Implementation

### Objective

Use disposable technical spikes and automated contract tests to prove that the planned design works before building the final feature.

### Work

- Create isolated spikes for the riskiest behavior; do not treat spike code as production code.
- Prove database constraints and transaction behavior for valid transitions, holds, rework, audit events, and concurrent updates.
- Prove API authorization and validation for every role and stage gate.
- Prove attachment handling without exposing database or storage credentials to the frontend.
- Prove notification creation, unread state, role routing, order navigation, and closure after resolution.
- Prove the full happy path and one exception path using representative snack-pouch order data.
- Test frontend component contracts, keyboard behavior, responsive layout, and API error states.
- Record the commands, inputs, expected results, actual results, and evidence for each spike.

### Mandatory Proof Scenarios

1. CSR creates a draft, receives validation feedback, and submits it.
2. R&D records each approved decision type and cannot bypass required evidence.
3. Planning cannot release an order with an unresolved material shortage.
4. Press records production quantities and cannot release incomplete production.
5. Shipping cannot mark an order Delivered without approved delivery evidence.
6. Unauthorized roles cannot perform another role's actions.
7. Hold and rework preserve history and return to the approved stage.
8. Notifications reach the resolution owner and Manager independently.

### Exit Gate

- Each risky design has a repeatable passing test or is rejected and redesigned.
- Failed spikes do not enter Step 4.
- Only the smallest proven design is approved for production implementation.

## Step 4 - Implement the Proven Solution

### Objective

Build only the behavior that passed Step 3 and is traceable to the BRD. Reuse only wireframe visual patterns explicitly requested by the user.

### Implementation Order

1. Database migrations, constraints, seed data, and rollback checks in `database/`.
2. Backend domain modules, authorization, validation, APIs, audit logging, and tests in `backend/`.
3. Frontend role workspaces, shared components, forms, queues, details, timeline, notifications, and tests in `frontend/`.
4. Happy-path integration, then hold/rework and management visibility.

### Coding Standards

- Organize code by domain and responsibility; keep functions and components focused.
- Reuse shared queue, status, form, dialog, timeline, alert, and loading/error components where behavior is genuinely shared.
- Keep business and authorization rules on the backend; frontend checks are usability aids only.
- Use structured validation and parameterized database access.
- Preserve immutable audit history for important workflow changes.
- Use clear naming, consistent formatting, linting, type checking where supported, and focused automated tests.
- Do not duplicate constants for roles, statuses, or transitions across layers without a controlled contract.

### Exit Gate

- Unit, integration, migration, API contract, and frontend component tests pass.
- Each implemented item links back to a BRD requirement and a Step 3 proof.
- No unapproved feature or prototype-only shortcut is included.

## Step 5 - Validate the UI, Fix Bugs, and Recheck

### Objective

Verify the complete user flow in the running UI and close every discovered defect with reproducible evidence.

### UI Validation

- Test all roles at agreed desktop and tablet sizes.
- Run the complete CSR -> R&D -> Planning -> Press -> Shipping -> Delivered journey.
- Run clarification, rejection, hold, material shortage, production issue/rework, and delivery issue paths that have approved rules.
- Verify stage gates, permissions, queues, search, filters, validation, notifications, unread counts, deep navigation, timeline history, manager metrics, and reset/recovery behavior.
- Check keyboard navigation, focus visibility, labels, contrast, error messages, text fit, overflow, and absence of overlapping UI.
- Compare functionality, labels, actions, and flow against BRD acceptance criteria.
- Compare only explicitly requested visual patterns against their matching wireframe element.

### Bug Evidence, Fix, and Recheck Loop

For every defect, create `bug/<bug-id>/` containing:

- `README.md`: title, severity, environment, related BRD requirement, affected role/screen, prerequisites, reproduction steps, expected result, actual result, root cause, and fix summary.
- `before.png` or other appropriate pre-fix evidence.
- Relevant sanitized logs or request/response evidence when needed.
- `after.png` and the exact regression-test result after the fix.

Then follow this loop:

1. Reproduce and capture the defect before editing.
2. Add or identify a test that fails for the defect.
3. Fix the root cause in the owning layer.
4. Run the focused regression test.
5. Repeat the affected UI flow and capture after-fix evidence.
6. Run the full end-to-end smoke flow when the fix affects shared workflow behavior.
7. Close the bug only when behavior matches the BRD and any explicitly requested wireframe visual pattern matches that element alone.

### Final Exit Gate

- All 12 BRD acceptance criteria pass or have a formally approved exception.
- No open critical or high-severity defects remain.
- Medium and low defects have an approved disposition.
- The final UI walkthrough satisfies the BRD flow without recreating the wireframe screens.
- Any explicitly requested wireframe-derived visual pattern matches only the requested element.
- Business owner, operations representative, technical lead, and project owner approval is recorded.

## Required Repository Layout

```text
flowline-manufacturing/
|-- Flowline_Manufacturing_BRD.md
|-- IMPLEMENTATION_PLAN.md
|-- wireframe/               # Selective visual reference; never a full UI blueprint
|-- frontend/                # React + Tailwind UI and frontend tests
|-- backend/                 # Node.js API, domain rules, authorization, and tests
|-- database/                # PostgreSQL migrations, seeds, and database tests
`-- bug/                     # Defect evidence; one folder per bug
```
