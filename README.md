# Flowline Manufacturing

[![CI](https://github.com/MRI-DHUL/flowline-manufacturing/actions/workflows/ci.yml/badge.svg)](https://github.com/MRI-DHUL/flowline-manufacturing/actions/workflows/ci.yml)
[![Production Smoke](https://github.com/MRI-DHUL/flowline-manufacturing/actions/workflows/production-smoke.yml/badge.svg)](https://github.com/MRI-DHUL/flowline-manufacturing/actions/workflows/production-smoke.yml)

Role-based manufacturing order management system for order tracking, technical feasibility, production planning, manufacturing operations, dispatch, and delivery.

## Workflow

```text
CSR -> R&D -> Planning -> Press -> Shipping -> Manager -> Delivered
```

Each workflow role receives an assigned queue and a role-specific dashboard. The System Administrator can manage user access and open a separate, read-only Order Monitor that shows every order, its stage, owner, delivery information, and latest shipment status.

## Dashboard Reporting

- Current Sunday-Saturday order trend.
- Orders grouped by stage and status.
- Delivery Completion Pulse: delivered, on hold, and open delivery issues.
- Role-scoped reporting for operational users; organization-wide reporting for System Administrators.

## Packages

| Package | Purpose |
| --- | --- |
| `frontend/` | React and TypeScript application |
| `backend/` | Fastify API, authentication, workflow services, notifications |
| `database/` | PostgreSQL migrations, health checks, and migration tooling |

See [FLOWLINE_SETUP.md](FLOWLINE_SETUP.md) for setup, demo credentials, workflow acceptance steps, security notes, and validation commands.
