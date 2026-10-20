# Manufacturing Order Workflow UI Action Plan

## Document Information

| Field | Value |
|---|---|
| Document purpose | Client demonstration planning and UI approval |
| Use case | Printed food packaging order |
| Current process | Manual cross-functional production workflow |
| Proposed solution | Role-based web workflow application |
| Roles in demonstration | Requestor/CSR, R&D Experts, Planning, Press, Shipping |
| Status | Approved and implemented as a client demonstration prototype |
| Output folder | `5star flow` |

> **Current implementation usage:** This document records the historical
> prototype. It is not a production UI blueprint. Production functionality
> and workflow follow `../Flowline_Manufacturing_BRD.md`. Consult this
> wireframe only when the user requests a specific visual element, and reuse
> only that element rather than recreating a full screen or layout.

## 1. Purpose

This document defines the proposed action plan, workflow, screens, pain-point coverage, and demonstration approach for converting a manual production order process into a modern web application.

The initial demonstration will use a printed food packaging order, such as a new snack-pouch order, because it clearly shows technical review, material planning, production, and delivery activities.

## 2. Business Context

### 2.1 Current State

[SOURCE:INPUT]

The client currently manages the production request process manually across multiple teams.

Basis: The stakeholder stated that the existing client process is manual.

Typical consequences of this operating model may include:

- Information distributed across emails, spreadsheets, calls, paper, or individual records.
- Repeated follow-ups to determine the current order status.
- Delayed handoffs between departments.
- Unclear ownership of pending activities.
- Missing or incomplete information reaching downstream teams.
- Limited visibility into order age, holds, and production delays.
- Difficulty proving who approved a decision and when it was approved.

These pain points are working assumptions for the client demonstration and must be validated during discovery.

### 2.2 Proposed Future State

[SOURCE:INPUT]

Provide a web application that supports the Requestor/CSR, R&D Experts, Planning, Press, and Shipping workflow.

Basis: These roles and the request for a web-based replacement were identified by the stakeholder.

[SOURCE:INFERRED]

The application should provide centralized order records, controlled handoffs, role-based queues, approval evidence, exception handling, and end-to-end progress visibility.

Basis: These capabilities address common coordination and traceability gaps in manual production workflows.

## 3. Business Objectives

1. Replace disconnected manual tracking with one shared order workspace.
2. Show the current order stage, status, owner, and next required action.
3. prevent downstream work from starting before required information or approvals are complete.
4. Reduce repeated calls, emails, and manual follow-ups between teams.
5. Record approval, hold, rework, dispatch, and delivery evidence.
6. Provide management visibility into workload, aging, bottlenecks, and SLA risk.
7. Demonstrate a credible and expandable solution that supports client acquisition discussions.

## 4. Proposed Demonstration Use Case

### 4.1 Scenario

A customer requests a new printed snack pouch. The CSR records the order request and product requirements. R&D reviews technical feasibility. Planning checks materials and production capacity. The Press team records production progress and exceptions. Shipping dispatches the completed order and records delivery confirmation.

### 4.2 Simplified Workflow

1. CSR creates and submits the order request.
2. R&D reviews technical specifications and records a feasibility decision.
3. Planning confirms material availability, capacity, and target production date.
4. Press accepts the scheduled job and updates production status.
5. Shipping confirms readiness, dispatch, and delivery.
6. All roles can review the shared order timeline according to their permissions.

### 4.3 Main Order States

- Draft
- Submitted
- R&D Review
- Planning Review
- Scheduled
- In Production
- Ready to Ship
- Dispatched
- Delivered
- On Hold
- Rework Required
- Cancelled

## 5. Role Responsibilities

| Role | Primary responsibility | Main web application actions |
|---|---|---|
| Requestor/CSR | Capture the customer request and coordinate clarifications | Create, edit, submit, attach documents, respond to clarification, track status |
| R&D Experts | Validate product and production feasibility | Review specification, request clarification, approve, reject, or place on hold |
| Planning | Confirm materials, capacity, and schedule | Review readiness, record shortage, assign schedule, release to production |
| Press | Execute and report the press production stage | Accept job, start work, update quantity, report issue, complete production |
| Shipping | Prepare dispatch and confirm delivery | Verify readiness, enter shipment details, dispatch, upload proof of delivery |
| Manager/Supervisor | Monitor operations and resolve escalations | View workload, delays, holds, SLA risks, and order history |

## 6. Proposed UI Screens

### 6.1 Login and Demonstration Role Selector

Purpose:

- Allow the presenter to switch between CSR, R&D, Planning, Press, Shipping, and Manager views.
- Demonstrate how each user sees a focused workspace.

Important elements:

- User identity and role.
- Role switcher for prototype demonstration only.
- Clear notice that production access will use authentication and authorization.

### 6.2 CSR Dashboard

Purpose:

- Show requests created by the CSR.
- Highlight drafts, clarification requests, holds, and recently completed orders.

Important elements:

- New Order primary action.
- My Requests queue.
- Pending Clarifications queue.
- Status, current stage, owner, requested date, and age.
- Search and filters.

### 6.3 Create New Order

Purpose:

- Capture complete and consistent information before submission.

Candidate fields:

- Customer name.
- Product name and description.
- Order type.
- Packaging type.
- Dimensions and material.
- Print colors.
- Requested quantity.
- Requested delivery date.
- Technical notes.
- Artwork or supporting documents.

UX controls:

- Save Draft and Submit for R&D Review.
- Inline required-field validation.
- Clear error messages.
- File type and size guidance.
- Review summary before submission.

### 6.4 R&D Work Queue

Purpose:

- Provide R&D with an ordered list of requests requiring technical action.

Important elements:

- New assignments.
- Waiting for clarification.
- Approaching target time.
- On-hold requests.
- Product specification summary.
- Priority and age indicators.

### 6.5 R&D Feasibility Review

Purpose:

- Record a structured and auditable feasibility decision.

Actions:

- Approve Feasibility.
- Request Clarification.
- Reject as Not Feasible.
- Place on Hold.

Candidate evidence:

- Review checklist.
- Technical comments.
- Tooling requirements.
- Material recommendation.
- Risk or constraint.
- Attachments.
- Reviewer and decision timestamp.

### 6.6 Planning Work Queue

Purpose:

- Show technically approved orders waiting for material and capacity planning.

Important elements:

- Required-by date.
- Material readiness.
- Capacity status.
- Technical approval evidence.
- Planning age.
- Scheduling conflict indicator.

### 6.7 Material and Capacity Planning

Purpose:

- Confirm whether the order is ready to enter production.

Actions:

- Confirm Materials Available.
- Record Material Shortage.
- Assign Press and Schedule.
- Return for Clarification.
- Release to Press.

Candidate fields:

- Planned production date.
- Assigned production line or press.
- Material availability.
- Shortage reason.
- Expected material date.
- Planning notes.

### 6.8 Press Work Queue

Purpose:

- Present scheduled production jobs in a clear operational order.

Important elements:

- Scheduled date and priority.
- Job specification.
- Material readiness.
- Planned and completed quantities.
- Current status.
- Delayed or blocked jobs.

### 6.9 Press Production Update

Purpose:

- Capture meaningful production progress without creating unnecessary data-entry work.

Actions:

- Accept Job.
- Start Production.
- Pause or Place on Hold.
- Report Production Issue.
- Complete Production.

Candidate fields:

- Start and completion time.
- Planned quantity.
- Good quantity.
- Waste quantity.
- Issue category.
- Corrective notes.
- Supporting attachment.

### 6.10 Shipping Work Queue

Purpose:

- Show completed orders awaiting packing, dispatch, or delivery confirmation.

Important elements:

- Customer and destination.
- Quantity ready.
- Requested delivery date.
- Production completion evidence.
- Dispatch readiness status.

### 6.11 Dispatch and Delivery Confirmation

Purpose:

- Record shipment information and close the physical order lifecycle.

Actions:

- Confirm Ready to Ship.
- Dispatch Order.
- Confirm Delivery.
- Report Delivery Issue.

Candidate fields:

- Carrier.
- Vehicle or tracking number.
- Dispatch date and time.
- Quantity shipped.
- Delivery destination.
- Expected delivery.
- Actual delivery.
- Proof of delivery attachment.

### 6.12 Unified Order Detail and Timeline

Purpose:

- Provide one trusted view of the entire order.

Important elements:

- Order summary.
- Current stage and owner.
- Next required action.
- Stage progress tracker.
- Documents and revisions.
- Comments and mentions.
- Decisions and approvals.
- Hold and rework history.
- Date-stamped audit timeline.

### 6.13 Hold and Rework Resolution

Purpose:

- Prevent exceptions from being managed through disconnected manual communication.

Important elements:

- Hold category and reason.
- Team responsible for resolution.
- Required corrective action.
- Target resolution date.
- Supporting evidence.
- Resolve, reassign, cancel, or send for re-review actions.

### 6.14 Manager Overview Dashboard

Purpose:

- Provide operational visibility without requiring managers to contact every team.

Important elements:

- Orders by stage and status.
- Workload by team.
- Orders approaching or exceeding target time.
- Average stage age.
- Holds by reason.
- Delayed shipments.
- Search, date filters, and team filters.

## 7. Pain-Point-to-Solution Mapping

| Manual process pain area | Proposed web solution | Business value |
|---|---|---|
| Teams cannot easily identify the current order status | Shared stage tracker and order timeline | Faster status visibility |
| Ownership is unclear | Named owner and role-based work queue | Clear accountability |
| Handoffs depend on calls or email | Automatic next-stage assignment and notification | Reduced coordination effort |
| Incomplete information reaches downstream teams | Required fields and submission validation | Less clarification and rework |
| Approvals are difficult to prove | Structured decision, named approver, timestamp, and comments | Improved auditability |
| Holds are tracked informally | Hold reason, owner, target date, and resolution workflow | Faster exception resolution |
| Hold owners and managers learn about exceptions late | Role-routed hold alerts, urgent dashboard banner, and notification center | Faster acknowledgement and intervention |
| Managers discover delays late | Aging indicators, SLA warnings, and bottleneck dashboard | Earlier intervention |
| Production updates are inconsistent | Standard operational status actions | Reliable progress reporting |
| Delivery evidence is separated from the order | Shipment data and proof of delivery in the order record | Complete lifecycle traceability |

## 8. UX Design Principles

The prototype will apply the following principles:

- Use plain business language instead of technical terminology.
- Present one clear primary action on each task screen.
- Show the current status, owner, and next action without requiring interpretation.
- Use labels as well as color so status remains accessible.
- Validate input before submission and explain how to correct errors.
- Allow users to save drafts and safely return to unfinished work.
- Keep critical context visible when making approval or hold decisions.
- Provide search and filters for users handling large queues.
- Maintain consistent page structure across all roles.
- Support keyboard access, readable contrast, and responsive layouts.

Target UX heuristic score: 10/10 after implementation and validation.

## 9. Client Demonstration Story

The demonstration will follow one order through the complete journey:

1. Show the CSR creating a new snack-pouch order.
2. Switch to R&D and approve technical feasibility.
3. Switch to Planning and schedule the order.
4. Switch to Press and record production completion.
5. Switch to Shipping and confirm dispatch and delivery.
6. Open the order timeline to show the complete audit history.
7. Demonstrate one exception, such as a material shortage or production hold.
8. Open the manager dashboard to show workload and delay visibility.

The presentation should emphasize:

- How the web app replaces manual follow-up.
- How stage gates prevent premature work.
- How every team sees only relevant actions.
- How delays and holds become visible.
- How management receives reliable operational information.

## 10. Proposed Deliverables After Approval

The following files will be created inside the `5star flow` folder:

- Clickable role-based HTML prototype.
- Shared responsive CSS styling.
- JavaScript for demonstration workflow interactions.
- Sample food packaging order data.
- Connected workflow/stage view.
- Prototype presentation instructions.

No production backend, real authentication, external system integration, or permanent data storage is included in this wireframe phase unless separately approved.

## 11. Validation Approach

After the UI screens are created, validation will include:

- Verify the complete CSR-to-delivery happy path.
- Verify hold and resolution behavior.
- Verify hold alerts reach the selected resolution owner and Manager independently.
- Verify unread counts, read actions, order navigation, and alert closure after resolution.
- Verify that each role sees the correct work queue and actions.
- Verify that users cannot progress past required stage gates.
- Verify search, filters, validation, and status updates.
- Verify responsive behavior for desktop and tablet widths.
- Review accessibility basics, including labels, focus, keyboard use, and contrast.
- Review the prototype against the agreed action plan.

## 12. Decisions Required Before Production Design

The wireframe can use demonstration assumptions, but the following decisions are required before production implementation:

1. Confirm whether Requestor and CSR are the same role.
2. Confirm mandatory order fields and document types.
3. Confirm who can approve, reject, hold, reopen, or cancel at each stage.
4. Confirm the exact R&D rejection and re-review path.
5. Confirm material-shortage and production-rework paths.
6. Confirm whether QA is included in a later phase or handled within Press completion.
7. Confirm SLA definitions and escalation rules.
8. Confirm whether data will be entered manually or integrated with ERP and other systems.
9. Confirm document retention, audit, and access requirements.
10. Confirm whether mobile support is required for Press and Shipping users.

## 13. Approval Gate

UI implementation will begin only after the stakeholder confirms:

- The printed food packaging use case is suitable for the demonstration.
- The five-role workflow is correct for the first prototype.
- The listed screens are sufficient for the client presentation.
- The hold/rework exception should be included.
- The manager dashboard should be included.

Approval status: Approved. Prototype implemented on 17 October 2026. Role-routed hold notifications and urgent dashboard alerts were added and validated on 17 October 2026.
