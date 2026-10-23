# Flowline Manufacturing

All-in-one setup, architecture, credentials, workflow, and verification guide.

## 1. What Flowline Is

Flowline is a role-based manufacturing order workflow:

```text
CSR -> R&D -> Planning -> Press -> Shipping -> Manager -> Delivered
```

The application tracks:

- Order creation and customer requirements.
- Explicit user assignment at every handoff.
- Technical feasibility review.
- Material, capacity, and production-line planning.
- Production execution and rework.
- Dispatch, delivery exceptions, and proof of delivery.
- Manager delivery confirmation.
- Holds, notifications, audit history, and role permissions.
- System Administrator account activation and role assignment.
- Role-scoped operational analytics with a Sunday-Saturday reporting window.
- A System Administrator read-only Order Monitor for every order and its latest shipment details.

## 2. Architecture

```text
Browser / React UI
        |
        | Authenticated HTTP requests and WebSocket notifications
        v
Fastify + Node.js backend
        |
        | PostgreSQL queries, transactions, audit writes
        v
PostgreSQL / Neon database
```

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Recharts
- Lucide icons
- Manrope Variable font

Location: `frontend/`

### Backend

- Node.js
- Fastify
- TypeScript
- Argon2id password hashing
- HTTP-only cookie sessions
- WebSocket notification publishing

Location: `backend/`

### Database

- PostgreSQL / Neon
- Schema: `flowline`
- Ordered, checksum-protected migrations

Location: `database/`

## 3. Prerequisites

Install:

- Node.js 24 or compatible current LTS Node.js
- npm
- PostgreSQL/Neon access
- VS Code recommended

The repository contains separate npm packages:

```text
backend/package.json
frontend/package.json
database/package.json
```

Install dependencies:

```powershell
Set-Location backend
npm install

Set-Location ..\frontend
npm install

Set-Location ..\database
npm install

Set-Location ..
```

## 4. Environment Configuration

### Backend environment

Create `backend/.env` from `backend/.env.example`:

```env
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
FRONTEND_ORIGIN=http://127.0.0.1:5173
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
JWT_SECRET=replace-with-a-random-secret-at-least-32-characters-long
JWT_SECRETS=
SMTP_ENABLED=false
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-gmail-address@flowline.com
SMTP_PASSWORD=your-gmail-app-password
SMTP_FROM=Flowline <your-gmail-address@flowline.com>
LOG_LEVEL=info
```

Do not commit `backend/.env`. Never put `DATABASE_URL`, database passwords, session tokens, or password hashes in frontend files.

### Frontend environment

Create `frontend/.env.local` if needed:

```env
VITE_API_BASE_URL=http://127.0.0.1:3000
```

If Vite starts on port `5174` because port `5173` is already occupied, the backend development CORS configuration allows both local frontend ports.

### Database environment

Create `database/.env` from `database/.env.example`:

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DATABASE?sslmode=require
```

### Gmail SMTP

SMTP is disabled by default. To enable email delivery:

1. Enable two-factor authentication on the Gmail account.
2. Create a Google app password for Flowline.
3. Set `SMTP_ENABLED=true`.
4. Set `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`.

Use the Gmail app password, not the normal Gmail account password. Store it only in `backend/.env` or a production secret manager.

## 5. Database Setup

Check migration state:

```powershell
Set-Location database
npm run migrate:status
```

Apply all migrations:

```powershell
npm run migrate
```

Run database health checks:

```powershell
npm run health
npm test
```

The current migration chain is:

```text
001_flowline_foundation.sql
002_postgresql_auth.sql
003_csr_order_workflow.sql
004_order_user_assignment.sql
005_notification_recipient_visibility.sql
006_planning_workflow_integrity.sql
007_seed_production_lines.sql
008_order_issue_escalation.sql
009_order_holds.sql
010_rework_resolution.sql
011_manager_review_status.sql
```

Applied migrations must not be edited. Add a new migration for future schema changes.

## 6. Start the Application

Open two terminals.

### Terminal 1: backend

```powershell
Set-Location backend
npm run dev
```

Backend URL:

```text
http://127.0.0.1:3000
```

### Terminal 2: frontend

```powershell
Set-Location frontend
npm run dev -- --host 127.0.0.1
```

Frontend URL:

```text
http://127.0.0.1:5173
```

If port `5173` is busy, Vite may use `5174`:

```text
http://127.0.0.1:5174
```

### Health endpoints

```text
GET http://127.0.0.1:3000/health
GET http://127.0.0.1:3000/api/v1/health/database
```

Expected health response:

```json
{
  "status": "ok"
}
```

## 7. Development Credentials

These are development/demo credentials only. Do not use them in production.

All active demo users currently use:

```text
Password: 123456789
```

### CSR

```text
ananya.rao@flowline.com
meera.nair@flowline.com
mridhul@flowline.com
vikram.iyer@flowline.com
```

### R&D

```text
arjun.menon@flowline.com
kavya.shah@flowline.com
rohan.desai@flowline.com
```

### Planning

```text
nikhil.verma@flowline.com
priya.kapoor@flowline.com
sonal.kulkarni@flowline.com
```

### Press

```text
amit.sethi@flowline.com
deepa.joshi@flowline.com
rajiv.bhat@flowline.com
```

### Shipping

```text
neha.malhotra@flowline.com
suresh.pillai@flowline.com
tara.fernandes@flowline.com
```

### Manager / Supervisor

```text
devendra.rao@flowline.com
ishita.sen@flowline.com
rahul.khanna@flowline.com
```

### System Administrator

```text
aditya.mehta@flowline.com
karan.malviya@flowline.com
shreya.menon@flowline.com
```

## 8. Role Responsibilities

### CSR

- Create customer orders.
- Complete required product and delivery information.
- Assign an R&D reviewer.
- Submit orders to R&D.
- Respond to clarification requests.
- Edit and resubmit orders rejected by R&D.
- View status history.

CSR does not use the generic `Report issue` escalation action because CSR is the top customer-service role in the operational chain.

### R&D

- Review technical feasibility.
- Approve and assign Planning.
- Request clarification.
- Reject as not feasible.
- Place an order on hold.
- Preserve technical decision history.

### Planning

- Confirm material availability.
- Record material shortages and expected availability dates.
- Confirm capacity.
- Select a production line.
- Select a Press operator.
- Release ready work to Press.
- Shortage saves notify active Managers and the CSR creator.

### Press

- Accept scheduled jobs.
- Start and resume production.
- Pause production with a reason.
- Record production issues and rework.
- Resolve rework or return it for Press review.
- Record good and waste quantities.
- Select a Shipping user.
- Complete production and send the order to Shipping.

### Shipping

- Verify dispatch readiness.
- Enter carrier, tracking/vehicle, dispatch time, destination, and expected delivery.
- Dispatch the order.
- Upload proof of delivery.
- Escalate a delivery exception to a specifically selected active Manager.
- A Manager escalation changes the order status to `Manager Review` and assigns the selected Manager.

### Manager / Supervisor

- See only orders assigned to that Manager in `Manager Review`.
- Upload final proof of delivery.
- Enter actual delivery time and recipient.
- Confirm delivery to the client.
- The order then becomes `Delivered`.
- Manage holds and operational exceptions.

### System Administrator

- View all user accounts.
- Activate pending users.
- Disable users.
- Assign workflow roles.
- The administrator cannot disable their own active account.
- Open `Order monitor` to search every order and inspect its status, stage, owner, delivery dates, and shipment details.
- The Order Monitor is read-only. Workflow changes remain available only to the assigned operational role.

## 9. Dashboard And Administration Reporting

Every role has an Overview dashboard with role-scoped operational reporting:

- Orders by stage and status.
- New order trend for the current Sunday-Saturday calendar week.
- Delivery Completion Pulse with delivered, on-hold, and open-issue counts.

The visibility model is enforced by the backend:

- CSR sees orders they created.
- R&D, Planning, Press, and Shipping see orders assigned to their active stage.
- Manager sees assigned delivery handoffs and their confirmed deliveries in completion reporting.
- System Administrator sees organization-wide reporting and the read-only Order Monitor.

## 10. End-to-End UI Acceptance Flow

Use one active account from each role.

1. Sign in as CSR.
2. Open `Orders` and choose `Create order`.
3. Fill customer, product, packaging, material, quantity, delivery date, and R&D reviewer.
4. Submit for R&D review.
5. Sign out and sign in as the assigned R&D user.
6. Approve the order and assign Planning.
7. Sign in as the assigned Planning user.
8. Set material available, capacity available, production line, production date, readiness ready, and Press user.
9. Release to Press.
10. Sign in as the assigned Press user.
11. Accept the job, start production, record quantities, and assign Shipping.
12. Sign in as the assigned Shipping user.
13. Verify readiness and dispatch the shipment.
14. Select an active Manager in `Escalate to Manager` when manager delivery intervention is needed.
15. Sign in as that Manager.
16. Open `Delivery handoffs`.
17. Upload proof of delivery.
18. Enter actual delivery time and recipient.
19. Confirm delivered.
20. Verify the Manager queue clears and the order status is `Delivered`.

## 11. Useful Commands

### Backend

```powershell
Set-Location backend
npm run typecheck
npm test
npm run build
```

### Frontend

```powershell
Set-Location frontend
npm run build
npm test
npm run lint
```

### Database

```powershell
Set-Location database
npm test
npm run migrate:status
npm run health
```

### Full validation

Run each package from its own directory. The repository root does not contain a package.json.

```powershell
Set-Location backend
npm run typecheck
npm test

Set-Location ..\frontend
npm run build
npm test

Set-Location ..\database
npm run typecheck
npm test
npm run migrate:status
npm run health
```

## 12. Troubleshooting

### Frontend port is already in use

Vite selects another port, commonly `5174`. Open the printed URL and ensure the backend CORS origin allows it.

### Backend port is already in use

Find and stop the stale listener, then restart the backend:

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen
```

Only stop a process you recognize as the Flowline backend.

### Login fails with CORS

Make sure the browser origin matches the configured local frontend origin. The development backend allows `5173` and `5174`.

### Login fails with account pending

A System Administrator must activate the account and assign a role.

### Manager queue is empty

A Shipping user must select that specific Manager during escalation. The order must have status `Manager Review` and the selected Manager must be active.

### Dashboard cannot load or notifications are unavailable

Confirm the backend is running on the configured `VITE_API_BASE_URL`, normally `http://127.0.0.1:3000`:

```powershell
Set-Location backend
npm run dev
```

### Press action returns an empty JSON body error

Use the current frontend build. Empty-body actions must not send `Content-Type: application/json` without a request body.

### Database migration is pending

Run:

```powershell
Set-Location database
npm run migrate
npm run migrate:status
```

Never edit a migration that is already applied.

## 13. Security Notes

- Demo credentials are for local development only.
- Never commit `.env` files.
- Never expose DATABASE_URL to the frontend.
- Passwords are stored as Argon2id hashes.
- Sessions use HTTP-only cookies.
- Session cookies use `SameSite=Lax` locally and `SameSite=None; Secure` in production so separately hosted frontend and API origins can share authenticated sessions.
- Role permissions are enforced by the backend, not only by UI visibility.
- The administrator Order Monitor is a backend-authorized `GET` endpoint with no order mutation route.
- Login and registration are rate limited. Helmet response headers and credentialed CORS origin restrictions are enabled.
- Audit events are append-only.
- Replace all demo passwords before deploying.
- Replace `JWT_SECRET` with a unique secret before deploying. Production startup rejects the development fallback.
- Every backend response includes `x-request-id` for log correlation and production troubleshooting.
- For key rotation, set `JWT_SECRETS` to a comma-separated list with the newest signing key first and previous keys after it. Remove retired keys after active sessions expire.

## 14. Current Verification Baseline

The verified baseline includes:

- Backend typecheck passing.
- Backend test suite passing: 53 tests.
- Frontend build passing.
- Frontend test suite passing: 24 tests.
- Database tests and typecheck passing: 2 tests.
- Migrations 001 through 011 applied.
- Database health passing.
- Browser-verified end-to-end order flow from CSR creation through Manager delivery.
- Browser-verified System Administrator Order Monitor with read-only order and shipment detail.
- Production dependency audits report no known vulnerabilities for backend, frontend, or database packages.

## 15. Render Backend Deployment

The repository includes `render.yaml` for the backend web service.

Required Render environment values:

- `DATABASE_URL`: production PostgreSQL/Neon connection string.
- `FRONTEND_ORIGIN`: exact deployed frontend origin, including `https://` and no trailing path.
- `JWT_SECRET`: generated by Render for Blueprint deployments or set to a unique value of at least 32 characters.

Render settings:

```text
Root directory: backend
Build command: npm ci --include=dev && npm run build
Start command: npm start
Health check: /health
Host: 0.0.0.0
```

Render injects `PORT`; do not hardcode it. After deployment, verify both `/health` and `/api/v1/health/database`.

## 16. CI/CD Pipeline

GitHub Actions runs the following checks for pull requests and every push to `main`:

- Backend typecheck, build, tests, and production dependency audit.
- Frontend lint, tests, production build, and production dependency audit.
- Database typecheck, migration-file tests, and production dependency audit.

Workflow files:

```text
.github/workflows/ci.yml
.github/workflows/production-smoke.yml
```

Both Render services should use **After CI Checks Pass** auto-deploy. After CI succeeds on `main`, Render builds the connected commit. The Production Smoke workflow runs every 15 minutes and can be started manually; it resolves the latest `main` SHA, waits until backend `/health` reports that exact commit, then checks the database connection, frontend root, and a direct SPA route. Keeping smoke checks scheduled avoids a circular dependency where Render waits for a smoke check that is itself waiting for Render.
