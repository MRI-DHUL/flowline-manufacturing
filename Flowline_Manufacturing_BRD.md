# Business Requirements Document (BRD)

## Flowline -- Manufacturing Order Management System

**Document version:** 1.1\
**Prepared on:** 20 October 2026\
**Source:** `5star flow 3.zip` --- wireframe prototype and
`Workflow_UI_Action_Plan.md`\
**Document status:** Draft for stakeholder review\
**Business use case:** Printed food packaging order (example: printed
snack pouch)

------------------------------------------------------------------------

## 1. Executive Summary

Flowline is a proposed role-based web application intended to digitize
the manufacturing order lifecycle from initial customer request through
technical feasibility, material and capacity planning, production,
dispatch, and delivery confirmation.

The source wireframe describes a currently manual, cross-functional
process. Flowline will provide a centralized order record, role-specific
work queues, controlled stage handoffs, exception handling,
notifications, and an order activity timeline. A manager dashboard will
make workload, ageing, holds, and delivery risks visible.

This BRD captures business requirements and proposed scope based on the
supplied wireframe and action plan. Items explicitly described as
candidate fields, assumptions, or decisions required must be validated
with stakeholders before production implementation.

## 2. Document Purpose

This document defines: - Business context, objectives, scope,
stakeholders, and user roles. - The proposed end-to-end workflow and
order lifecycle. - Functional and non-functional requirements. -
Screen/page inventory and key capabilities. - Business rules, exception
paths, reporting needs, assumptions, dependencies, risks, and acceptance
criteria. - Decisions that require stakeholder confirmation before
production design.

It is intended to align business stakeholders, UX/UI designers,
developers, QA, and project owners before detailed user stories and
technical design are prepared.

### 2.1 Current Implementation Direction

This BRD controls production functionality and workflow. The supplied
wireframe remains a historical demonstration and a selective visual
reference; it must not be recreated or treated as a full-screen design
blueprint. The wireframe may be consulted only when the project owner
requests a specific visual element, such as its color theme, card,
dropdown, or stepper design. Only that requested element may be reused.

## 3. Business Context and Problem Statement

### 3.1 Current State

The client process is described in the source action plan as manual and
cross-functional. Requests and updates may be distributed across email,
spreadsheets, calls, paper, or individual records. The following pain
points are working assumptions and should be confirmed during discovery:

-   Teams cannot quickly determine the latest order status.
-   Ownership of pending actions may be unclear.
-   Handoffs depend on manual follow-up.
-   Incomplete information may reach downstream teams.
-   Approval, hold, and rework decisions may be difficult to trace.
-   Managers may discover delays and bottlenecks late.
-   Production and delivery evidence may be stored separately from the
    order.

### 3.2 Proposed Future State

Flowline will maintain a shared order record and a controlled workflow.
Each role will see its relevant queue and actions. Required information
and stage gates will help prevent premature progression. Decisions,
comments, status changes, holds, rework, shipment details, and delivery
evidence will be associated with the order.

## 4. Business Objectives and Expected Outcomes

1.  Replace disconnected manual order tracking with a centralized
    workspace.
2.  Make the current order stage, status, owner, and next action
    visible.
3.  Ensure required data and approvals are captured before downstream
    work begins.
4.  Reduce repeated calls, emails, and manual follow-ups between teams.
5.  Record decisions, holds, rework, dispatch, and delivery evidence.
6.  Give managers visibility into workload, ageing, bottlenecks, and
    delay risks.
7.  Standardize production and shipping status updates.
8.  Provide a scalable foundation for future integrations and
    operational improvements.

### 4.1 Suggested Success Measures

Baseline values and targets must be agreed with the client. Suggested
measures are: - Average time from order submission to feasibility
decision. - Average time spent in each workflow stage. - Percentage of
orders with complete information at first submission. - Number of
clarification loops per order. - Number and age of open holds/rework
cases. - On-time production and delivery rate. - Percentage of orders
with complete approval and delivery evidence. - Time required for a user
or manager to identify current order status and owner.

## 5. Proposed Technology Stack and Hosting

The following technology stack is specified by the project owner and is the baseline for implementation. Detailed versions, deployment services, and supporting libraries will be selected during technical design.

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React | Build the role-based user interface, dashboards, forms, work queues, and order timeline. |
| Styling | Tailwind CSS | Provide consistent, responsive styling and reusable UI patterns. |
| Backend | Node.js | Implement server-side business logic, workflow transitions, validation, authorization, and API endpoints. |
| Database | PostgreSQL | Store orders, users/roles, workflow states, reviews, planning, production, shipping, notifications, and audit records. |
| Database hosting | Neon (Neon Console) | Host and manage the PostgreSQL database and database branches/environments. The supplied screenshot shows the project `flowline-manufacturing_db` and a `dev` branch. |

### 5.1 Proposed Application Architecture

The React frontend styled with Tailwind CSS will communicate with the Node.js backend through authenticated API requests. The backend will validate requests, enforce role permissions and workflow rules, and read/write application data in the PostgreSQL database hosted on Neon. Database credentials must remain on the server and must never be exposed in frontend code.

**Request flow:** React + Tailwind CSS frontend → Node.js API/backend → PostgreSQL database hosted on Neon.

Neon is the selected database hosting platform; this does not mean the frontend or Node.js backend is hosted on Neon. Their hosting platforms are still to be selected. The screenshot also shows Neon services such as Object Storage, Functions, Realtime, and Better Auth, but these are not automatically in scope. Any use of those services must be explicitly selected during technical design.

## 6. Scope

### 5.1 In Scope

-   Role-based application views for Requestor/CSR, R&D, Planning,
    Press, Shipping, and Manager/Supervisor.
-   Order creation, draft saving, submission, and supporting document
    attachment.
-   Technical feasibility review and structured decision recording.
-   Material availability and capacity planning.
-   Press assignment and production scheduling.
-   Production progress, output, waste, and issue updates.
-   Shipping readiness, dispatch, tracking details, and delivery
    confirmation.
-   Unified order details and activity timeline.
-   Hold and rework workflows.
-   Notifications and urgent hold alerts.
-   Work queues, search, filtering, ageing indicators, and manager
    overview.
-   Input validation and stage-gate controls.
-   Auditability of key workflow actions.

### 5.2 Out of Scope for the Current Wireframe Phase

The source action plan states that the prototype does not include a
production backend, real authentication, external system integrations,
or permanent data storage unless separately approved. Therefore, these
are not assumed to be implemented by the current wireframe.

The following are also not defined as current requirements and need
separate approval if desired: - ERP/MRP integration or automatic
inventory synchronization. - Machine/press telemetry or IoT
integrations. - Customer self-service portal. - Billing, invoicing, or
payment processing. - Quality Assurance (QA) as a separate workflow
stage. - Mobile-specific application. - Automated carrier
integrations. - Advanced analytics or predictive scheduling.

## 7. Stakeholders and User Roles

  -----------------------------------------------------------------------
  Role                    Business responsibility Primary capabilities
  ----------------------- ----------------------- -----------------------
  Requestor / CSR         Capture and coordinate  Create/edit drafts,
                          customer orders         submit orders, attach
                                                  documents, respond to
                                                  clarifications, track
                                                  status

  R&D Expert              Determine technical     Review specifications,
                          feasibility             record technical notes,
                                                  approve, reject,
                                                  request clarification,
                                                  or place on hold

  Planning                Confirm materials,      Check material
                          capacity, and schedule  readiness, record
                                                  shortages, assign
                                                  press, schedule
                                                  production, release to
                                                  Press

  Press                   Execute manufacturing   Accept scheduled jobs,
                          work                    start/pause production,
                                                  record quantities and
                                                  waste, report issues,
                                                  complete production

  Shipping                Dispatch finished goods Verify readiness,
                          and confirm delivery    record shipment data,
                                                  dispatch, confirm
                                                  delivery, attach proof
                                                  of delivery, report
                                                  delivery issues

  Manager / Supervisor    Monitor operations and  View workload, ageing,
                          intervene in exceptions holds, SLA risks,
                                                  delays, and order
                                                  history; review
                                                  exceptions

  System administrator    Maintain access and     Manage users, roles,
  (proposed for           configuration           and configuration,
  production)                                     subject to approved
                                                  access policy
  -----------------------------------------------------------------------

**Decision required:** Confirm whether Requestor and CSR are the same
role. The prototype includes a Manager view; the action plan lists five
operational roles plus Manager/Supervisor.

## 8. End-to-End Business Workflow

### 7.1 Happy Path

1.  **Create request:** Requestor/CSR enters customer and product
    requirements, quantity, requested delivery date, technical notes,
    and attachments.
2.  **Submit:** The system validates required fields and submits the
    order to R&D review.
3.  **Technical review:** R&D reviews the specification and records a
    decision with comments and evidence.
4.  **Planning review:** Once approved, Planning confirms materials and
    capacity, records any shortage, assigns a press, and schedules
    production.
5.  **Release to production:** Planning releases the order only after
    required readiness checks are satisfied.
6.  **Production:** Press accepts the job, starts work, updates
    progress, records good quantity and waste, and reports issues if
    necessary.
7.  **Production completion:** Press completes production and records
    completion evidence.
8.  **Shipping readiness:** Shipping verifies that the order is ready to
    ship.
9.  **Dispatch:** Shipping records carrier/tracking information, shipped
    quantity, dispatch time, and expected delivery.
10. **Delivery confirmation:** Shipping records actual delivery and
    proof of delivery, or records a delivery issue.
11. **Closure and traceability:** The order timeline retains the stage
    history, decisions, comments, and evidence.

### 7.2 Order Statuses

The action plan identifies the following principal states: - Draft -
Submitted - R&D Review - Planning Review - Scheduled - In Production -
Ready to Ship - Dispatched - Delivered - On Hold - Rework Required -
Cancelled

Status transition rules and whether additional statuses are needed must
be confirmed during detailed design.

### 7.3 Exception Paths

**Clarification** - A reviewer requests missing or corrected
information. - The request, owner, comment, and timestamp are
recorded. - CSR updates the order and resubmits it to the appropriate
stage. - The order must not progress until the required clarification is
resolved.

**Rejection** - R&D can mark an order as not feasible. - The decision
and reason are retained. - The business must define whether the order
can be revised and resubmitted or must be cancelled.

**Hold** - An authorized user selects a hold category, reason,
responsible team/owner, and target resolution date. - The order displays
an On Hold status and an alert is routed to the resolution owner and
Manager, consistent with the prototype action plan. - The hold remains
visible until an authorized user records a resolution. - Resolution
returns the order to the appropriate workflow stage or sends it for
re-review, as configured.

**Material shortage** - Planning records the unavailable material,
shortage reason, and expected availability date. - The order remains
blocked from production release until the required readiness condition
is met or an approved exception is recorded.

**Production issue / rework** - Press records the issue category, notes,
and supporting evidence. - The order can be sent for rework while
retaining its audit history. - The business must confirm the rework
owner, required approval, and return stage.

**Delivery issue** - Shipping records the delivery issue and supporting
evidence. - The order must not be marked Delivered until delivery
confirmation requirements are satisfied.

## 9. Functional Requirements

Priority definitions: **Must** = necessary for the first
production-ready release; **Should** = important, but may be phased;
**Could** = optional enhancement. Priorities are proposed and should be
confirmed.

### 8.1 Access and Role-Based Workspaces

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  FR-001                  The application shall   Must
                          provide a               
                          role-appropriate        
                          workspace for each      
                          authorized user.        

  FR-002                  The application shall   Must
                          restrict actions and    
                          data according to       
                          assigned permissions.   

  FR-003                  The demonstration role  Must
                          switcher shall be       
                          treated as              
                          prototype-only and      
                          shall not substitute    
                          for production          
                          authentication.         

  FR-004                  The production solution Must
                          shall support user      
                          identity,               
                          authentication, and     
                          role/permission         
                          administration.         

  FR-005                  The system shall record Must
                          the acting user for     
                          important workflow      
                          decisions and updates.  

    FR-006                  The application shall   Must
                                                    provide login and       
                                                    account registration    
                                                    pages. Registration     
                                                    shall not allow users   
                                                    to assign themselves    
                                                    operational or          
                                                    administrative roles.   
  -----------------------------------------------------------------------

### 8.2 Order Creation and CSR Management

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  FR-010                  CSR shall be able to    Must
                          create an order draft.  

  FR-011                  CSR shall be able to    Must
                          edit and resume an      
                          unsubmitted draft.      

  FR-012                  The order form shall    Must
                          capture customer,       
                          product, packaging,     
                          dimensions/material,    
                          print colors, quantity, 
                          requested delivery      
                          date, technical notes,  
                          and supporting files,   
                          subject to final field  
                          approval.               

  FR-013                  The system shall        Must
                          validate required       
                          fields and explain      
                          validation errors.      

  FR-014                  CSR shall be able to    Must
                          submit an order for R&D 
                          review.                 

    FR-018                  Before submission, CSR Must
                                                    shall assign the order  
                                                    to a specific active    
                                                    R&D user. The system    
                                                    shall retain the        
                                                    assignment in the       
                                                    order audit history.    

  FR-015                  The CSR workspace shall Must
                          show requests, status,  
                          stage, owner, requested 
                          date, age, and pending  
                          clarification.          

  FR-016                  Users shall be able to  Should
                          search and filter       
                          orders they are         
                          permitted to view.      

  FR-017                  The system shall retain Must
                          attachments and         
                          associate them with the 
                          correct order and,      
                          where applicable,       
                          revision.               
  -----------------------------------------------------------------------

### 8.3 R&D Feasibility Review

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  FR-020                  R&D shall have a queue  Must
                          of orders requiring     
                          technical action.       

  FR-021                  R&D shall be able to    Must
                          inspect the order       
                          specification and       
                          relevant attachments.   

  FR-022                  R&D shall be able to    Must
                          approve feasibility,    
                          request clarification,  
                          reject as not feasible, 
                          or place an order on    
                          hold, subject to        
                          permissions.            

  FR-023                  The system shall        Must
                          capture reviewer,       
                          decision, timestamp,    
                          technical comments, and 
                          supporting evidence.    

  FR-024                  The system shall        Must
                          prevent progression to  
                          Planning until the      
                          required feasibility    
                          decision is complete.   
  -----------------------------------------------------------------------

### 8.4 Material and Capacity Planning

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  FR-030                  Planning shall have a   Must
                          queue of technically    
                          approved orders         
                          awaiting planning.      

  FR-031                  Planning shall record   Must
                          material availability   
                          or shortage.            

  FR-032                  For shortages, Planning Must
                          shall be able to record 
                          reason and expected     
                          material date.          

  FR-033                  Planning shall assign a Must
                          production press/line   
                          and planned production  
                          date.                   

  FR-034                  Planning shall record   Must
                          planning notes and      
                          capacity/readiness      
                          status.                 

  FR-035                  The system shall        Must
                          prevent release to      
                          Press unless required   
                          planning checks are     
                          satisfied or an         
                          authorized exception is 
                          recorded.               

  FR-036                  Planning shall release  Must
                          a scheduled order to    
                          the Press queue.        
  -----------------------------------------------------------------------

### 8.5 Production Operations

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  FR-040                  Press shall have a      Must
                          queue of scheduled      
                          production jobs.        

  FR-041                  Press shall be able to  Must
                          accept a job and start  
                          production.             

  FR-042                  Press shall be able to  Must
                          pause production or     
                          place an order on hold, 
                          subject to permissions. 

  FR-043                  Press shall record      Must
                          planned quantity, good  
                          quantity, waste         
                          quantity,               
                          start/completion time,  
                          issue category, notes,  
                          and supporting          
                          attachments as          
                          applicable.             

  FR-044                  Press shall be able to  Must
                          report production       
                          issues and request      
                          rework.                 

  FR-045                  The system shall        Must
                          prevent release to      
                          Shipping until          
                          production completion   
                          requirements are met.   
  -----------------------------------------------------------------------

### 8.6 Shipping and Delivery

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  FR-050                  Shipping shall have a   Must
                          queue of completed      
                          orders awaiting         
                          shipping actions.       

  FR-051                  Shipping shall verify   Must
                          dispatch readiness.     

  FR-052                  Shipping shall record   Must
                          carrier,                
                          tracking/vehicle        
                          number, dispatch        
                          date/time, shipped      
                          quantity, destination,  
                          and expected delivery,  
                          subject to final field  
                          approval.               

  FR-053                  Shipping shall record   Must
                          actual delivery and     
                          attach proof of         
                          delivery.               

  FR-054                  Shipping shall be able  Must
                          to report delivery      
                          issues.                 

  FR-055                  The system shall not    Must
                          mark an order Delivered 
                          until required delivery 
                          evidence is recorded or 
                          an approved alternative 
                          is defined.             
  -----------------------------------------------------------------------

### 8.7 Order Details, Timeline, and Audit Trail

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  FR-060                  Authorized users shall  Must
                          be able to view a       
                          unified order detail    
                          page.                   

  FR-061                  The order detail view   Must
                          shall show current      
                          stage, status, owner,   
                          next required action,   
                          and stage progress.     

  FR-062                  The system shall show   Must
                          date-stamped activity   
                          for status changes,     
                          decisions, comments,    
                          holds, rework,          
                          dispatch, and delivery. 

  FR-063                  The system shall retain Must
                          the identity of the     
                          actor and relevant      
                          decision details for    
                          auditable actions.      

  FR-064                  The system shall        Must
                          maintain                
                          document/attachment     
                          associations and        
                          relevant revisions.     

  FR-065                  Users shall only see    Must
                          records and activity    
                          permitted by their      
                          access rights.          
  -----------------------------------------------------------------------

### 8.8 Hold, Rework, and Notifications

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  FR-070                  Authorized users shall  Must
                          be able to place an     
                          order on hold with a    
                          category and reason.    

  FR-071                  A hold record shall     Must
                          include a responsible   
                          owner/team, target      
                          resolution date, and    
                          corrective action where 
                          applicable.             

  FR-072                  Authorized users shall  Must
                          be able to resolve,     
                          reassign, cancel, or    
                          send an order for       
                          re-review according to  
                          approved rules.         

  FR-073                  The system shall notify Must
                          the designated          
                          resolution owner and    
                          Manager when a hold     
                          requires attention.     

  FR-074                  The application shall   Should
                          provide a notification  
                          center with unread      
                          count and order         
                          navigation, consistent  
                          with the prototype.     

  FR-075                  The system shall keep   Must
                          hold and rework history 
                          in the order timeline   
                          after resolution.       

  FR-076                  The system shall define Should
                          notification behavior   
                          for clarification       
                          requests, stage         
                          handoffs, production    
                          issues, delivery        
                          issues, and overdue     
                          actions.                
  -----------------------------------------------------------------------

### 8.9 Manager Dashboard and Reporting

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  FR-080                  Managers shall be able  Must
                          to view order counts by 
                          stage and status.       

  FR-081                  Managers shall be able  Must
                          to view workload by     
                          team and identify       
                          orders requiring        
                          attention.              

  FR-082                  The dashboard shall     Must
                          identify ageing orders, 
                          target-time breaches,   
                          holds, and delayed      
                          shipments where the     
                          necessary dates are     
                          available.              

  FR-083                  Managers shall be able  Should
                          to filter by date       
                          range, team, and        
                          relevant order          
                          attributes.             

  FR-084                  The dashboard shall     Must
                          provide links to the    
                          underlying orders for   
                          investigation.          
  -----------------------------------------------------------------------

## 10. Business Rules

  -----------------------------------------------------------------------
  ID                                  Rule
  ----------------------------------- -----------------------------------
  BR-001                              Every order must have a unique
                                      order identifier.

  BR-002                              An order must not progress to the
                                      next stage until required data and
                                      approvals for the current stage are
                                      complete.

  BR-003                              A decision that changes workflow
                                      state must capture the acting user,
                                      timestamp, and decision/reason
                                      where applicable.

  BR-004                              Orders in On Hold status must
                                      remain visible to the responsible
                                      team and management until resolved
                                      or cancelled.

  BR-005                              A material shortage blocks
                                      production release unless an
                                      approved exception rule is defined.

  BR-006                              Production completion must capture
                                      output quantities and any required
                                      issue/completion information.

  BR-007                              Dispatch and delivery updates must
                                      be associated with the relevant
                                      order.

  BR-008                              An order cannot be marked Delivered
                                      without required delivery
                                      confirmation/evidence, subject to
                                      an approved business exception.

  BR-009                              Rework must preserve the original
                                      order history and prior decisions.

  BR-010                              Access to order information and
                                      actions must be permission-based.

  BR-011                              Role switching in the clickable
                                      prototype is for demonstration only
                                      and is not a production security
                                      control.

  BR-012                              The exact rules for cancellation,
                                      reopening, rejection, re-review,
                                      and stage rollback must be approved
                                      before implementation.
  -----------------------------------------------------------------------

## 11. Screen / Page Inventory

The source action plan defines 14 principal screens. These are logical
screens and do not necessarily require 14 separate URL routes; some may
be implemented as tabs, panels, forms, or dialogs within shared routes.

  ----------------------------------------------------------------------------------
                    No. Screen           Main users           Purpose
  --------------------- ---------------- -------------------- ----------------------
                      1 Login /          All roles            Enter or switch
                        Demonstration                         demonstration role;
                        Role Selector                         production login to be
                                                              implemented separately

                      2 CSR Dashboard /  Requestor/CSR        View requests, drafts,
                        My Order                              clarifications,
                        Requests                              statuses, owners,
                                                              dates, and age

                      3 Create New Order Requestor/CSR        Capture order
                                                              requirements, save
                                                              draft, attach files,
                                                              and submit

                      4 R&D Work Queue   R&D                  View assigned reviews,
                                                              clarifications,
                                                              ageing, and holds

                      5 R&D Feasibility  R&D                  Review specification
                        Review                                and record technical
                                                              decision

                      6 Planning Work    Planning             View approved orders
                        Queue                                 waiting for planning

                      7 Material &       Planning             Confirm materials,
                        Capacity                              record shortages,
                        Planning                              assign press,
                                                              schedule, and release

                      8 Press Work Queue Press                View scheduled and
                                                              blocked production
                                                              jobs

                      9 Press Production Press                Start/pause
                        Update                                production, report
                                                              output/waste/issues,
                                                              and complete

                     10 Shipping Work    Shipping             View completed orders
                        Queue                                 awaiting
                                                              dispatch/delivery
                                                              actions

                     11 Dispatch &       Shipping             Record shipment,
                        Delivery                              tracking, delivery,
                        Confirmation                          and proof

                     12 Order Details &  Authorized roles     View lifecycle, owner,
                        Activity                              next action,
                        Timeline                              decisions, documents,
                                                              and audit history

                     13 Hold & Rework    Authorized           Assign and resolve
                        Resolution       operational roles /  exceptions with
                                         Manager              evidence and history

                     14 Manager Overview Manager/Supervisor   View stage
                        Dashboard                             distribution,
                                                              workload, ageing,
                                                              holds, SLA risk, and
                                                              delayed shipments
  ----------------------------------------------------------------------------------

**Shared UI components identified in the wireframe:**
notifications/notification center, order queue/list, order detail panel,
activity history, hold alert, manager dashboard panel, and update/action
dialog.

## 12. Data Requirements

The following is a preliminary business-level data inventory. Exact
schema and mandatory fields require design approval.

### 11.1 Order Record

-   Unique order number.
-   Customer name and destination.
-   Product name/description and order type.
-   Packaging type, dimensions, material, and print colors.
-   Requested quantity and requested delivery date.
-   Technical notes and attached artwork/supporting documents.
-   Current status, stage, owner/team, priority, and creation/update
    timestamps.

### 11.2 Technical Review

-   Reviewer and decision.
-   Decision date/time.
-   Technical comments and feasibility checklist.
-   Tooling requirements, material recommendations, constraints/risks,
    and evidence attachments as applicable.

### 11.3 Planning

-   Material readiness and shortage details.
-   Expected material availability date.
-   Assigned press/production line.
-   Planned production date and planning notes.
-   Capacity/readiness status.

### 11.4 Production

-   Production start and completion timestamps.
-   Planned quantity, good quantity, and waste quantity.
-   Production status, issue category, corrective notes, and evidence.

### 11.5 Shipping and Delivery

-   Carrier and tracking/vehicle number.
-   Dispatch date/time and shipped quantity.
-   Destination and expected delivery date.
-   Actual delivery date/time, delivery status, proof of delivery, and
    issue details.

### 11.6 Audit, Notifications, and Exceptions

-   Actor, action, timestamp, previous/new status, reason, and comments.
-   Hold category, reason, owner/team, corrective action, target
    resolution date, and resolution.
-   Rework reason, owner, re-review stage, and evidence.
-   Notification recipient, related order, created/read/resolved
    timestamps, and notification status.

## 13. Non-Functional Requirements

These are proposed requirements; numeric targets and hosting/security
details must be confirmed with stakeholders.

  -----------------------------------------------------------------------
  ID                                  Requirement
  ----------------------------------- -----------------------------------
  NFR-001                             The application should provide
                                      reliable access during agreed
                                      business operating hours.
                                      Availability target is to be
                                      agreed.

  NFR-002                             Common queue and order-detail
                                      actions should respond within an
                                      agreed performance target under
                                      expected load.

  NFR-003                             The interface should be responsive
                                      for desktop and tablet usage.
                                      Mobile-specific needs, especially
                                      for Press and Shipping, require
                                      confirmation.

  NFR-004                             The interface should use clear
                                      labels, readable contrast, keyboard
                                      navigation, visible focus, and
                                      accessible status indicators.

  NFR-005                             Production access must use secure
                                      authentication and server-side
                                      authorization.

  NFR-006                             Sensitive order and customer
                                      information must be accessible only
                                      to authorized users.

  NFR-007                             Important decisions and workflow
                                      changes must be auditable and
                                      protected from unauthorized
                                      alteration.

  NFR-008                             Attachments must have approved
                                      file-type and size limits and be
                                      protected from unauthorized access.

  NFR-009                             The system should provide clear
                                      validation and error messages and
                                      avoid silent loss of user-entered
                                      information.

  NFR-010                             Backup, recovery, retention, and
                                      disaster-recovery requirements must
                                      be agreed before production launch.

  NFR-011                             The application should support
                                      maintainable, modular
                                      implementation and future
                                      integrations without assuming that
                                      those integrations are part of the
                                      first release.

  NFR-012                             Logging and monitoring should
                                      support troubleshooting of failed
                                      workflow actions and notifications.
  -----------------------------------------------------------------------

## 14. Reports and Operational Visibility

The Manager dashboard should provide: - Orders by stage and status. -
Workload by team. - Orders approaching or exceeding agreed target
times. - Average age in each stage. - Open holds grouped by
reason/team. - Rework cases and their age. - Production delays and
blocked jobs. - Delayed shipments and delivery issues. - Search/filter
controls and drill-through to the order record.

Definitions for "overdue," "SLA risk," "average stage age," and "delayed
shipment" must be agreed before reports are treated as authoritative.

## 15. Notifications

The prototype action plan specifically calls out role-routed hold
notifications, urgent dashboard alerts, unread counts, read actions,
order navigation, and alert closure after resolution.

The production design should define: - Events that trigger
notifications. - Recipient rules and escalation recipients. - In-app
notification behavior and unread/read status. - Whether email or other
channels are required. - Deduplication, retry, and failure handling. -
How resolved or cancelled exceptions affect open alerts. - Notification
audit and retention needs.

Email, SMS, push notifications, and external messaging integrations are
not assumed to be in scope until approved.

## 16. Assumptions and Dependencies

### 15.1 Assumptions

-   The first use case is a printed food packaging order, such as a
    snack pouch.
-   The first workflow covers CSR, R&D, Planning, Press, Shipping, and
    Manager/Supervisor visibility.
-   Order data is initially entered by users unless integrations are
    separately approved.
-   The wireframe is a clickable demonstration prototype, not a
    production system.
-   The 14 screens represent logical screens and can be consolidated
    into reusable routes/components.

### 15.2 Dependencies

-   Stakeholder approval of workflow and role responsibilities.
-   Confirmation of mandatory fields, documents, and status definitions.
-   Agreement on permissions and approval authority.
-   Agreement on SLA/target times and escalation rules.
-   Selection of production technology, hosting, storage, and identity
    approach.
-   Agreement on attachment retention and audit requirements.
-   Availability of operational data or approved sample data for
    testing.

## 17. Risks and Mitigations

  -----------------------------------------------------------------------
  Risk                    Potential impact        Proposed mitigation
  ----------------------- ----------------------- -----------------------
  Workflow rules are not  Rework in design and    Conduct workflow
  agreed                  implementation          walkthrough and approve
                                                  state transitions
                                                  before development

  Mandatory order fields  Incomplete submissions  Agree a field
  are unclear             and downstream          dictionary and
                          clarification           validation rules

  Role permissions are    Unauthorized actions or Create a
  ambiguous               blocked work            role-permission matrix
                                                  and test it

  SLA definitions are     Misleading manager      Define targets,
  missing                 dashboard and alerts    calendar rules, and
                                                  escalation thresholds

  Material/press          Planning data may       Define manual update
  availability is         become stale            ownership or approve
  maintained outside the                          future system
  system                                          integration

  Rework and rejection    Orders may become stuck Approve exception and
  paths are undefined     or be routed            re-entry rules
                          incorrectly             

  Prototype behavior is   Incorrect stakeholder   Clearly distinguish
  mistaken for production expectations            demonstration features
  capability                                      from production
                                                  requirements

  Notifications fail or   Holds and urgent work   Define retries,
  are ignored             may remain unresolved   acknowledgement,
                                                  escalation, and
                                                  monitoring
  -----------------------------------------------------------------------

## 18. Acceptance Criteria

The first release should be accepted when the agreed test scenarios
demonstrate that:

1.  CSR can create a draft, validate required fields, attach supporting
    documents, and submit an order.
2.  R&D can review the order and record an auditable approval,
    clarification request, rejection, or hold.
3.  Planning can record material readiness/shortage, assign a press,
    schedule the order, and release it only when required checks are
    met.
4.  Press can start production, record quantities and waste, report an
    issue, and complete production.
5.  Shipping can record dispatch information and confirm delivery with
    required evidence.
6.  Authorized users can view the order's current stage, owner, next
    action, documents, and activity history.
7.  A hold is visible to the assigned owner and Manager and remains in
    history after resolution.
8.  Rework retains prior decisions and provides a defined route back
    into the workflow.
9.  The Manager dashboard shows agreed counts, ageing, holds, and delays
    using approved definitions.
10. Role-based permissions prevent users from performing unauthorized
    actions.
11. Search, filters, validation, and notification navigation work as
    approved.
12. The interface works at agreed desktop/tablet sizes and passes the
    agreed accessibility checks.

## 19. Decisions Required Before Production Implementation

The following decisions are open and must be recorded by the business
owner, except resolved items marked below:

1.  **Resolved:** Requestor and CSR are one role for the current release.
2.  **Resolved for the current release:** Submission requires customer,
    product, packaging type, material, quantity, and requested delivery
    date. Other listed order fields remain optional.
3.  Who can approve, reject, hold, reopen, or cancel an order at each
    stage?
4.  Can rejected orders be edited and resubmitted? If yes, which stage
    should receive them?
5.  What is the exact material-shortage workflow and how is material
    availability verified?
6.  What is the rework path, and who approves re-entry into production?
7.  Is QA a separate stage or part of Press completion?
8.  What are the stage SLAs, working calendars, and escalation rules?
9.  Will the first production release be standalone/manual, or must it
    integrate with ERP/MRP, inventory, or shipping systems?
10. **Resolved:** Use Flowline's Node.js backend with PostgreSQL-backed
    email/password accounts, Argon2id password hashes, hashed session
    tokens, and HTTP-only session cookies. Users cannot self-assign
    roles; the detailed administration process remains to be approved.
11. **Partially resolved:** Supporting files are stored in protected
    PostgreSQL `bytea` content with a 5 MB per-file limit. File-type,
    document retention, and audit retention policies remain open.
12. Is mobile support required for Press and Shipping?
13. Which notification channels are required: in-app only, email, or
    others?
14. What are the availability, performance, backup, and recovery
    targets?
15. Who owns configuration, master data, and production support?

## 20. Recommended Delivery Phases

### Phase 1 --- Requirements and Workflow Sign-off

-   Validate roles, status transitions, required fields, permissions,
    and exception paths.
-   Confirm success measures and SLA definitions.
-   Approve the BRD and initial screen inventory.

### Phase 2 --- UX and Detailed Backlog

-   Convert each requirement into epics, user stories, and acceptance
    criteria.
-   Define reusable page/component boundaries from the BRD; validate
    only specifically requested visual elements against the wireframe.
-   Define role-permission and status-transition matrices.

### Phase 3 --- Core Workflow

-   Implement order creation, R&D review, planning, production,
    shipping, order timeline, and role-based access.
-   Implement validation and stage gates.

### Phase 4 --- Exceptions and Management Visibility

-   Implement hold/rework, notifications, manager dashboard, and ageing
    indicators.
-   Validate alert lifecycle and escalation rules.

### Phase 5 --- Testing and Release Readiness

-   Execute end-to-end and role-based tests.
-   Validate security, accessibility, performance, backup/recovery, and
    operational support requirements.
-   Obtain business acceptance before production launch.

## 21. Approval

Approval of this document confirms that the business requirements and
scope are sufficiently understood to proceed to detailed workflow
validation and backlog preparation. Approval does not imply that
unresolved decisions in Section 18 are already settled.

  Approver                    Name   Decision   Date
  --------------------------- ------ ---------- ------
  Business owner                     Pending    
  Operations representative          Pending    
  Technical lead                     Pending    
  Project owner                      Pending    

------------------------------------------------------------------------

**End of document**
