# API Contract Draft and Database Model

## API Rules

- Base path proposal: `/api/v1`.
- Production requests require authenticated identity; provider remains D-10.
- List/detail queries and every command are authorized on the server.
- Commands validate the current state and approved stage gate in one transaction.
- Successful workflow commands append an audit event atomically.
- Client-supplied actor, owner, status, and audit timestamps are not trusted.
- Error responses use a stable code, message, field errors where applicable, and correlation identifier.

## Resource Queries

| Method and path | Purpose | Authorized audience |
|---|---|---|
| `GET /session` | Current identity and permissions | Authenticated user |
| `GET /orders` | Role-permitted queue, search, filters | All operational roles/Manager |
| `POST /orders` | Create draft | CSR |
| `GET /orders/:orderId` | Unified detail | Permitted roles |
| `PATCH /orders/:orderId` | Edit unsubmitted draft | Owning CSR |
| `GET /orders/:orderId/activity` | Audit timeline | Permitted roles |
| `GET /orders/:orderId/attachments` | Permitted documents/revisions | Permitted roles |
| `POST /orders/:orderId/attachments` | Add approved attachment | Action-permitted role |
| `GET /notifications` | Current user's role-routed alerts | Authenticated user |
| `PATCH /notifications/:notificationId/read` | Mark read | Notification recipient |
| `GET /manager/overview` | Counts, workload, risks | Manager |

## Workflow Commands

| Method and path | Command | Gate/decision dependency |
|---|---|---|
| `POST /orders/:orderId/submit` | Submit draft to R&D | D-02 |
| `POST /orders/:orderId/technical-decisions` | Approve, clarify, reject, hold | D-03/D-04 |
| `POST /orders/:orderId/planning-review` | Record readiness/shortage/schedule data | D-05 |
| `POST /orders/:orderId/release-to-press` | Release valid schedule | D-03/D-05 |
| `POST /orders/:orderId/production/start` | Accept/start production | Approved transition matrix |
| `PATCH /orders/:orderId/production` | Update quantities/progress/issues | D-02/D-07 |
| `POST /orders/:orderId/production/complete` | Release completed work to Shipping | D-02/D-07 |
| `POST /orders/:orderId/dispatch` | Record dispatch | D-02 |
| `POST /orders/:orderId/delivery` | Confirm delivery/report issue | D-03/D-11 |
| `POST /orders/:orderId/holds` | Place on hold | D-03 |
| `POST /orders/:orderId/holds/:holdId/resolve` | Resolve/reassign/cancel/re-review | D-03 |
| `POST /orders/:orderId/rework` | Request/route rework | D-06 |

Paths and payload schemas are technical proposals, not new business scope. OpenAPI generation is deferred until the blocked fields and actions are approved.

## Initial PostgreSQL Model

| Entity | Purpose | Key relationships/invariants |
|---|---|---|
| `users` | Production identities | Identity-provider key; active state |
| `roles` | Approved application roles | Unique role code |
| `user_roles` | Role assignment | User-to-role; administration pending D-10 |
| `orders` | Shared order record/current workflow state | Unique order number; current stage/status/owner; concurrency version |
| `order_revisions` | Approved order-data revisions | Belongs to order; revision policy pending |
| `technical_reviews` | R&D decisions/evidence references | Belongs to order and reviewer |
| `planning_reviews` | Material, capacity, press, schedule | Belongs to order; shortage fields conditional |
| `production_runs` | Production execution and quantities | Belongs to order/press; completion gate |
| `production_issues` | Production exceptions | Belongs to production run/order |
| `shipments` | Dispatch and delivery lifecycle | Belongs to order; delivered evidence gate |
| `delivery_issues` | Delivery exceptions | Belongs to shipment/order |
| `attachments` | Document metadata and protected storage reference | Belongs to order and optional domain record/revision |
| `holds` | Hold ownership, target, resolution | Belongs to order; only open hold rules to prove |
| `rework_cases` | Rework route and outcome | Belongs to order; route pending D-06 |
| `notifications` | Alert lifecycle | Related order; active/resolved state |
| `notification_recipients` | Per-recipient read state | Notification and user/role recipient |
| `audit_events` | Append-only workflow history | Order, actor, action, previous/new state, reason, timestamp |
| `production_lines` | Assignable press/line master data | Ownership/configuration pending D-15 |

## Transaction and Integrity Plan

1. Use PostgreSQL constraints for identifiers, foreign keys, required persisted values, and non-negative quantities.
2. Lock or version-check the order during commands to prevent stale concurrent transitions.
3. Commit domain record changes, current order state, notifications, and audit event in one transaction where they form one business action.
4. Do not update/delete audit events through application APIs.
5. Keep attachment binary storage outside assumptions until D-11; store only protected references when approved.
6. Use ordered migrations and forward-recovery/rollback checks against an isolated Neon development branch.

## Proposed Migration Order

1. Identity and roles.
2. Orders and revisions.
3. Technical and planning reviews.
4. Production and issues.
5. Shipping and delivery issues.
6. Attachments.
7. Holds and rework.
8. Notifications and recipients.
9. Audit events and supporting indexes.
10. Approved seed/master data for non-production environments.
