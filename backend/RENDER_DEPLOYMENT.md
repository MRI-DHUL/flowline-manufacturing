# Backend Deployment

Render service: `flowline-manufacturing-api`

- Root directory: `backend`
- Build command: `npm ci --include=dev && npm run typecheck && npm test && npm run build`
- Start command: `npm start`
- Health check: `/health`
- Auto-deploy: on commit; Render repeats backend validation before publishing

Production health endpoints:

- `https://flowline-manufacturing-api.onrender.com/health`
- `https://flowline-manufacturing-api.onrender.com/api/v1/health/database`