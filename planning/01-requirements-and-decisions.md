# Requirements Traceability and Decisions

## Status Key

- `Ready for gap check`: the BRD defines enough behavior for Step 2 comparison.
- `Partial`: some behavior is defined, but an approved detail is missing.
- `Blocked`: implementation depends on a BRD Section 19 decision.

## Must Requirement Traceability

| Requirement | Screen / UI surface | API boundary | Main data | Verification | Business owner | Status |
|---|---|---|---|---|---|---|
| FR-001 | Role workspace layout | Session/me and role queue | User, Role | Authorized user sees role workspace | Technical lead | Ready for gap check |
| FR-002 | Role-specific actions | Authorization on every command/query | Role, Permission | Cross-role negative tests | Technical lead | Blocked: permission matrix approval |
| FR-003 | Demo role selector notice | None; prototype only | None | Production build has no security reliance on switcher | Technical lead | Ready for gap check |
| FR-004 | Login and administration | PostgreSQL-backed authentication and user/role administration | User profile, Auth account, Auth session, Role | Register, login, session, logout, disabled user, role change | Technical lead | Authentication complete; role administration pending |
| FR-005 | Timeline/activity | All workflow commands | Audit event, User | Actor is retained for each important action | Operations representative | Ready for gap check |
| FR-006 | Login and registration | `/api/v1/auth/register` and `/api/v1/auth/login` | User profile, Auth account, Auth session | Real register/login pass; registration cannot self-assign a role | Technical lead | Complete |
| FR-010 | Create order | Create draft | Order | CSR creates a draft | Operations representative | Ready for gap check |
| FR-011 | CSR dashboard/order form | Get and update draft | Order | CSR resumes and edits draft | Operations representative | Ready for gap check |
| FR-012 | Create order form | Create/update draft | Order, Attachment | Approved fields persist correctly | Business owner | Blocked: final field approval |
| FR-013 | All forms | Request validation | Validation rules | Missing/invalid fields return actionable errors | Technical lead | Partial: field rules pending |
| FR-014 | Create/order detail | Submit order | Order, Audit event | Valid draft enters R&D Review | Operations representative | Ready for gap check |
| FR-015 | CSR dashboard | CSR order query | Order, Clarification | Queue shows required columns and clarification | Operations representative | Ready for gap check |
| FR-017 | Form/documents/order detail | Attachment create/read | Attachment, Revision | File remains linked to correct order/revision | Technical lead | Blocked: storage and retention rules |
| FR-020 | R&D work queue | R&D queue query | Order | Only actionable reviews appear | Operations representative | Ready for gap check |
| FR-021 | R&D review | Order and attachment queries | Order, Attachment | Reviewer can inspect required context | Operations representative | Ready for gap check |
| FR-022 | R&D review/actions | R&D decision commands | Technical review, Hold | Approve, clarify, reject, hold permission tests | Business owner | Partial: rejection/re-entry authority pending |
| FR-023 | R&D review/timeline | Record R&D decision | Technical review, Audit event, Attachment | Reviewer, timestamp, comments, evidence persist | Operations representative | Ready for gap check |
| FR-024 | R&D stage gate | Transition validation | Order, Technical review | Planning transition fails without approval | Technical lead | Ready for gap check |
| FR-030 | Planning queue | Planning queue query | Order | Only technically approved orders appear | Operations representative | Ready for gap check |
| FR-031 | Planning form | Record material readiness | Planning review | Availability/shortage persists | Operations representative | Ready for gap check |
| FR-032 | Planning form | Record shortage | Planning review, Hold | Shortage requires reason and expected date | Operations representative | Ready for gap check |
| FR-033 | Planning form | Assign and schedule | Planning review, Production line | Press and planned date persist | Operations representative | Ready for gap check |
| FR-034 | Planning form | Update planning review | Planning review | Notes and capacity/readiness persist | Operations representative | Ready for gap check |
| FR-035 | Planning stage gate | Release validation | Order, Planning review, Exception | Block release unless checks/approved exception pass | Business owner | Partial: exception authority pending |
| FR-036 | Planning actions | Release to Press | Order, Audit event | Valid release appears in Press queue | Operations representative | Ready for gap check |
| FR-040 | Press queue | Press queue query | Order, Production run | Scheduled jobs appear | Operations representative | Ready for gap check |
| FR-041 | Production update | Accept/start commands | Production run, Audit event | Press accepts and starts scheduled job | Operations representative | Ready for gap check |
| FR-042 | Production update | Pause/hold commands | Production run, Hold | Permission and state tests | Business owner | Blocked: hold authority approval |
| FR-043 | Production update | Update production run | Production run, Attachment | Required quantities/times/issues persist | Operations representative | Partial: applicable field rules pending |
| FR-044 | Production update/rework | Report issue/request rework | Production issue, Rework | Issue and evidence persist with history | Business owner | Blocked: rework owner/approval/return stage |
| FR-045 | Production stage gate | Complete/release validation | Production run, Order | Shipping release fails until completion requirements pass | Technical lead | Partial: completion evidence rules pending |
| FR-050 | Shipping queue | Shipping queue query | Order, Shipment | Completed orders appear | Operations representative | Ready for gap check |
| FR-051 | Shipping action | Confirm readiness | Shipment | Readiness is recorded before dispatch | Operations representative | Ready for gap check |
| FR-052 | Dispatch form | Dispatch command | Shipment, Audit event | Approved shipment fields persist | Business owner | Partial: final field approval |
| FR-053 | Delivery form | Confirm delivery/attach proof | Shipment, Attachment | Delivery and proof are associated to order | Operations representative | Ready for gap check |
| FR-054 | Delivery form | Report delivery issue | Delivery issue, Attachment | Issue blocks normal closure and remains visible | Operations representative | Ready for gap check |
| FR-055 | Delivery stage gate | Delivery validation | Shipment, Attachment, Exception | Delivered transition fails without evidence/exception | Business owner | Partial: alternative evidence exception pending |
| FR-060 | Unified order detail | Order detail query | All order aggregates | Authorized user sees unified record | Technical lead | Ready for gap check |
| FR-061 | Order header/progress | Order detail query | Order | Stage, status, owner, next action display | Operations representative | Ready for gap check |
| FR-062 | Activity timeline | Audit query | Audit event | Required event categories are date-stamped | Operations representative | Ready for gap check |
| FR-063 | Activity timeline | Workflow command/audit query | Audit event, User | Actor and decision details cannot be omitted | Technical lead | Ready for gap check |
| FR-064 | Documents/revisions | Attachment queries | Attachment, Revision | Correct document and revision association | Technical lead | Blocked: revision/retention rules |
| FR-065 | All protected screens | Query authorization | Role, Permission | Unauthorized record/activity access denied | Technical lead | Blocked: access policy approval |
| FR-070 | Hold dialog | Create hold | Hold, Order | Category/reason required and status changes | Operations representative | Ready for gap check |
| FR-071 | Hold resolution | Create/update hold | Hold | Owner, target date, corrective action captured | Operations representative | Ready for gap check |
| FR-072 | Hold/rework resolution | Resolve/reassign/cancel/re-review commands | Hold, Rework, Audit event | Allowed action and destination tests | Business owner | Blocked: exact authority and routing rules |
| FR-073 | Alert/notification center | Notification creation/query | Notification, Hold | Owner and Manager receive hold alert | Operations representative | Ready for gap check |
| FR-075 | Timeline | Resolve hold/rework | Audit event, Hold, Rework | Resolved history remains visible | Operations representative | Ready for gap check |
| FR-080 | Manager dashboard | Stage/status aggregate | Order | Counts reconcile to underlying orders | Manager/Supervisor | Ready for gap check |
| FR-081 | Manager dashboard | Team workload query | Order | Team workload drills into orders | Manager/Supervisor | Ready for gap check |
| FR-082 | Dashboard risk views | Ageing/risk query | Order, Hold, Shipment | Approved threshold calculations identify risks | Manager/Supervisor | Blocked: SLA/target definitions |
| FR-084 | Dashboard links | Order detail query | Order | Every aggregate/risk links to permitted orders | Manager/Supervisor | Ready for gap check |

## Business Rule Traceability

| Rule | Enforcement location | Verification | Status |
|---|---|---|---|
| BR-001 | Database unique order identifier and backend creation | Duplicate identifier rejected | Ready for gap check |
| BR-002 | Backend transition service and database transaction | Invalid stage progression rejected | Ready for gap check |
| BR-003 | Backend command context and audit record | Actor/time/reason recorded atomically | Ready for gap check |
| BR-004 | Hold queries and Manager/owner queues | Open hold remains visible | Ready for gap check |
| BR-005 | Planning release guard | Shortage blocks release | Partial: approved exception undefined |
| BR-006 | Production completion guard | Missing output data blocks completion | Partial: exact required fields pending |
| BR-007 | Shipment foreign key to order | Orphan dispatch/delivery rejected | Ready for gap check |
| BR-008 | Delivery guard | Missing evidence blocks Delivered | Partial: approved exception undefined |
| BR-009 | Append-only audit and rework record | Prior history survives rework | Ready for gap check |
| BR-010 | Backend query/command authorization | Positive and negative permission tests | Blocked: access matrix approval |
| BR-011 | Frontend demo-only notice; no production authorization use | Role switch cannot grant backend access | Ready for gap check |
| BR-012 | Transition policy | Cancellation/reopen/reject/re-review/rollback tests | Blocked: rules require approval |

## Applicable Non-Functional Requirements

| Requirement | Planned evidence | Status |
|---|---|---|
| NFR-001 | Availability design and operational test | Blocked: target pending |
| NFR-002 | Queue/detail performance test | Blocked: load and response target pending |
| NFR-003 | Desktop/tablet viewport checks | Partial: tablet widths and mobile need pending |
| NFR-004 | Keyboard, focus, labels, contrast, status-label checks | Ready for gap check |
| NFR-005 | Authentication and server authorization tests | Authentication complete; workflow authorization pending permission approval |
| NFR-006 | Record/action access tests | Blocked: access policy pending |
| NFR-007 | Audit immutability and unauthorized update tests | Ready for design proof |
| NFR-008 | Attachment type/size/access tests | Blocked: limits/storage pending |
| NFR-009 | Validation, failure, and draft-preservation tests | Ready for design proof |
| NFR-010 | Backup/recovery/retention exercise | Blocked: targets pending |
| NFR-011 | Module/component boundary review | Ready for design proof |
| NFR-012 | Structured logging and failed-action diagnostics | Partial: monitoring platform pending |

## Open Decision Register

All entries originate in BRD Section 19. Owners are accountable approval roles from the BRD approval section, not answers to the decisions.

| ID | Decision | Accountable owner | Status | Blocks |
|---|---|---|---|---|
| D-01 | Requestor and CSR relationship | Business owner | Pending | Role model and permissions |
| D-02 | Mandatory fields/documents by order type | Operations representative | Pending | Forms, validation, stage gates |
| D-03 | Approve/reject/hold/reopen/cancel authority by stage | Business owner | Pending | Permission and transition matrices |
| D-04 | Rejected order resubmission and destination | Business owner | Pending | R&D exception path |
| D-05 | Material shortage workflow and verification | Operations representative | Pending | Planning release rules |
| D-06 | Rework route and production re-entry approval | Business owner | Pending | Rework implementation |
| D-07 | QA as stage or Press responsibility | Business owner | Pending | Status model and completion gate |
| D-08 | SLAs, calendars, escalation rules | Operations representative | Pending | Manager risks and notifications |
| D-09 | Standalone/manual or required integrations | Business owner | Pending | Integration scope |
| D-10 | PostgreSQL-backed email/password authentication; detailed user administration | Technical lead | Authentication selected and implemented; administration pending | Role administration only |
| D-11 | File limits and document/audit retention | Business owner | Pending | Attachments and retention |
| D-12 | Mobile requirement for Press/Shipping | Operations representative | Pending | Responsive scope |
| D-13 | Notification channels | Business owner | Pending | Notification delivery design |
| D-14 | Availability, performance, backup, recovery targets | Technical lead | Pending | NFR acceptance |
| D-15 | Configuration, master data, production support ownership | Project owner | Pending | Operations model |
