# Frontend Deployment

Render service: `flowline-manufacturing-ui`

- Root directory: `frontend`
- Build command: `npm ci --include=dev && npm run build`
- Publish directory: `dist`
- Auto-deploy: after CI checks pass
- SPA rewrite: `/*` to `/index.html`

Production URL: `https://flowline-manufacturing-ui.onrender.com`