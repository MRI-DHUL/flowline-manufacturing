# Permissions and Status Transitions

## Permission Matrix

`View` always remains subject to approved record-level access. `Pending` means BRD approval is required before implementation.

| Capability | CSR | R&D | Planning | Press | Shipping | Manager |
|---|---|---|---|---|---|---|
| Create/edit draft | Yes | No | No | No | No | View |
| Submit to R&D | Yes | No | No | No | No | View |
| Respond to clarification | Yes | Review | Pending | No | No | View |
| Record R&D decision | No | Yes | No | No | No | View |
| Record materials/capacity | No | View | Yes | No | No | View |
| Assign press/schedule/release | No | No | Yes | View | No | View |
| Accept/start/pause production | No | No | View | Yes | No | View |
| Record output/waste/issues | No | No | View | Yes | No | View |
| Dispatch/confirm delivery | No | No | No | View | Yes | View |
| View unified detail/timeline | Yes | Yes | Yes | Yes | Yes | Yes |
| Place on hold | Pending | Pending | Pending | Pending | Pending | Pending |
| Resolve/reassign/cancel/re-review | Pending | Pending | Pending | Pending | Pending | Pending |
| Request/approve rework | Pending | Pending | Pending | Pending | Pending | Pending |
| View manager dashboard | No | No | No | No | No | Yes |
| Manage users/roles/configuration | No | No | No | No | No | Pending system administrator |

## Happy-Path Transitions

| From | Action | To | Acting role | Required gate |
|---|---|---|---|---|
| Draft | Submit | Submitted / R&D Review | CSR | Approved mandatory order data is complete |
| Submitted / R&D Review | Approve feasibility | Planning Review | R&D | Reviewer, decision, timestamp, comments, required evidence |
| Planning Review | Assign and release | Scheduled | Planning | Materials/capacity ready, press and planned date recorded |
| Scheduled | Accept/start | In Production | Press | Scheduled job and required setup acceptance |
| In Production | Complete production | Ready to Ship | Press | Required output, waste, times, issues/evidence recorded |
| Ready to Ship | Dispatch | Dispatched | Shipping | Readiness and required shipment data recorded |
| Dispatched | Confirm delivery | Delivered | Shipping | Actual delivery and required proof/approved alternative |

The BRD lists both `Submitted` and `R&D Review` but does not define whether they are separate persisted states. This is `D-03`/status-design clarification and must be settled before the final state machine.

## Exception Transitions

| From | Action | To | Return/destination | Status |
|---|---|---|---|---|
| R&D Review | Request clarification | Pending clarification (status name not approved) | Appropriate review stage after CSR response | Blocked by D-03/D-04 |
| R&D Review | Reject | Rejected is an outcome but not in principal state list | Revise/resubmit or Cancelled | Blocked by D-04 |
| Approved operational state | Place on hold | On Hold | Prior/approved re-review stage after resolution | Blocked by D-03 |
| On Hold | Resolve/reassign/cancel/re-review | Prior stage, approved review stage, or Cancelled | Rule depends on category/authority | Blocked by D-03 |
| Planning Review | Record material shortage | On Hold or blocked Planning Review | Planning Review after verified readiness | Blocked by D-05 |
| In Production | Report issue/request rework | Rework Required | Approved correction/re-entry stage | Blocked by D-06 |
| Shipping/Dispatched | Report delivery issue | Delivery issue status not approved | Shipping/Dispatched until resolved | Blocked by D-03 |
| Any eligible state | Cancel | Cancelled | Terminal or reopen rule | Blocked by D-03 |
| Cancelled/Delivered/Rejected | Reopen/rollback | Not approved | Not approved | Blocked by D-03/D-04 |

## Transition Invariants

1. The backend validates all transitions and acting-role authority.
2. State change and audit event are committed atomically.
3. A failed gate leaves the order in its original state.
4. Hold and rework never delete prior decisions or timeline history.
5. A material shortage blocks production release unless an approved exception is later defined.
6. Delivered requires approved delivery evidence or an approved alternative.
7. Frontend action visibility does not replace backend authorization.
