# Screens, Components, Fields, and Validation

## Logical Screen Map

| BRD screen | Proposed route/surface | Reusable building blocks | Status |
|---|---|---|---|
| 1. Login / registration | `/login` and `/register`; the demo role selector remains prototype-only | Shared auth layout, validated fields, password visibility control | Complete; pending accounts await administrator role assignment |
| 2. CSR dashboard | `/dashboard` and `/dashboard/orders` | Analytics, owned queue, search/status filters, detail/activity tabs | Complete |
| 3. Create new order | `/dashboard/orders/new` and `/dashboard/orders/:id/edit` | Draft form, core submission gate, active R&D reviewer assignment, PostgreSQL attachments, toasts | Complete |
| 4. R&D work queue | `/orders` with R&D workspace | Shared queue, priority/age indicators | Ready for gap check |
| 5. R&D feasibility review | Order detail action panel | Detail summary, decision form, evidence control | Partial; rejection path blocked |
| 6. Planning work queue | `/orders` with Planning workspace | Shared queue, readiness labels | Ready for gap check |
| 7. Material/capacity planning | Order detail action panel | Planning form, shortage dialog, stage gate message | Partial; D-05 |
| 8. Press work queue | `/orders` with Press workspace | Shared queue, job status labels | Ready for gap check |
| 9. Press production update | Order detail action panel | Production form, issue/rework dialog | Partial; D-06/D-07 |
| 10. Shipping work queue | `/orders` with Shipping workspace | Shared queue, readiness labels | Ready for gap check |
| 11. Dispatch/delivery | Order detail action panel | Shipment form, delivery form, evidence control | Partial; D-11 |
| 12. Unified detail/timeline | `/orders/:orderId` | Order header, progress tracker, tabs, documents, timeline | Ready for gap check |
| 13. Hold/rework resolution | Order detail dialog/panel | Exception summary, assignment, evidence, history | Blocked by D-03/D-06 |
| 14. Manager dashboard | `/dashboard` with Manager workspace | Shared role-aware shell, live metrics, queue, filters | Core dashboard complete; SLA/risk definitions blocked by D-08 |

## Shared Frontend Boundaries

- `AppShell`: authenticated navigation, user identity, notification access.
- `RoleWorkspace`: heading, primary action, metrics, queue composition.
- `OrderQueue`: search, filters, count, loading/empty/error states, order rows.
- `OrderStatus`: text plus accessible visual treatment.
- `OrderDetailHeader` and `StageProgress`: current state, owner, next action.
- `ActionDialog` and field controls: consistent validation and submission states.
- `AttachmentControl`: approved type/size guidance and upload state.
- `ActivityTimeline`: immutable events, actor, timestamp, decision details.
- `HoldAlert` and `NotificationCenter`: unread state and order navigation.
- `ManagerOverview`: metrics, team/date filters, risks, drill-through.

These are functional boundaries derived from the BRD, not approval to reproduce the wireframe layout. Wireframe styling may be used only for the exact element requested by the user at implementation time.

## Field and Validation Dictionary

Fields labelled `Candidate` are explicitly subject to BRD approval. Implementation remains blocked until D-02/D-11 resolves applicable details.

### Order

| Field | BRD rule | Validation state |
|---|---|---|
| Order identifier | Unique | Required; server-generated format pending technical design |
| Customer name | Candidate order field | Candidate required field |
| Destination | Order data requirement | Candidate; required by dispatch at latest |
| Product name/description | Candidate order field | Candidate required field |
| Order type | Candidate order field | Candidate; option set pending |
| Packaging type | Candidate order field | Candidate required field |
| Dimensions | Candidate order field | Candidate format pending |
| Material | Candidate order field | Candidate required field |
| Print colors | Candidate order field | Candidate format/range pending |
| Requested quantity | Candidate order field | Candidate positive quantity |
| Requested delivery date | Candidate order field | Candidate valid date/business rule pending |
| Technical notes | Candidate order field | Candidate length pending |
| Artwork/supporting files | Candidate order field | Type, size, count, retention pending D-11 |
| Status/stage/owner/priority | System workflow data | Controlled values; transition/priority rules pending |

### Technical Review

| Field | Validation state |
|---|---|
| Reviewer, decision, timestamp | Required for a recorded decision |
| Technical comments | Required where approved decision rule requires them |
| Feasibility checklist | Candidate; checklist items pending |
| Tooling/material recommendation, constraints/risks | Candidate/applicable rules pending |
| Evidence attachment | Applicable requirement pending D-02/D-11 |

### Planning

| Field | Validation state |
|---|---|
| Material availability/readiness | Required before release |
| Shortage reason and expected date | Required when shortage is selected |
| Assigned press/line and planned date | Required before scheduled release |
| Planning notes, capacity/readiness | Required/applicable details pending D-02/D-05 |

### Production

| Field | Validation state |
|---|---|
| Start/completion timestamps | Required at corresponding actions |
| Planned, good, waste quantities | Non-negative; completion relationship/tolerance pending |
| Production status | Controlled by transitions |
| Issue category, corrective notes, evidence | Required when an issue/rework is reported; categories pending |

### Shipping and Delivery

| Field | Validation state |
|---|---|
| Carrier and tracking/vehicle number | Candidate required dispatch fields |
| Dispatch time, shipped quantity, destination, expected delivery | Candidate required dispatch fields; quantity rule pending |
| Actual delivery time/status | Required for delivery confirmation |
| Proof of delivery | Required unless approved alternative exists; D-11 |
| Delivery issue details/evidence | Required when issue reported; categories pending |

### Audit, Hold, Rework, Notification

| Field | Validation state |
|---|---|
| Actor, action, timestamp, previous/new status | Required for important workflow changes |
| Reason/comments | Required where action semantics require them |
| Hold category/reason/owner/target/corrective action | Category, reason, owner, target required; corrective action as applicable |
| Hold resolution | Required to close hold |
| Rework reason/owner/re-review stage/evidence | Required values/routing pending D-06 |
| Notification recipient/order/created/read/resolved/status | Required according to alert lifecycle |

## Common Validation Response

The UI must identify the field and correction. The API must reject invalid input without partial workflow progression and return a stable error code plus field-level messages. Exact error schema is proposed in the API draft and must be proven in Step 3.
