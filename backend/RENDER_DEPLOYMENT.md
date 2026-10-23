# Backend Deployment

Render service: `flowline-manufacturing-api`

- Root directory: `backend`
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health check: `/health`
- Auto-deploy: after CI checks pass

Production health endpoints:

- `https://flowline-manufacturing-api.onrender.com/health`
- `https://flowline-manufacturing-api.onrender.com/api/v1/health/database`